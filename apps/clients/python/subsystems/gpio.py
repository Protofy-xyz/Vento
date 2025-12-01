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
                        description=(
                            "Drive a Raspberry Pi GPIO pin HIGH (3.3V) or LOW (0V) using the official BCM numbering. "
                            "Use this action to toggle relays, LEDs or any digital actuator connected to the Pi header. "
                            "Remember to use proper level shifting or transistor drivers for loads that draw more than a few milliamps."
                        ),
                        endpoint=GPIO_SET_PIN_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "type": "object",
                                "required": ["bcm_pin", "level"],
                                "properties": {
                                    "bcm_pin": {
                                        "type": "integer",
                                        "title": "BCM pin number",
                                        "description": (
                                            "Broadcom GPIO identifier as shown in Raspberry Pi documentation (e.g. 17 = physical pin 11). "
                                            "Only BCM numbers between 0 and 27 are typically available on Raspberry Pi boards."
                                        ),
                                        "minimum": 0,
                                        "maximum": 27,
                                    },
                                    "level": {
                                        "type": "boolean",
                                        "title": "Output level",
                                        "description": (
                                            "Digital level to drive on the selected pin. "
                                            "true keeps the pin HIGH (3.3V) and false keeps it LOW (0V). "
                                            "Combine with GPIO_READ to verify the line changed as expected."
                                        ),
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
                        description=(
                            "Sample the current HIGH/LOW level of a Raspberry Pi GPIO pin (BCM numbering). "
                            "Use this to check sensors, button states or to confirm that a previous gpio_write call succeeded."
                        ),
                        endpoint=GPIO_READ_PIN_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "type": "object",
                                "required": ["bcm_pin"],
                                "properties": {
                                    "bcm_pin": {
                                        "type": "integer",
                                        "title": "BCM pin number",
                                        "description": (
                                            "Broadcom GPIO identifier you want to read (e.g. 4 = physical pin 7). "
                                            "Ensure the pin is configured as an input or has a pull-up/pull-down resistor."
                                        ),
                                        "minimum": 0,
                                        "maximum": 27,
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
            pin = parse_pin(payload)
            state = first_bool(payload.get("level"), payload.get("state"), payload.get("value"), payload.get("high"))
            if state is None:
                raise ValueError("missing state; provide true/false")
            self.ctrl.set_pin(pin, bool(state))
            reply_with_data(msg, {"pin": pin, "state": bool(state)})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_read_pin(self, msg: ActionEnvelope) -> None:
        try:
            payload = json.loads(msg.payload or b"{}")
            pin = parse_pin(payload)
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


def parse_pin(payload: Any) -> int:
    """
    Accept both the new `bcm_pin` field and the legacy `pin` field to remain backwards compatible.
    """
    pin_value = payload.get("bcm_pin")
    if pin_value is None:
        pin_value = payload.get("pin")
    pin = int(pin_value or 0)
    if pin <= 0:
        raise ValueError("payload must include a valid BCM pin number")
    return pin
