import json
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urljoin, urlencode, urlparse

import requests


class APIError(Exception):
    def __init__(self, status_code: int, body: str = "") -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(f"vento api error {status_code}: {body}".strip())


@dataclass
class LoginResponse:
    token: str


class VentoClient:
    def __init__(self, base_url: str) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        parsed = urlparse(base_url)
        if not parsed.scheme:
            parsed = urlparse("http://" + base_url)
        self.base_url = parsed.geturl().rstrip("/")
        self.http = requests.Session()
        self.http.headers.update({"Content-Type": "application/json"})

    def login(self, username: str, password: str) -> LoginResponse:
        payload = {"username": username, "password": password}
        data = self._do_json("POST", "/api/core/v1/auth/login", "", payload)
        token = data.get("session", {}).get("token")
        if not token:
            raise APIError(500, "login succeeded but token missing")
        return LoginResponse(token=token)

    def device_exists(self, token: str, device_name: str) -> bool:
        try:
            self._do_json("GET", f"/api/core/v1/devices/{device_name}", token, None)
            return True
        except APIError as err:
            if err.status_code == 404:
                return False
            raise

    def register_device(self, token: str, payload: Dict[str, Any]) -> None:
        self._do_json("POST", "/api/core/v1/devices", token, payload)

    def update_device(self, token: str, device_name: str, payload: Dict[str, Any]) -> None:
        self._do_json("POST", f"/api/core/v1/devices/{device_name}", token, payload)

    def set_subsystems(self, token: str, device_name: str, subs: list[dict[str, Any]]) -> None:
        self.update_device(token, device_name, {"subsystem": subs})

    def trigger_register_actions(self, token: str) -> None:
        """Deprecated: Use regenerate_board_for_device for single device regeneration."""
        self._do_json("GET", "/api/core/v1/devices/registerActions", token, None)

    def regenerate_board_for_device(self, token: str, device_name: str) -> None:
        """Regenerate the board for a specific device."""
        self._do_json("GET", f"/api/core/v1/devices/{device_name}/regenerateBoard", token, None)

    def hostname(self) -> str:
        return urlparse(self.base_url).hostname or "localhost"

    def _do_json(self, method: str, path: str, token: str, body: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            url = url + ("&" if "?" in url else "?") + urlencode({"token": token})
        resp = self.http.request(method, url, data=json.dumps(body) if body is not None else None, headers=headers, timeout=15)
        if resp.status_code >= 400:
            raise APIError(resp.status_code, resp.text.strip())
        if not resp.text:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}
