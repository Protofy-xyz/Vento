import json
import os
import re
import secrets
import string
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

DEFAULT_MONITOR_INTERVAL = 30


@dataclass
class Config:
    host: str = ""
    username: str = ""
    token: str = ""
    device_name: str = ""
    monitor_interval_seconds: int = DEFAULT_MONITOR_INTERVAL

    def normalize(self) -> None:
        self.host = (self.host or "").strip()
        if self.host and not self.host.startswith(("http://", "https://")):
            self.host = "http://" + self.host
        self.host = self.host.rstrip("/")
        self.username = (self.username or "").strip()
        self.token = (self.token or "").strip()
        self.device_name = (self.device_name or "").strip()
        if self.monitor_interval_seconds <= 0:
            self.monitor_interval_seconds = DEFAULT_MONITOR_INTERVAL

    def apply_overrides(
        self,
        host: Optional[str] = None,
        username: Optional[str] = None,
        device_name: Optional[str] = None,
        token: Optional[str] = None,
        monitor_interval: Optional[int] = None,
    ) -> None:
        if host:
            self.host = host
        if username:
            self.username = username
        if device_name:
            self.device_name = device_name
        if token:
            self.token = token
        if monitor_interval and monitor_interval > 0:
            self.monitor_interval_seconds = monitor_interval


class ConfigManager:
    def __init__(self, path: str) -> None:
        self.path = Path(path or "config.json")

    def load(self) -> Config:
        cfg = Config()
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text() or "{}")
                cfg = Config(**data)
            except Exception:
                # fall back to defaults if the file is corrupted
                cfg = Config()
        cfg.normalize()
        return cfg

    def save(self, cfg: Config) -> None:
        cfg.normalize()
        payload = json.dumps(cfg.__dict__, indent=2)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.path.with_suffix(f"{self.path.suffix}.tmp.{int(time.time() * 1_000_000)}")
        tmp_path.write_text(payload)
        tmp_path.replace(self.path)


hostname_cleaner = re.compile(r"[^a-z0-9_]+")


def generate_device_name() -> str:
    host = (os.uname().nodename if hasattr(os, "uname") else os.getenv("COMPUTERNAME", "device")).lower()
    host = hostname_cleaner.sub("_", host).strip("_") or "device"
    rand = "".join(secrets.choice(string.hexdigits.lower()) for _ in range(4))
    return f"{host}_{rand}"
