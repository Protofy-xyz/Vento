# **Vento Raspberry Pi Agent (Python)**

Python agent inspired by `apps/clients/go` (Go).
It registers the device in Vento, connects to the local MQTT broker (port 1883), and exposes the same monitors/actions as the Go agent — plus Raspberry Pi GPIO control.

## **Features**

* Persistent configuration in `config.json` (host, user, token, device name, interval).
* Login against `/api/core/v1/auth/login`, and device creation/update with its full subsystem payload.
* Monitor publishing: total/used memory periodically, CPU model/cores/frequency, OS version.
* Actions: print text, execute shell commands, list/read/write/delete files, create directories.
* `gpio` subsystem (BCM pin numbering) for `set_pin` and `read_pin`.
  Only enabled on Raspberry Pi; returns a friendly error if GPIO support is unavailable.

## **Requirements**

* Python 3.10+
* Dependencies: `requests`, `paho-mqtt`, `psutil`, `python-periphery` (for GPIO on Raspberry Pi 5)

Quick install:

```bash
cd apps/clients/python
python -m venv .venv
. .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
# On Raspberry Pi:
pip install python-periphery
```

## **Run**

```bash
python main.py --host http://localhost:8000 --user admin
```

Useful flags:

* `--config` path to config file (default: `config.json`)
* `--password` or leave empty to prompt interactively
* `--device` to force device name
* `--interval` to override monitor interval
* `--token` if you already have a token and want to skip login
* `--skip-register-actions` skips the `/devices/registerActions` call after device creation
* `--once` publishes startup monitors once and exits (no loop)

## **GPIO Notes**

* Uses BCM numbering.
* Detects Raspberry Pi by checking `/proc/device-tree/model` and CPU architecture.
* If GPIO support is unavailable, GPIO actions reply over MQTT with a clear, user-friendly error.
