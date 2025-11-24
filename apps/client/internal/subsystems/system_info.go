package subsystems

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
	vmem "github.com/shirou/gopsutil/v4/mem"

	"ventoagent/internal/vento"
)

type SystemInfoTemplate struct{}

func NewSystemInfoTemplate() Template {
	return &SystemInfoTemplate{}
}

func (t *SystemInfoTemplate) Build(string) Definition {
	return Definition{
		Name: "system",
		Type: "virtual",
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
				Boot: t.publishTotalMemory,
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
				Tick:     t.publishUsedMemory,
			},
			{
				Monitor: vento.Monitor{
					Name:           "cpu_model",
					Label:          "CPU model",
					Description:    "CPU name/model",
					Endpoint:       "/system/monitors/cpu_model",
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "cpu",
						"color": "$orange10",
					},
				},
				Boot: t.publishCPUModel,
			},
			{
				Monitor: vento.Monitor{
					Name:           "cpu_cores",
					Label:          "CPU cores",
					Description:    "Number of logical CPU cores",
					Endpoint:       "/system/monitors/cpu_cores",
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "grid",
						"color": "$purple10",
					},
				},
				Boot: t.publishCPUCores,
			},
			{
				Monitor: vento.Monitor{
					Name:           "cpu_frequency",
					Label:          "CPU frequency",
					Description:    "Current CPU frequency (MHz)",
					Endpoint:       "/system/monitors/cpu_frequency",
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "activity",
						"color": "$pink10",
					},
				},
				Boot: t.publishCPUFrequency,
			},
			{
				Monitor: vento.Monitor{
					Name:           "os_version",
					Label:          "Operating system",
					Description:    "Host OS and version",
					Endpoint:       "/system/monitors/os_version",
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "monitor",
						"color": "$cyan10",
					},
				},
				Boot: t.publishOSVersion,
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
			{
				Action: vento.Action{
					Name:           "execute",
					Label:          "Execute command",
					Description:    "Run a shell command on the host and return its output",
					Endpoint:       vento.ExecuteActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "string",
					},
					CardProps: map[string]any{
						"icon":  "code",
						"color": "$red10",
					},
					Mode: "request-reply",
				},
				Handler: handleExecuteAction,
			},
		},
	}
}

func (t *SystemInfoTemplate) publishCPUModel(ctx context.Context, mqtt *vento.MQTTClient) error {
	info, err := cpu.InfoWithContext(ctx)
	if err != nil || len(info) == 0 {
		return err
	}
	return mqtt.Publish("/system/monitors/cpu_model", info[0].ModelName)
}

func (t *SystemInfoTemplate) publishCPUCores(ctx context.Context, mqtt *vento.MQTTClient) error {
	count, err := cpu.CountsWithContext(ctx, true)
	if err != nil {
		return err
	}
	return mqtt.Publish("/system/monitors/cpu_cores", fmt.Sprintf("%d", count))
}

func (t *SystemInfoTemplate) publishCPUFrequency(ctx context.Context, mqtt *vento.MQTTClient) error {
	info, err := cpu.InfoWithContext(ctx)
	if err != nil || len(info) == 0 {
		return err
	}
	return mqtt.Publish("/system/monitors/cpu_frequency", fmt.Sprintf("%.2f", info[0].Mhz))
}

func (t *SystemInfoTemplate) publishOSVersion(ctx context.Context, mqtt *vento.MQTTClient) error {
	info, err := host.InfoWithContext(ctx)
	if err != nil {
		return err
	}
	return mqtt.Publish("/system/monitors/os_version", fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion))
}

func handlePrintAction(msg vento.ActionEnvelope) error {
	payload := msg.Payload
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

func (t *SystemInfoTemplate) publishTotalMemory(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	return mqtt.Publish(vento.MemoryTotalEndpoint, fmt.Sprintf("%d", stats.Total))
}

func (t *SystemInfoTemplate) publishUsedMemory(ctx context.Context, mqtt *vento.MQTTClient) error {
	stats, err := vmem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return err
	}
	return mqtt.Publish(vento.MemoryUsageEndpoint, fmt.Sprintf("%d", stats.Used))
}

func handleExecuteAction(msg vento.ActionEnvelope) error {
	command := strings.TrimSpace(string(msg.Payload))
	if command == "" {
		if msg.CanReply() {
			return msg.ReplyJSON(map[string]any{
				"error": "empty command",
			})
		}
		return errors.New("empty command")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	shell, args := commandArgs(command)
	cmd := exec.CommandContext(ctx, shell, args...)
	output, err := cmd.CombinedOutput()

	response := map[string]any{
		"command": command,
		"output":  string(output),
	}

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else if ctx.Err() != nil {
			exitCode = -1
		} else {
			exitCode = 1
		}
		response["error"] = err.Error()
	}
	if ctx.Err() != nil {
		response["timeout"] = true
		if ctx.Err() != context.Canceled {
			response["error"] = ctx.Err().Error()
		}
	}
	response["exitCode"] = exitCode

	if msg.CanReply() {
		if err := msg.ReplyJSON(response); err != nil {
			return err
		}
	}
	return err
}

func commandArgs(command string) (string, []string) {
	if runtime.GOOS == "windows" {
		return "cmd", []string{"/C", command}
	}
	return "sh", []string{"-c", command}
}
