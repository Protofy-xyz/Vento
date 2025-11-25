import argparse
import getpass
import logging
import sys

from config import ConfigManager, generate_device_name
from agent import Agent
from vento_client import VentoClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vento Raspberry Pi agent (Python)")
    parser.add_argument("--config", default="config.json", help="ruta al config (default: config.json)")
    parser.add_argument("--host", help="host de Vento (ej: http://localhost:8000)")
    parser.add_argument("--user", help="usuario de Vento")
    parser.add_argument("--password", help="password (si falta, se pedira)")
    parser.add_argument("--device", help="nombre del dispositivo a registrar")
    parser.add_argument("--interval", type=int, help="intervalo de monitores en segundos")
    parser.add_argument("--token", help="token ya existente para saltar login")
    parser.add_argument("--skip-register-actions", action="store_true", help="no invocar /devices/registerActions tras crear el device")
    parser.add_argument("--once", action="store_true", help="publica monitores de arranque y sale")
    return parser.parse_args()


def prompt(text: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{text}{suffix}: ").strip()
    return value or default


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    manager = ConfigManager(args.config)
    cfg = manager.load()
    cfg.apply_overrides(
        host=args.host,
        username=args.user,
        device_name=args.device,
        token=args.token,
        monitor_interval=args.interval,
    )

    if not cfg.host:
        cfg.host = prompt("Vento host (ej: http://localhost:8000)", "http://localhost:8000")
    if not cfg.username:
        cfg.username = prompt("Vento username", cfg.username or "admin")

    if not cfg.device_name:
        cfg.device_name = generate_device_name()
        logging.info("generated device name: %s", cfg.device_name)

    manager.save(cfg)

    try:
        vento_client = VentoClient(cfg.host)
    except Exception as err:
        logging.error("invalid host %s: %s", cfg.host, err)
        sys.exit(1)

    if not cfg.token:
        password = args.password or getpass.getpass("Vento password: ")
        try:
            resp = vento_client.login(cfg.username, password)
        except Exception as err:
            logging.error("login failed: %s", err)
            sys.exit(1)
        cfg.token = resp.token
        manager.save(cfg)
        logging.info("authenticated successfully")
    else:
        logging.info("using token from config")

    agent = Agent(cfg, vento_client, skip_register_actions=args.skip_register_actions, run_once=args.once)
    try:
        agent.start()
    except KeyboardInterrupt:
        agent.stop()
    except Exception as err:
        logging.error("agent error: %s", err)
        sys.exit(1)


if __name__ == "__main__":
    main()
