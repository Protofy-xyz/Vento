import json
import os
import pathlib
import platform
from typing import Any, Dict, Iterable, Optional

from mqtt_client import ActionEnvelope


def reply_with_error(msg: ActionEnvelope, err: Exception) -> Exception:
    if msg.can_reply():
        try:
            msg.reply_json({"error": str(err)})
        except Exception:
            pass
    return err


def reply_with_data(msg: ActionEnvelope, data: Dict[str, Any]) -> None:
    if msg.can_reply():
        msg.reply_json(data)


def extract_path_from_payload(payload: bytes, keys: Iterable[str]) -> str:
    raw = (payload or b"").decode("utf-8", errors="ignore").strip()
    if not raw:
        return "."
    if not raw.startswith("{"):
        return raw
    data = json.loads(raw)
    for key in keys:
        value = data.get(key)
        if isinstance(value, str):
            return value
    raise ValueError(f"payload missing required path field ({', '.join(keys)})")


def resolve_relative_path(base: str, rel: str) -> str:
    rel = rel.strip() or "."
    if os.path.isabs(rel):
        return os.path.abspath(rel)
    return os.path.abspath(os.path.join(base, rel))


def target_relative(base: str, full: str) -> str:
    try:
        return str(pathlib.Path(full).relative_to(base))
    except Exception:
        return full


def entry_type(entry: os.DirEntry) -> str:
    try:
        if entry.is_dir():
            return "directory"
    except Exception:
        pass
    return "file"


def is_raspberry_pi() -> bool:
    if platform.system().lower() != "linux":
        return False
    arch = platform.machine().lower()
    if not arch.startswith("arm") and arch not in ("aarch64", "arm64"):
        return False
    candidates = [
        "/proc/device-tree/model",
        "/sys/firmware/devicetree/base/model",
    ]
    for path in candidates:
        try:
            text = pathlib.Path(path).read_text().lower()
            if "raspberry pi" in text:
                return True
        except Exception:
            continue
    if pathlib.Path("/usr/bin/raspi-config").exists():
        return True
    return False
