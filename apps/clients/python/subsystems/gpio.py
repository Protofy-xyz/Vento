import json
import logging
import threading
from typing import Any, Optional

from periphery import GPIO

from device import (
    Action,
    ActionConfig,
    ActionPayload,
    SubsystemDefinition,
    GPIO_READ_PIN_ENDPOINT,
    GPIO_SET_PIN_ENDPOINT,
    GPIO_SUBSYSTEM_NAME,
    GPIO_SUBSYSTEM_TYPE,
)
from mqtt_client import ActionEnvelope
from .utils import is_raspberry_pi, reply_with_data, reply_with_error

LOG = logging.getLogger(__name__)


class GPIOTemplate:
    def __init__(self) -> None:
        self.ctrl = GPIOController()

    def build(self, _device_name: str) -> SubsystemDefinition:
        return SubsystemDefinition(
            name=GPIO_SUBSYSTEM_NAME,
            type=GPIO_SUBSYSTEM_TYPE,
            actions=[
                ActionConfig(
                    action=Action(
                        name="gpio_write",
                        label="Drive GPIO Output",
                        description="Drive a Raspberry Pi GPIO pin high or low using BCM numbering.",
                        endpoint=GPIO_SET_PIN_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "type": "object",
                                "required": ["pin", "state"],
                                "properties": {
                                    "pin": {
                                        "type": "integer",
                                        "title": "BCM pin",
                                        "description": "Broadcom pin number (e.g. 17).",
                                        "minimum": 0,
                                    },
                                    "state": {
                                        "type": "boolean",
                                        "title": "Output level",
                                        "description": "true = HIGH (3.3V). false = LOW (0V).",
                                        "default": True,
                                    },
                                },
                            },
                        ),
                        card_props={"icon": "power", "color": "$green10"},
                    ),
                    handler=self.handle_set_pin,
                ),
                ActionConfig(
                    action=Action(
                        name="gpio_read",
                        label="Read GPIO Input",
                        description="Read the current digital level of a Raspberry Pi GPIO pin (BCM numbering).",
                        endpoint=GPIO_READ_PIN_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "type": "object",
                                "required": ["pin"],
                                "properties": {
                                    "pin": {
                                        "type": "integer",
                                        "title": "BCM pin",
                                        "description": "Broadcom pin number (e.g. 4).",
                                        "minimum": 0,
                                    },
                                },
                            },
                        ),
                        card_props={"icon": "activity", "color": "$blue10"},
                        mode="request-reply",
                    ),
                    handler=self.handle_read_pin,
                ),
            ],
        )

    def handle_set_pin(self, msg: ActionEnvelope) -> None:
        try:
            payload = json.loads(msg.payload or b"{}")
            pin = int(payload.get("pin") or 0)
            if pin == 0:
                raise ValueError("payload must include non-zero pin")
            state = first_bool(payload.get("state"), payload.get("value"), payload.get("high"))
            if state is None:
                raise ValueError("missing state; provide true/false")
            self.ctrl.set_pin(pin, bool(state))
            reply_with_data(msg, {"pin": pin, "state": bool(state)})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_read_pin(self, msg: ActionEnvelope) -> None:
        try:
            payload = json.loads(msg.payload or b"{}")
            pin = int(payload.get("pin") or 0)
            if pin == 0:
                raise ValueError("payload must include non-zero pin")
            state = self.ctrl.read_pin(pin)
            reply_with_data(msg, {"pin": pin, "state": state})
        except Exception as err:
            reply_with_error(msg, err)


class GPIOController:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ready = False
        self._error: Optional[Exception] = None

    def _ensure_ready(self) -> None:
        with self._lock:
            if self._ready or self._error:
                return
            if not is_raspberry_pi():
                self._error = RuntimeError("GPIO not available: not running on Raspberry Pi")
                return
            try:
                self._ready = True
                LOG.info("GPIO started ok")
            except Exception as err:  # pragma: no cover - depends on hardware
                self._error = err
                LOG.warning("GPIO init failed: %s", err)

    def set_pin(self, pin: int, high: bool) -> None:
        if pin < 0:
            raise ValueError(f"invalid pin {pin}")
        self._ensure_ready()
        if self._error:
            raise self._error
        gpio = GPIO("/dev/gpiochip0",pin, "out")
        try:
            gpio.write(True if high else False)
        finally:
            gpio.close()

    def read_pin(self, pin: int) -> bool:
        if pin < 0:
            raise ValueError(f"invalid pin {pin}")
        self._ensure_ready()
        if self._error:
            raise self._error
        gpio = GPIO(pin, "in")
        try:
            return bool(gpio.read())
        finally:
            gpio.close()


def first_bool(*values: Any) -> Optional[bool]:
    for value in values:
        if isinstance(value, bool):
            return value
    return None
