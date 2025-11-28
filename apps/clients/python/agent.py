import logging
import threading
from typing import Optional

from config import Config
from device import DevicePayload
from mqtt_client import MQTTClient, ActionEnvelope, connect_mqtt
from subsystems import SubsystemSet
from vento_client import VentoClient

LOG = logging.getLogger(__name__)


class Agent:
    def __init__(
        self,
        cfg: Config,
        client: VentoClient,
        skip_register_actions: bool = False,
        run_once: bool = False,
    ) -> None:
        self.cfg = cfg
        self.http = client
        self.skip_register_actions = skip_register_actions
        self.run_once = run_once
        self.subs = SubsystemSet(cfg)
        self.stop_event = threading.Event()
        self.mqtt: Optional[MQTTClient] = None

    def start(self) -> None:
        self.subs.prepare(self.cfg.device_name)
        self._ensure_device()
        self.mqtt = connect_mqtt(
            hostname=self.http.hostname(),
            device_name=self.cfg.device_name,
            username=self.cfg.username,
            token=self.cfg.token,
            handler=self._handle_action,
        )
        LOG.info("connected to mqtt as %s", self.cfg.device_name)
        try:
            self.subs.publish_boot(self.mqtt)
            if self.run_once:
                return
            self.subs.start_intervals(self.mqtt, self.stop_event)
            self.stop_event.wait()
        finally:
            if self.mqtt:
                self.mqtt.close()

    def stop(self) -> None:
        self.stop_event.set()

    def _ensure_device(self) -> None:
        payload: DevicePayload = self.subs.device_payload(self.cfg.device_name)
        exists = self.http.device_exists(self.cfg.token, self.cfg.device_name)
        if exists:
            self.http.update_device(self.cfg.token, self.cfg.device_name, payload.to_dict())
            return

        LOG.info("device %s not found, registering...", self.cfg.device_name)
        create_payload = {"name": payload.name, "platform": payload.current_sdk}
        self.http.register_device(self.cfg.token, create_payload)
        self.http.update_device(self.cfg.token, self.cfg.device_name, payload.to_dict())
        if not self.skip_register_actions:
            try:
                self.http.trigger_register_actions(self.cfg.token)
            except Exception as err:
                LOG.warning("failed to trigger registerActions: %s", err)

    def _handle_action(self, msg: ActionEnvelope) -> None:
        handled = self.subs.handle_action(msg)
        if not handled:
            LOG.info("unhandled action[%s/%s]: %s", msg.subsystem, msg.action, msg.payload)
