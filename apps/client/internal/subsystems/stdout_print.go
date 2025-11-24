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
						Type: "string",
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

func (t *StdoutPrintTemplate) handlePrint(payload []byte) error {
	trimmed := strings.TrimSpace(string(payload))
	if trimmed == "" {
		fmt.Println("[action:print] <empty>")
		return nil
	}
	var asJSON any
	if json.Unmarshal(payload, &asJSON) == nil {
		if formatted, err := json.MarshalIndent(asJSON, "", "  "); err == nil {
			fmt.Printf("[action:print] %s\n", formatted)
			return nil
		}
	}
	fmt.Printf("[action:print] %s\n", trimmed)
	return nil
}
