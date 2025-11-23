package subsystems

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	vmem "github.com/shirou/gopsutil/v4/mem"

	"ventoagent/internal/vento"
)

// SystemMemoryTemplate is an example of a monitor-heavy subsystem.
// Copy this file to add more hardware monitors or metrics.
type SystemMemoryTemplate struct{}

func NewSystemMemoryTemplate(time.Duration) Template {
	return &SystemMemoryTemplate{}
}

func (t *SystemMemoryTemplate) Build(string) Definition {
	return Definition{
		Name: vento.SystemSubsystemName,
		Type: vento.SystemSubsystemType,
		Monitors: []MonitorConfig{
			{
				Monitor: vento.Monitor{
					Name:           "memory_total",
					Label:          "Total memory",
					Description:    "Total physical memory detected when the agent booted",
					Units:          "bytes",
					Endpoint:       vento.MemoryTotalEndpoint,
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "database",
						"color": "$green10",
					},
				},
				Boot: t.publishTotal,
			},
			{
				Monitor: vento.Monitor{
					Name:           "memory_used",
					Label:          "Used memory",
					Description:    "Periodically reported RAM usage",
					Units:          "bytes",
					Endpoint:       vento.MemoryUsageEndpoint,
					ConnectionType: "mqtt",
					Ephemeral:      true,
					CardProps: map[string]any{
						"icon":  "activity",
						"color": "$blue10",
					},
				},
				Interval: 5 * time.Second,
				Tick:     t.publishUsage,
			},
		},
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
				Handler: handlePrintAction,
			},
		},
	}
}

func (t *SystemMemoryTemplate) publishTotal(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	return mqtt.Publish(vento.MemoryTotalEndpoint, fmt.Sprintf("%d", stats.Total))
}

func (t *SystemMemoryTemplate) publishUsage(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	return mqtt.Publish(vento.MemoryUsageEndpoint, fmt.Sprintf("%d", stats.Used))
}

func humanizeBytes(v uint64) string {
	if v == 0 {
		return "0 B"
	}
	const unit = 1024
	sizes := []string{"B", "KB", "MB", "GB", "TB", "PB"}
	i := math.Floor(math.Log(float64(v)) / math.Log(unit))
	if int(i) >= len(sizes) {
		i = float64(len(sizes) - 1)
	}
	value := float64(v) / math.Pow(unit, i)
	return fmt.Sprintf("%.2f %s", value, sizes[int(i)])
}

func handlePrintAction(payload []byte) error {
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
