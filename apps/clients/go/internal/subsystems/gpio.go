//go:build linux && (arm || arm64)

package subsystems

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/stianeikeland/go-rpio/v4"

	"ventoagent/internal/vento"
)

// GPIOTemplate creates GPIO subsystem for Raspberry Pi
type GPIOTemplate struct {
	available bool
}

// NewGPIOTemplate creates a new GPIO template
func NewGPIOTemplate() *GPIOTemplate {
	tpl := &GPIOTemplate{}
	tpl.available = isRaspberryPi() && canAccessGPIO()
	if tpl.available {
		log.Printf("[gpio] Raspberry Pi GPIO available")
	} else {
		log.Printf("[gpio] GPIO not available (not a Raspberry Pi or no access)")
	}
	return tpl
}

// isRaspberryPi checks if we're running on a Raspberry Pi
func isRaspberryPi() bool {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return false
	}
	content := strings.ToLower(string(data))
	return strings.Contains(content, "raspberry") || strings.Contains(content, "bcm2")
}

// canAccessGPIO checks if we can access GPIO
func canAccessGPIO() bool {
	err := rpio.Open()
	if err != nil {
		return false
	}
	rpio.Close()
	return true
}

// Build returns the GPIO Definition
func (t *GPIOTemplate) Build(deviceName string) Definition {
	if !t.available {
		return Definition{}
	}

	return Definition{
		Name: "gpio",
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:           "set_mode",
					Label:          "Set Pin Mode",
					Description:    "Configure a GPIO pin as input or output",
					Endpoint:       "/gpio/actions/set_mode",
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 5000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{
								"type":        "number",
								"description": "GPIO pin number (BCM)",
								"default":     17,
							},
							"mode": map[string]any{
								"type":        "string",
								"description": "Pin mode: input or output",
								"default":     "output",
								"enum":        []string{"input", "output"},
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "settings",
						"color": "$orange10",
						"order": 120,
					},
				},
				Handler: handleSetMode,
			},
			{
				Action: vento.Action{
					Name:           "write",
					Label:          "Write Pin",
					Description:    "Set a GPIO pin HIGH or LOW",
					Endpoint:       "/gpio/actions/write",
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 5000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{
								"type":        "number",
								"description": "GPIO pin number (BCM)",
								"default":     17,
							},
							"value": map[string]any{
								"type":        "number",
								"description": "Pin value: 0 (LOW) or 1 (HIGH)",
								"default":     1,
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "zap",
						"color": "$green10",
						"order": 121,
					},
				},
				Handler: handleWrite,
			},
			{
				Action: vento.Action{
					Name:           "read",
					Label:          "Read Pin",
					Description:    "Read the current state of a GPIO pin",
					Endpoint:       "/gpio/actions/read",
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 5000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{
								"type":        "number",
								"description": "GPIO pin number (BCM)",
								"default":     17,
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "eye",
						"color": "$blue10",
						"order": 122,
					},
				},
				Handler: handleRead,
			},
			{
				Action: vento.Action{
					Name:           "toggle",
					Label:          "Toggle Pin",
					Description:    "Toggle a GPIO pin state",
					Endpoint:       "/gpio/actions/toggle",
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 5000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{
								"type":        "number",
								"description": "GPIO pin number (BCM)",
								"default":     17,
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "refresh-cw",
						"color": "$purple10",
						"order": 123,
					},
				},
				Handler: handleToggle,
			},
			{
				Action: vento.Action{
					Name:           "pwm",
					Label:          "PWM Output",
					Description:    "Set PWM duty cycle on a pin (hardware PWM on pins 12, 13, 18, 19)",
					Endpoint:       "/gpio/actions/pwm",
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 5000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"pin": map[string]any{
								"type":        "number",
								"description": "GPIO pin number (BCM) - hardware PWM on 12, 13, 18, 19",
								"default":     18,
							},
							"duty": map[string]any{
								"type":        "number",
								"description": "Duty cycle 0-100",
								"default":     50,
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "activity",
						"color": "$yellow10",
						"order": 124,
					},
				},
				Handler: handlePWM,
			},
		},
	}
}

func handleSetMode(msg vento.ActionEnvelope) error {
	var params struct {
		Pin  int    `json:"pin"`
		Mode string `json:"mode"`
	}
	params.Pin = 17
	params.Mode = "output"

	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &params)
	}

	if err := rpio.Open(); err != nil {
		return replyGPIOError(msg, "failed to open GPIO: "+err.Error())
	}
	defer rpio.Close()

	pin := rpio.Pin(params.Pin)
	
	switch strings.ToLower(params.Mode) {
	case "input":
		pin.Input()
	case "output":
		pin.Output()
	default:
		return replyGPIOError(msg, "invalid mode: "+params.Mode)
	}

	log.Printf("[gpio] pin %d set to %s", params.Pin, params.Mode)
	return replyGPIOSuccess(msg, map[string]any{
		"pin":    params.Pin,
		"mode":   params.Mode,
		"status": "configured",
	})
}

func handleWrite(msg vento.ActionEnvelope) error {
	var params struct {
		Pin   int `json:"pin"`
		Value int `json:"value"`
	}
	params.Pin = 17
	params.Value = 1

	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &params)
	}

	if err := rpio.Open(); err != nil {
		return replyGPIOError(msg, "failed to open GPIO: "+err.Error())
	}
	defer rpio.Close()

	pin := rpio.Pin(params.Pin)
	pin.Output()
	
	if params.Value != 0 {
		pin.High()
	} else {
		pin.Low()
	}

	log.Printf("[gpio] pin %d set to %d", params.Pin, params.Value)
	return replyGPIOSuccess(msg, map[string]any{
		"pin":    params.Pin,
		"value":  params.Value,
		"status": "written",
	})
}

func handleRead(msg vento.ActionEnvelope) error {
	var params struct {
		Pin int `json:"pin"`
	}
	params.Pin = 17

	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &params)
	}

	if err := rpio.Open(); err != nil {
		return replyGPIOError(msg, "failed to open GPIO: "+err.Error())
	}
	defer rpio.Close()

	pin := rpio.Pin(params.Pin)
	value := pin.Read()

	log.Printf("[gpio] pin %d read: %d", params.Pin, value)
	return replyGPIOSuccess(msg, map[string]any{
		"pin":   params.Pin,
		"value": int(value),
	})
}

func handleToggle(msg vento.ActionEnvelope) error {
	var params struct {
		Pin int `json:"pin"`
	}
	params.Pin = 17

	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &params)
	}

	if err := rpio.Open(); err != nil {
		return replyGPIOError(msg, "failed to open GPIO: "+err.Error())
	}
	defer rpio.Close()

	pin := rpio.Pin(params.Pin)
	pin.Output()
	pin.Toggle()
	
	newValue := pin.Read()

	log.Printf("[gpio] pin %d toggled to %d", params.Pin, newValue)
	return replyGPIOSuccess(msg, map[string]any{
		"pin":   params.Pin,
		"value": int(newValue),
	})
}

func handlePWM(msg vento.ActionEnvelope) error {
	var params struct {
		Pin  int `json:"pin"`
		Duty int `json:"duty"`
	}
	params.Pin = 18
	params.Duty = 50

	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &params)
	}

	if params.Duty < 0 {
		params.Duty = 0
	}
	if params.Duty > 100 {
		params.Duty = 100
	}

	if err := rpio.Open(); err != nil {
		return replyGPIOError(msg, "failed to open GPIO: "+err.Error())
	}
	defer rpio.Close()

	pin := rpio.Pin(params.Pin)
	pin.Mode(rpio.Pwm)
	pin.Freq(64000) // 64kHz base frequency
	pin.DutyCycle(uint32(params.Duty), 100)

	log.Printf("[gpio] pin %d PWM duty: %d%%", params.Pin, params.Duty)
	return replyGPIOSuccess(msg, map[string]any{
		"pin":    params.Pin,
		"duty":   params.Duty,
		"status": "pwm_set",
	})
}

func replyGPIOSuccess(msg vento.ActionEnvelope, data map[string]any) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return msg.Reply(jsonBytes)
}

func replyGPIOError(msg vento.ActionEnvelope, errMsg string) error {
	log.Printf("[gpio] error: %s", errMsg)
	data := map[string]any{"error": errMsg}
	jsonBytes, _ := json.Marshal(data)
	msg.Reply(jsonBytes)
	return fmt.Errorf(errMsg)
}

