import json
import os
import platform
import subprocess
from pathlib import Path
from typing import Any, Dict

import psutil

from device import (
    Action,
    ActionConfig,
    ActionPayload,
    Monitor,
    MonitorConfig,
    SubsystemDefinition,
    DELETE_FILE_ACTION_ENDPOINT,
    EXECUTE_ACTION_ENDPOINT,
    LIST_DIR_ACTION_ENDPOINT,
    MEMORY_TOTAL_ENDPOINT,
    MEMORY_USAGE_ENDPOINT,
    MKDIR_ACTION_ENDPOINT,
    PRINT_ACTION_ENDPOINT,
    READ_FILE_ACTION_ENDPOINT,
    SYSTEM_SUBSYSTEM_NAME,
    SYSTEM_SUBSYSTEM_TYPE,
    WRITE_FILE_ACTION_ENDPOINT,
)
from mqtt_client import ActionEnvelope
from .utils import (
    entry_type,
    extract_path_from_payload,
    reply_with_data,
    reply_with_error,
    resolve_relative_path,
    target_relative,
)


class SystemInfoTemplate:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir

    def build(self, _device_name: str) -> SubsystemDefinition:
        return SubsystemDefinition(
            name=SYSTEM_SUBSYSTEM_NAME,
            type=SYSTEM_SUBSYSTEM_TYPE,
            monitors=[
                MonitorConfig(
                    monitor=Monitor(
                        name="memory_total",
                        label="Total memory",
                        description="Total physical memory detected when the agent booted",
                        units="bytes",
                        endpoint=MEMORY_TOTAL_ENDPOINT,
                        connection_type="mqtt",
                        card_props={"icon": "database", "color": "$green10"},
                        ephemeral=False,
                    ),
                    boot=self.publish_total_memory,
                ),
                MonitorConfig(
                    monitor=Monitor(
                        name="memory_used",
                        label="Used memory",
                        description="Periodically reported RAM usage",
                        units="bytes",
                        endpoint=MEMORY_USAGE_ENDPOINT,
                        connection_type="mqtt",
                        card_props={"icon": "activity", "color": "$blue10"},
                        ephemeral=True,
                    ),
                    interval_seconds=5,
                    tick=self.publish_used_memory,
                ),
                MonitorConfig(
                    monitor=Monitor(
                        name="cpu_model",
                        label="CPU model",
                        description="CPU name/model",
                        endpoint="/system/monitors/cpu_model",
                        connection_type="mqtt",
                        card_props={"icon": "cpu", "color": "$orange10"},
                        ephemeral=False,
                    ),
                    boot=self.publish_cpu_model,
                ),
                MonitorConfig(
                    monitor=Monitor(
                        name="cpu_cores",
                        label="CPU cores",
                        description="Number of logical CPU cores",
                        endpoint="/system/monitors/cpu_cores",
                        connection_type="mqtt",
                        card_props={"icon": "grid", "color": "$purple10"},
                        ephemeral=False,
                    ),
                    boot=self.publish_cpu_cores,
                ),
                MonitorConfig(
                    monitor=Monitor(
                        name="cpu_frequency",
                        label="CPU frequency",
                        description="Current CPU frequency (MHz)",
                        endpoint="/system/monitors/cpu_frequency",
                        connection_type="mqtt",
                        card_props={"icon": "activity", "color": "$pink10"},
                        ephemeral=False,
                    ),
                    boot=self.publish_cpu_frequency,
                ),
                MonitorConfig(
                    monitor=Monitor(
                        name="os_version",
                        label="Operating system",
                        description="Host OS and version",
                        endpoint="/system/monitors/os_version",
                        connection_type="mqtt",
                        card_props={"icon": "monitor", "color": "$cyan10"},
                        ephemeral=False,
                    ),
                    boot=self.publish_os_version,
                ),
            ],
            actions=[
                ActionConfig(
                    action=Action(
                        name="print",
                        label="Print to stdout",
                        description="Send a message that the local agent prints to stdout",
                        endpoint=PRINT_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(type="string"),
                        card_props={"icon": "terminal"},
                    ),
                    handler=self.handle_print,
                ),
                ActionConfig(
                    action=Action(
                        name="execute",
                        label="Execute command",
                        description="Run a shell command on the host and return its output",
                        endpoint=EXECUTE_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(type="string"),
                        card_props={"icon": "code", "color": "$red10"},
                        mode="request-reply",
                    ),
                    handler=self.handle_execute,
                ),
                ActionConfig(
                    action=Action(
                        name="list_dir",
                        label="List directory",
                        description="List files in a directory relative to the agent",
                        endpoint=LIST_DIR_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "path": {
                                    "type": "string",
                                    "title": "Directory",
                                    "default": ".",
                                    "description": "Relative path to list",
                                }
                            },
                        ),
                        card_props={"icon": "folder", "color": "$blue9"},
                        mode="request-reply",
                    ),
                    handler=self.handle_list_dir,
                ),
                ActionConfig(
                    action=Action(
                        name="read_file",
                        label="Read file",
                        description="Read a file relative to the agent",
                        endpoint=READ_FILE_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "path": {
                                    "type": "string",
                                    "title": "Path",
                                    "description": "Relative file path",
                                }
                            },
                        ),
                        card_props={"icon": "file-text", "color": "$green9"},
                        mode="request-reply",
                    ),
                    handler=self.handle_read_file,
                ),
                ActionConfig(
                    action=Action(
                        name="write_file",
                        label="Write file",
                        description="Write contents to a file relative to the agent",
                        endpoint=WRITE_FILE_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "path": {
                                    "type": "string",
                                    "title": "Path",
                                    "description": "Relative file path",
                                },
                                "content": {
                                    "type": "string",
                                    "title": "Content",
                                    "description": "Text to write",
                                },
                            },
                        ),
                        card_props={"icon": "edit", "color": "$yellow9"},
                        mode="request-reply",
                    ),
                    handler=self.handle_write_file,
                ),
                ActionConfig(
                    action=Action(
                        name="delete_file",
                        label="Delete file",
                        description="Delete a file relative to the agent",
                        endpoint=DELETE_FILE_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "path": {
                                    "type": "string",
                                    "title": "Path",
                                    "description": "Relative file path",
                                }
                            },
                        ),
                        card_props={"icon": "trash", "color": "$red9"},
                        mode="request-reply",
                    ),
                    handler=self.handle_delete_file,
                ),
                ActionConfig(
                    action=Action(
                        name="mkdir",
                        label="Create directory",
                        description="Create a directory relative to the agent",
                        endpoint=MKDIR_ACTION_ENDPOINT,
                        connection_type="mqtt",
                        payload=ActionPayload(
                            type="json-schema",
                            schema={
                                "path": {
                                    "type": "string",
                                    "title": "Directory",
                                    "description": "Relative directory path",
                                }
                            },
                        ),
                        card_props={"icon": "folder-plus", "color": "$purple9"},
                        mode="request-reply",
                    ),
                    handler=self.handle_mkdir,
                ),
            ],
        )

    def publish_total_memory(self, _ctx, mqtt):
        total = psutil.virtual_memory().total
        mqtt.publish(MEMORY_TOTAL_ENDPOINT, str(total))

    def publish_used_memory(self, _ctx, mqtt):
        used = psutil.virtual_memory().used
        mqtt.publish(MEMORY_USAGE_ENDPOINT, str(used))

    def publish_cpu_model(self, _ctx, mqtt):
        model = _cpu_model()
        mqtt.publish("/system/monitors/cpu_model", model)

    def publish_cpu_cores(self, _ctx, mqtt):
        mqtt.publish("/system/monitors/cpu_cores", str(psutil.cpu_count(logical=True) or 0))

    def publish_cpu_frequency(self, _ctx, mqtt):
        freq = psutil.cpu_freq()
        mhz = freq.current if freq else 0
        mqtt.publish("/system/monitors/cpu_frequency", f"{mhz:.2f}")

    def publish_os_version(self, _ctx, mqtt):
        mqtt.publish("/system/monitors/os_version", f"{platform.system()} {platform.release()}")

    def handle_print(self, msg: ActionEnvelope) -> None:
        raw = (msg.payload or b"").decode("utf-8", errors="ignore").strip()
        if not raw:
            print("[action:print] <empty>")
            return
        try:
            parsed = json.loads(raw)
            print("[action:print] " + json.dumps(parsed, indent=2))
        except Exception:
            print("[action:print] " + raw)

    def handle_execute(self, msg: ActionEnvelope) -> None:
        command = _extract_command((msg.payload or b"").decode("utf-8", errors="ignore"))
        if not command:
            reply_with_error(msg, ValueError("empty command"))
            return
        try:
            completed = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=120,
            )
            response: Dict[str, Any] = {
                "command": command,
                "output": (completed.stdout or "") + (completed.stderr or ""),
                "exitCode": completed.returncode,
            }
            if completed.returncode != 0:
                response["error"] = "process exited with code {}".format(completed.returncode)
            reply_with_data(msg, response)
        except subprocess.TimeoutExpired:
            reply_with_error(msg, TimeoutError("command timed out"))
        except Exception as err:
            reply_with_error(msg, err)

    def handle_list_dir(self, msg: ActionEnvelope) -> None:
        try:
            path_arg = extract_path_from_payload(msg.payload, ["path", "directory"])
            target = resolve_relative_path(str(self.base_dir), path_arg)
            with os.scandir(target) as entries:
                items = [{"name": e.name, "type": entry_type(e)} for e in entries]
            reply_with_data(msg, {"path": path_arg, "items": items})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_read_file(self, msg: ActionEnvelope) -> None:
        try:
            path_arg = extract_path_from_payload(msg.payload, ["path"])
            target = resolve_relative_path(str(self.base_dir), path_arg)
            content = Path(target).read_text()
            reply_with_data(msg, {"path": path_arg, "content": content})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_write_file(self, msg: ActionEnvelope) -> None:
        try:
            data = json.loads((msg.payload or b"{}"))
            path_arg = data.get("path")
            content = data.get("content", "")
            if not path_arg or not isinstance(path_arg, str):
                raise ValueError("payload must be a JSON object with path and content")
            target = resolve_relative_path(str(self.base_dir), path_arg)
            Path(target).parent.mkdir(parents=True, exist_ok=True)
            Path(target).write_text(content)
            reply_with_data(msg, {"path": target_relative(str(self.base_dir), target), "size": len(content)})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_delete_file(self, msg: ActionEnvelope) -> None:
        try:
            path_arg = extract_path_from_payload(msg.payload, ["path"])
            target = resolve_relative_path(str(self.base_dir), path_arg)
            os.remove(target)
            reply_with_data(msg, {"path": path_arg, "deleted": True})
        except Exception as err:
            reply_with_error(msg, err)

    def handle_mkdir(self, msg: ActionEnvelope) -> None:
        try:
            path_arg = extract_path_from_payload(msg.payload, ["path", "directory"])
            target = resolve_relative_path(str(self.base_dir), path_arg)
            Path(target).mkdir(parents=True, exist_ok=True)
            reply_with_data(msg, {"path": path_arg, "created": True})
        except Exception as err:
            reply_with_error(msg, err)


def _extract_command(payload: str) -> str:
    payload = payload.strip()
    if not payload:
        return ""
    if payload.startswith("{"):
        try:
            data = json.loads(payload)
            cmd = data.get("command")
            if isinstance(cmd, str):
                return cmd.strip()
        except Exception:
            return payload
    return payload


def _cpu_model() -> str:
    try:
        with open("/proc/cpuinfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or platform.machine()
