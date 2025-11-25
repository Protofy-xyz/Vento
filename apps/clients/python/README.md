# Vento Raspberry Pi agent (Python)

Agente en Python inspirado en `apps/client` (Go). Registra el dispositivo en Vento, se conecta al broker MQTT local (puerto 1883) y expone los mismos monitores/acciones que el agente Go, sumando control de pines GPIO en Raspberry Pi.

## Caracteristicas
- Configuracion persistente en `config.json` (host, usuario, token, nombre de dispositivo, intervalo).
- Login contra `/api/core/v1/auth/login` y actualizacion/creacion del dispositivo con su payload completo de subsistemas.
- Publicacion de monitores: memoria total y uso periodico, modelo/cores/frecuencia de CPU y version de OS.
- Acciones: imprimir, ejecutar comandos, listar/leer/escribir/borrar archivos y crear directorios.
- Subsistema `gpio` (BCM) para `set_pin` y `read_pin`, activo solo en Raspberry Pi; responde con error amigable si el modulo GPIO no esta disponible.

## Requisitos
- Python 3.10+.
- Dependencias: `requests`, `paho-mqtt`, `psutil`, `python-periphery` (GPIO en Raspberry Pi 5).

Instalacion rapida:
```bash
cd apps/clients/python
python -m venv .venv
. .venv/bin/activate  # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
# En Raspberry Pi:
pip install python-periphery
```

## Ejecucion
```bash
python main.py --host http://localhost:8000 --user admin
```

Flags utiles:
- `--config` ruta del config (default `config.json`).
- `--password` o deja vacio para que pida por consola.
- `--device` para forzar nombre.
- `--interval` para override del intervalo de monitores.
- `--token` si ya tienes un token y quieres saltar el login.
- `--skip-register-actions` evita llamar a `/devices/registerActions` tras crear el device.
- `--once` publica monitores de arranque y sale (sin loop).

## Notas sobre GPIO
- Usa numeracion BCM.
- Detecta Raspberry Pi revisando `/proc/device-tree/model` y la arquitectura.
- Si no hay soporte GPIO, las acciones responden con un error claro en el reply MQTT.
