import logging
import threading
from pathlib import Path
from typing import Callable, Dict, List

from config import Config
from device import DevicePayload, SubsystemDefinition, build_device_payload
from mqtt_client import ActionEnvelope, MQTTClient
from .gpio import GPIOTemplate
from .system_info import SystemInfoTemplate
from .utils import is_raspberry_pi

LOG = logging.getLogger(__name__)


class SubsystemSet:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.templates = [SystemInfoTemplate(Path.cwd())]
        if is_raspberry_pi():
            self.templates.append(GPIOTemplate())
        self.definitions: List[SubsystemDefinition] = []
        self.handlers: Dict[str, Callable[[ActionEnvelope], None]] = {}

    def prepare(self, device_name: str) -> None:
        self.definitions = []
        self.handlers = {}
        for tpl in self.templates:
            definition = tpl.build(device_name)
            self.definitions.append(definition)
            for action_cfg in definition.actions:
                key = self._action_key(definition.name, action_cfg.action.name)
                self.handlers[key] = action_cfg.handler

    def device_payload(self, device_name: str) -> DevicePayload:
        return build_device_payload(device_name, self.definitions)

    def publish_boot(self, mqtt: MQTTClient) -> None:
        for definition in self.definitions:
            for mon in definition.monitors:
                if not mon.boot:
                    continue
                try:
                    mon.boot(None, mqtt)
                except Exception:
                    LOG.exception("boot publish failed for %s/%s", definition.name, mon.monitor.name)

    def start_intervals(self, mqtt: MQTTClient, stop_event: threading.Event) -> None:
        for definition in self.definitions:
            for mon in definition.monitors:
                if not mon.tick:
                    continue
                interval = mon.interval_seconds or self.cfg.monitor_interval_seconds
                if interval <= 0:
                    continue
                thread = threading.Thread(
                    target=self._run_monitor,
                    args=(mon.tick, interval, mqtt, definition.name, mon.monitor.name, stop_event),
                    daemon=True,
                )
                thread.start()

    def handle_action(self, msg: ActionEnvelope) -> bool:
        key = self._action_key(msg.subsystem, msg.action)
        handler = self.handlers.get(key)
        if not handler:
            return False
        try:
            handler(msg)
        except Exception:
            LOG.exception("handler error for %s", key)
        return True

    def _run_monitor(
        self,
        tick: Callable[[object, MQTTClient], None],
        interval: int,
        mqtt: MQTTClient,
        subsystem: str,
        monitor_name: str,
        stop_event: threading.Event,
    ) -> None:
        while not stop_event.wait(interval):
            try:
                tick(None, mqtt)
            except Exception:
                LOG.exception("periodic publish failed for %s/%s", subsystem, monitor_name)

    @staticmethod
    def _action_key(subsystem: str, action: str) -> str:
        return f"{subsystem.lower()}:{action.lower()}"
