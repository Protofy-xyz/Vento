package subsystems

import (
	"context"
	"fmt"
	"math"
	"time"

	vmem "github.com/shirou/gopsutil/v4/mem"

	"ventoagent/internal/vento"
)

// SystemMemoryTemplate is an example of a monitor-heavy subsystem.
// Copy this file to add more hardware monitors or metrics.
type SystemMemoryTemplate struct {
	interval time.Duration
}

func NewSystemMemoryTemplate(interval time.Duration) Template {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &SystemMemoryTemplate{interval: interval}
}

func (t *SystemMemoryTemplate) Build(string) Definition {
	return Definition{
		Name: vento.SystemSubsystemName,
		Type: vento.SystemSubsystemType,
		Monitors: []MonitorConfig{
			{
				Monitor: vento.Monitor{
					Name:           "memory_total",
					Label:          "Installed RAM",
					Description:    "Total physical memory detected when the agent booted",
					Units:          "bytes",
					Endpoint:       vento.MemoryTotalEndpoint,
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "hard-drive",
						"color": "$green10",
					},
				},
				Boot: t.publishTotal,
			},
			{
				Monitor: vento.Monitor{
					Name:           "memory_used",
					Label:          "Used RAM",
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
				Interval: t.interval,
				Tick:     t.publishUsage,
			},
		},
	}
}

func (t *SystemMemoryTemplate) publishTotal(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	payload := map[string]any{
		"bytes":     stats.Total,
		"human":     humanizeBytes(stats.Total),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	return mqtt.Publish(vento.MemoryTotalEndpoint, payload)
}

func (t *SystemMemoryTemplate) publishUsage(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	payload := map[string]any{
		"bytes":     stats.Used,
		"human":     humanizeBytes(stats.Used),
		"percent":   math.Round(stats.UsedPercent*100) / 100,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	return mqtt.Publish(vento.MemoryUsageEndpoint, payload)
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
