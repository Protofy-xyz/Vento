import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional, Tuple

import paho.mqtt.client as mqtt

LOG = logging.getLogger(__name__)


@dataclass
class ActionEnvelope:
    subsystem: str
    action: str
    payload: bytes
    topic: str
    request_id: str
    _reply: Optional[Callable[[bytes], None]] = None

    def reply(self, payload: bytes) -> None:
        if not self._reply:
            raise RuntimeError("reply channel not available")
        self._reply(payload)

    def reply_json(self, payload: Any) -> None:
        self.reply(json.dumps(payload).encode("utf-8"))

    def can_reply(self) -> bool:
        return self._reply is not None


class MQTTClient:
    def __init__(self, device_name: str, client: mqtt.Client) -> None:
        self.device_name = device_name
        self._client = client

    def publish(self, endpoint: str, payload: Any) -> None:
        topic = f"devices/{self.device_name}{endpoint}"
        data = json.dumps(payload)
        result = self._client.publish(topic, data, qos=1)
        result.wait_for_publish()
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            LOG.warning("publish failed for %s: rc=%s", topic, result.rc)

    def close(self) -> None:
        try:
            self._client.loop_stop()
        finally:
            self._client.disconnect()


def connect_mqtt(
    hostname: str,
    device_name: str,
    username: str,
    token: str,
    handler: Callable[[ActionEnvelope], None],
) -> MQTTClient:
    client = mqtt.Client(client_id=f"{device_name}-{int(time.time() * 1e9)}")
    client.username_pw_set(username, token)
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    topic_filter = f"devices/{device_name}/+/actions/#"

    def on_connect(cl: mqtt.Client, _userdata, _flags, rc):
        if rc != 0:
            LOG.error("MQTT connection failed rc=%s", rc)
            return
        cl.subscribe(topic_filter, qos=1)

    def on_message(cl: mqtt.Client, _userdata, msg: mqtt.MQTTMessage):
        parsed = _parse_topic(msg.topic)
        if not parsed:
            return
        subsystem, action, request_id = parsed
        reply_fn = None
        if request_id:
            reply_topic = msg.topic + "/reply"

            def _reply(payload: bytes) -> None:
                res = cl.publish(reply_topic, payload, qos=1)
                res.wait_for_publish()

            reply_fn = _reply
        env = ActionEnvelope(
            subsystem=subsystem,
            action=action,
            payload=msg.payload,
            topic=msg.topic,
            request_id=request_id,
            _reply=reply_fn,
        )
        try:
            handler(env)
        except Exception:
            LOG.exception("error handling action %s/%s", subsystem, action)

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(hostname, 1883, keepalive=30)
    client.loop_start()
    return MQTTClient(device_name, client)


def _parse_topic(topic: str) -> Optional[Tuple[str, str, str]]:
    parts = [p for p in topic.split("/") if p]
    if len(parts) < 5:
        return None
    if parts[0] != "devices" or parts[3] != "actions":
        return None
    if parts[-1] == "reply":
        return None
    subsystem = parts[2]
    action = parts[4]
    request_id = parts[5] if len(parts) >= 6 else ""
    return subsystem, action, request_id
