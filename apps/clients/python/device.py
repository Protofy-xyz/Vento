from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

PRINT_ACTION_ENDPOINT = "/system/actions/print"
EXECUTE_ACTION_ENDPOINT = "/system/actions/execute"
LIST_DIR_ACTION_ENDPOINT = "/system/actions/list_dir"
READ_FILE_ACTION_ENDPOINT = "/system/actions/read_file"
WRITE_FILE_ACTION_ENDPOINT = "/system/actions/write_file"
DELETE_FILE_ACTION_ENDPOINT = "/system/actions/delete_file"
MKDIR_ACTION_ENDPOINT = "/system/actions/mkdir"
MEMORY_TOTAL_ENDPOINT = "/system/monitors/memory_total"
MEMORY_USAGE_ENDPOINT = "/system/monitors/memory_used"
SYSTEM_SUBSYSTEM_NAME = "system"
SYSTEM_SUBSYSTEM_TYPE = "virtual"
PRINTER_SUBSYSTEM_NAME = "stdout"
GPIO_SUBSYSTEM_NAME = "gpio"
GPIO_SUBSYSTEM_TYPE = "hardware"
GPIO_SET_PIN_ENDPOINT = "/gpio/actions/set_pin"
GPIO_READ_PIN_ENDPOINT = "/gpio/actions/read_pin"


@dataclass
class ActionPayload:
    type: str
    schema: Optional[Dict[str, Any]] = None
    value: Any = None

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {"type": self.type}
        if self.schema:
            data["schema"] = self.schema
        if self.value is not None:
            data["value"] = self.value
        return data


@dataclass
class Action:
    name: str
    label: str
    description: str
    endpoint: str
    connection_type: str
    payload: ActionPayload
    card_props: Optional[Dict[str, Any]] = None
    mode: Optional[str] = None
    reply_timeout_ms: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "endpoint": self.endpoint,
            "connectionType": self.connection_type,
            "payload": self.payload.to_dict(),
        }
        if self.card_props:
            data["cardProps"] = self.card_props
        if self.mode:
            data["mode"] = self.mode
        if self.reply_timeout_ms:
            data["replyTimeoutMs"] = self.reply_timeout_ms
        return data


@dataclass
class Monitor:
    name: str
    label: str
    description: str
    endpoint: str
    connection_type: str
    units: str = ""
    card_props: Optional[Dict[str, Any]] = None
    ephemeral: bool = False

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "endpoint": self.endpoint,
            "connectionType": self.connection_type,
            "ephemeral": self.ephemeral,
        }
        if self.units:
            data["units"] = self.units
        if self.card_props:
            data["cardProps"] = self.card_props
        return data


@dataclass
class MonitorConfig:
    monitor: Monitor
    boot: Optional[callable] = None
    interval_seconds: int = 0
    tick: Optional[callable] = None


@dataclass
class ActionConfig:
    action: Action
    handler: Optional[callable] = None


@dataclass
class SubsystemDefinition:
    name: str
    type: str
    monitors: List[MonitorConfig] = field(default_factory=list)
    actions: List[ActionConfig] = field(default_factory=list)

    def to_payload(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type,
            "monitors": [m.monitor.to_dict() for m in self.monitors],
            "actions": [a.action.to_dict() for a in self.actions],
        }


@dataclass
class DevicePayload:
    name: str
    current_sdk: str
    subsystem: List[SubsystemDefinition]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "platform": self.current_sdk,
            "subsystem": [s.to_payload() for s in self.subsystem],
        }


def build_device_payload(device_name: str, subs: List[SubsystemDefinition]) -> DevicePayload:
    return DevicePayload(name=device_name, current_sdk="ventoagent-py", subsystem=subs)
