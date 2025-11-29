package subsystems

import (
	"encoding/json"
	"fmt"
	"strings"

	"ventoagent/internal/vento"
)

// StdoutPrintTemplate demonstrates an action-only subsystem.
// Clone this file to implement other command-style subsystems.
type StdoutPrintTemplate struct{}

func NewStdoutPrintTemplate() Template {
	return &StdoutPrintTemplate{}
}

func (t *StdoutPrintTemplate) Build(string) Definition {
	return Definition{
		Name: vento.PrinterSubsystemName,
		Type: "virtual",
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:           "print",
					Label:          "Print to stdout",
					Description:    "Send a message that the local agent prints to stdout",
					Endpoint:       vento.PrintActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"message": map[string]any{
								"type":        "string",
								"title":       "Message",
								"description": "Text to print to stdout",
							},
						},
					},
					CardProps: map[string]any{
						"icon": "terminal",
					},
				},
				Handler: t.handlePrint,
			},
		},
	}
}

func (t *StdoutPrintTemplate) handlePrint(msg vento.ActionEnvelope) error {
	message := extractMessageFromPayload(string(msg.Payload))
	if message == "" {
		fmt.Println("[action:print] <empty>")
		return nil
	}
	fmt.Printf("[action:print] %s\n", message)
	return nil
}

func extractMessageFromPayload(payload string) string {
	trimmed := strings.TrimSpace(payload)
	if trimmed == "" {
		return ""
	}
	// Try to parse as JSON and extract "message" field
	if strings.HasPrefix(trimmed, "{") {
		var data map[string]any
		if err := json.Unmarshal([]byte(trimmed), &data); err == nil {
			if msg, ok := data["message"].(string); ok {
				return strings.TrimSpace(msg)
			}
		}
	}
	// Fallback to raw string
	return trimmed
}
