//go:build linux && (arm || arm64)

package subsystems

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/stianeikeland/go-rpio/v4"
	gpiocdev "github.com/warthog618/go-gpiocdev"

	"ventoagent/internal/vento"
)

type gpioBackendKind int

const (
	backendUnknown gpioBackendKind = iota
	backendRPIO
	backendGPIOD
)

var activeBackend = backendUnknown

const (
	gpioChipName      = "gpiochip0"
	gpioConsumerLabel = "ventoagent"
)

type GPIOTemplate struct {
	available bool
}

func NewGPIOTemplate() *GPIOTemplate {
	t := &GPIOTemplate{}

	if !isRaspberryPi() {
		log.Printf("[gpio] Not a Raspberry Pi → GPIO disabled")
		return t
	}

	// Raspberry Pi 5 backend
	if canAccessGPIOD() {
		activeBackend = backendGPIOD
		t.available = true
		log.Printf("[gpio] Using gpiocdev backend (RPi 5)")
		return t
	}

	// RPi 3/4 fallback
	if canAccessRPIO() {
		activeBackend = backendRPIO
		t.available = true
		log.Printf("[gpio] Using rpio backend (/dev/gpiomem)")
		return t
	}

	return t
}

func isRaspberryPi() bool {
	b, _ := os.ReadFile("/proc/cpuinfo")
	s := strings.ToLower(string(b))
	return strings.Contains(s, "raspberry") || strings.Contains(s, "bcm2")
}

func canAccessRPIO() bool {
	if err := rpio.Open(); err != nil {
		return false
	}
	rpio.Close()
	return true
}

func canAccessGPIOD() bool {
	// Request a harmless GPIO (pin 0) as input
	l, err := gpiocdev.RequestLine(
		gpioChipName,
		0,
		gpiocdev.AsInput,
	)
	if err != nil {
		return false
	}
	l.Close()
	return true
}

//
// BUILD ACTIONS
//

func (t *GPIOTemplate) Build(deviceName string) Definition {
	if !t.available {
		return Definition{}
	}

	return Definition{
		Name: "gpio",
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:        "set_mode",
					Label:       "Set Pin Mode",
					Description: "Configure a GPIO pin as input or output",
					Endpoint:    "/gpio/actions/set_mode",
					Mode:        "request-reply",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin":  map[string]any{"type": "number", "default": 17},
							"mode": map[string]any{"type": "string", "default": "output"},
						},
					},
				},
				Handler: handleSetMode,
			},
			{
				Action: vento.Action{
					Name:        "write",
					Label:       "Write Pin",
					Description: "Set GPIO HIGH or LOW",
					Endpoint:    "/gpio/actions/write",
					Mode:        "request-reply",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin":   map[string]any{"type": "number", "default": 17},
							"value": map[string]any{"type": "number", "default": 1},
						},
					},
				},
				Handler: handleWrite,
			},
			{
				Action: vento.Action{
					Name:        "read",
					Label:       "Read Pin",
					Description: "Read GPIO value",
					Endpoint:    "/gpio/actions/read",
					Mode:        "request-reply",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{"type": "number", "default": 17},
						},
					},
				},
				Handler: handleRead,
			},
			{
				Action: vento.Action{
					Name:        "toggle",
					Label:       "Toggle Pin",
					Description: "Toggle GPIO",
					Endpoint:    "/gpio/actions/toggle",
					Mode:        "request-reply",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{"type": "number", "default": 17},
						},
					},
				},
				Handler: handleToggle,
			},
		},
	}
}

//
// ACTION HANDLERS
//

func handleSetMode(msg vento.ActionEnvelope) error {
	var p struct {
		Pin  int    `json:"pin"`
		Mode string `json:"mode"`
	}
	json.Unmarshal(msg.Payload, &p)

	if err := setPinMode(p.Pin, p.Mode); err != nil {
		return replyGPIOError(msg, err.Error())
	}

	return replyGPIOSuccess(msg, map[string]any{"pin": p.Pin, "mode": p.Mode})
}

func handleWrite(msg vento.ActionEnvelope) error {
	var p struct {
		Pin   int `json:"pin"`
		Value int `json:"value"`
	}
	json.Unmarshal(msg.Payload, &p)

	if err := writePin(p.Pin, p.Value); err != nil {
		return replyGPIOError(msg, err.Error())
	}

	return replyGPIOSuccess(msg, map[string]any{"pin": p.Pin, "value": p.Value})
}

func handleRead(msg vento.ActionEnvelope) error {
	var p struct {
		Pin int `json:"pin"`
	}
	json.Unmarshal(msg.Payload, &p)

	v, err := readPin(p.Pin)
	if err != nil {
		return replyGPIOError(msg, err.Error())
	}

	return replyGPIOSuccess(msg, map[string]any{"pin": p.Pin, "value": v})
}

func handleToggle(msg vento.ActionEnvelope) error {
	var p struct {
		Pin int `json:"pin"`
	}
	json.Unmarshal(msg.Payload, &p)

	v, err := readPin(p.Pin)
	if err != nil {
		return replyGPIOError(msg, err.Error())
	}

	newv := 1 - v

	if err := writePin(p.Pin, newv); err != nil {
		return replyGPIOError(msg, err.Error())
	}

	return replyGPIOSuccess(msg, map[string]any{"pin": p.Pin, "value": newv})
}

//
// BACKEND DISPATCH
//

func setPinMode(pin int, mode string) error {
	switch activeBackend {
	case backendGPIOD:
		return setPinModeGPIOD(pin, mode)
	case backendRPIO:
		return setPinModeRPIO(pin, mode)
	default:
		return fmt.Errorf("no GPIO backend")
	}
}

func writePin(pin int, value int) error {
	switch activeBackend {
	case backendGPIOD:
		return writePinGPIOD(pin, value)
	case backendRPIO:
		return writePinRPIO(pin, value)
	default:
		return fmt.Errorf("no GPIO backend")
	}
}

func readPin(pin int) (int, error) {
	switch activeBackend {
	case backendGPIOD:
		return readPinGPIOD(pin)
	case backendRPIO:
		return readPinRPIO(pin)
	default:
		return 0, fmt.Errorf("no GPIO backend")
	}
}

//
// GPIOD BACKEND (RPi 5)
//

func setPinModeGPIOD(pin int, mode string) error {
	if mode == "output" {
		l, err := gpiocdev.RequestLine(gpioChipName, pin, gpiocdev.AsOutput(0))
		if err != nil {
			return err
		}
		l.Close()
		return nil
	}

	l, err := gpiocdev.RequestLine(gpioChipName, pin, gpiocdev.AsInput)
	if err != nil {
		return err
	}
	l.Close()
	return nil
}

func writePinGPIOD(pin int, value int) error {
	initial := 0
	if value != 0 {
		initial = 1
	}

	l, err := gpiocdev.RequestLine(gpioChipName, pin, gpiocdev.AsOutput(initial))
	if err != nil {
		return err
	}
	defer l.Close()

	return l.SetValue(initial)
}

func readPinGPIOD(pin int) (int, error) {
	l, err := gpiocdev.RequestLine(gpioChipName, pin, gpiocdev.AsInput)
	if err != nil {
		return 0, err
	}
	defer l.Close()

	return l.Value()
}

//
// RPIO BACKEND (RPi 3/4)
//

func setPinModeRPIO(pin int, mode string) error {
	if err := rpio.Open(); err != nil {
		return err
	}
	defer rpio.Close()

	g := rpio.Pin(pin)
	if mode == "output" {
		g.Output()
	} else {
		g.Input()
	}

	return nil
}

func writePinRPIO(pin int, value int) error {
	if err := rpio.Open(); err != nil {
		return err
	}
	defer rpio.Close()

	g := rpio.Pin(pin)
	g.Output()
	if value != 0 {
		g.High()
	} else {
		g.Low()
	}
	return nil
}

func readPinRPIO(pin int) (int, error) {
	if err := rpio.Open(); err != nil {
		return 0, err
	}
	defer rpio.Close()

	g := rpio.Pin(pin)
	g.Input()
	return int(g.Read()), nil
}

//
// REPLY HELPERS
//

func replyGPIOSuccess(msg vento.ActionEnvelope, data map[string]any) error {
	b, _ := json.Marshal(data)
	return msg.Reply(b)
}

func replyGPIOError(msg vento.ActionEnvelope, s string) error {
	log.Printf("[gpio] error: %s", s)
	b, _ := json.Marshal(map[string]any{"error": s})
	msg.Reply(b)
	return fmt.Errorf(s)
}
