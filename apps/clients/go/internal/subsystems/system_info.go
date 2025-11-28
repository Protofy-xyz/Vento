package subsystems

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
	vmem "github.com/shirou/gopsutil/v4/mem"

	"ventoagent/internal/cards"
	"ventoagent/internal/vento"
)

type SystemInfoTemplate struct{}

func NewSystemInfoTemplate() Template {
	return &SystemInfoTemplate{}
}

func (t *SystemInfoTemplate) Build(string) Definition {
	baseDir := getWorkingDir()
	return Definition{
		Name: "system",
		Type: "virtual",
		Monitors: []MonitorConfig{
			// === SISTEMA ===
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
						"color": "$blue10",
						"html":  cards.Text,
						"order": 1,
					},
				},
				Boot: t.publishOSVersion,
			},
			// === CPU ===
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
						"html":  cards.Text,
						"order": 2,
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
						"icon":  "layout-grid",
						"color": "$orange9",
						"order": 3,
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
						"color": "$red10",
						"html":  cards.Frequency,
						"order": 4,
					},
				},
				Boot: t.publishCPUFrequency,
			},
			// === MEMORIA ===
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
						"html":  cards.Bytes,
						"order": 5,
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
						"color": "$green9",
						"html":  cards.Bytes,
						"order": 6,
					},
				},
				Interval: 5 * time.Second,
				Tick:     t.publishUsedMemory,
			},
		},
		Actions: []ActionConfig{
			// === DIRECTORIOS (azul) ===
			{
				Action: vento.Action{
					Name:           "list_dir",
					Label:          "List directory",
					Description:    "List files in a directory relative to the agent",
					Endpoint:       vento.ListDirActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"path": map[string]any{
								"type":        "string",
								"title":       "Directory",
								"default":     ".",
								"description": "Relative path to list",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "folder",
						"color": "$blue10",
						"order": 10,
					},
					Mode: "request-reply",
				},
				Handler: func(m vento.ActionEnvelope) error {
					return handleListDirAction(m, baseDir)
				},
			},
			{
				Action: vento.Action{
					Name:           "mkdir",
					Label:          "Create directory",
					Description:    "Create a directory relative to the agent",
					Endpoint:       vento.MkdirActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"path": map[string]any{
								"type":        "string",
								"title":       "Directory",
								"description": "Relative directory path",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "folder-plus",
						"color": "$blue9",
						"order": 11,
					},
					Mode: "request-reply",
				},
				Handler: func(m vento.ActionEnvelope) error {
					return handleMkdirAction(m, baseDir)
				},
			},
			// === ARCHIVOS (verde/amarillo/rojo) ===
			{
				Action: vento.Action{
					Name:           "read_file",
					Label:          "Read file",
					Description:    "Read a file relative to the agent",
					Endpoint:       vento.ReadFileActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"path": map[string]any{
								"type":        "string",
								"title":       "Path",
								"description": "Relative file path",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "file-text",
						"color": "$green10",
						"order": 12,
					},
					Mode: "request-reply",
				},
				Handler: func(m vento.ActionEnvelope) error {
					return handleReadFileAction(m, baseDir)
				},
			},
			{
				Action: vento.Action{
					Name:           "write_file",
					Label:          "Write file",
					Description:    "Write contents to a file relative to the agent",
					Endpoint:       vento.WriteFileActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"path": map[string]any{
								"type":        "string",
								"title":       "Path",
								"description": "Relative file path",
							},
							"content": map[string]any{
								"type":        "string",
								"title":       "Content",
								"description": "Text to write",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "pencil",
						"color": "$yellow10",
						"order": 13,
					},
					Mode: "request-reply",
				},
				Handler: func(m vento.ActionEnvelope) error {
					return handleWriteFileAction(m, baseDir)
				},
			},
			{
				Action: vento.Action{
					Name:           "delete_file",
					Label:          "Delete file",
					Description:    "Delete a file relative to the agent",
					Endpoint:       vento.DeleteFileActionEndpoint,
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"path": map[string]any{
								"type":        "string",
								"title":       "Path",
								"description": "Relative file path",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "trash",
						"color": "$red10",
						"order": 14,
					},
					Mode: "request-reply",
				},
				Handler: func(m vento.ActionEnvelope) error {
					return handleDeleteFileAction(m, baseDir)
				},
			},
			// === SISTEMA (naranja/púrpura) ===
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
						"icon":  "terminal",
						"color": "$orange10",
						"order": 15,
					},
					Mode: "request-reply",
				},
				Handler: handleExecuteAction,
			},
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
						"icon":  "message-square",
						"color": "$purple10",
						"order": 16,
					},
				},
				Handler: handlePrintAction,
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
	command := extractCommand(string(msg.Payload))
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

func extractCommand(payload string) string {
	trimmed := strings.TrimSpace(payload)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "{") {
		var data map[string]any
		if err := json.Unmarshal([]byte(trimmed), &data); err == nil {
			if cmd, ok := data["command"].(string); ok {
				return strings.TrimSpace(cmd)
			}
		}
	}
	return trimmed
}

func handleListDirAction(msg vento.ActionEnvelope, base string) error {
	pathArg, err := extractPathFromPayload(msg.Payload, "path", "directory")
	if err != nil {
		return replyWithError(msg, err)
	}

	target, err := resolveRelativePath(base, pathArg)
	if err != nil {
		return replyWithError(msg, err)
	}

	entries, err := os.ReadDir(target)
	if err != nil {
		return replyWithError(msg, err)
	}
	items := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		item := map[string]any{
			"name": entry.Name(),
			"type": entryType(entry),
		}
		items = append(items, item)
	}
	return replyWithData(msg, map[string]any{
		"path":  pathArg,
		"items": items,
	})
}

func handleReadFileAction(msg vento.ActionEnvelope, base string) error {
	pathArg, err := extractPathFromPayload(msg.Payload, "path")
	if err != nil {
		return replyWithError(msg, err)
	}
	target, err := resolveRelativePath(base, pathArg)
	if err != nil {
		return replyWithError(msg, err)
	}
	data, err := os.ReadFile(target)
	if err != nil {
		return replyWithError(msg, err)
	}
	return replyWithData(msg, map[string]any{
		"path":    pathArg,
		"content": string(data),
	})
}

func handleWriteFileAction(msg vento.ActionEnvelope, base string) error {
	var payload struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil || strings.TrimSpace(payload.Path) == "" {
		return replyWithError(msg, errors.New("payload must be a JSON object with path and content"))
	}
	target, err := resolveRelativePath(base, payload.Path)
	if err != nil {
		return replyWithError(msg, err)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return replyWithError(msg, err)
	}
	if err := os.WriteFile(target, []byte(payload.Content), 0o644); err != nil {
		return replyWithError(msg, err)
	}
	return replyWithData(msg, map[string]any{
		"path": targetRelative(base, target),
		"size": len(payload.Content),
	})
}

func handleDeleteFileAction(msg vento.ActionEnvelope, base string) error {
	pathArg, err := extractPathFromPayload(msg.Payload, "path")
	if err != nil {
		return replyWithError(msg, err)
	}
	target, err := resolveRelativePath(base, pathArg)
	if err != nil {
		return replyWithError(msg, err)
	}
	if err := os.Remove(target); err != nil {
		return replyWithError(msg, err)
	}
	return replyWithData(msg, map[string]any{
		"path":    pathArg,
		"deleted": true,
	})
}

func handleMkdirAction(msg vento.ActionEnvelope, base string) error {
	pathArg, err := extractPathFromPayload(msg.Payload, "path", "directory")
	if err != nil {
		return replyWithError(msg, err)
	}
	target, err := resolveRelativePath(base, pathArg)
	if err != nil {
		return replyWithError(msg, err)
	}
	if err := os.MkdirAll(target, 0o755); err != nil {
		return replyWithError(msg, err)
	}
	return replyWithData(msg, map[string]any{
		"path":    pathArg,
		"created": true,
	})
}

func extractPathFromPayload(payload []byte, keys ...string) (string, error) {
	trimmed := strings.TrimSpace(string(payload))
	if trimmed == "" {
		return ".", nil
	}
	if trimmed[0] != '{' {
		return trimmed, nil
	}
	var data map[string]any
	if err := json.Unmarshal(payload, &data); err != nil {
		return "", err
	}
	for _, key := range keys {
		if value, ok := data[key]; ok {
			if str, ok := value.(string); ok {
				return str, nil
			}
		}
	}
	return "", fmt.Errorf("payload missing required path field (%v)", keys)
}

func resolveRelativePath(base, rel string) (string, error) {
	if strings.TrimSpace(rel) == "" {
		rel = "."
	}
	if filepath.IsAbs(rel) {
		return filepath.Clean(rel), nil
	}
	cleaned := filepath.Clean(rel)
	return filepath.Join(base, cleaned), nil
}

func targetRelative(base, full string) string {
	rel, err := filepath.Rel(base, full)
	if err != nil {
		return full
	}
	return rel
}

func entryType(entry fs.DirEntry) string {
	if entry.IsDir() {
		return "directory"
	}
	return "file"
}

func replyWithError(msg vento.ActionEnvelope, err error) error {
	if msg.CanReply() {
		_ = msg.ReplyJSON(map[string]any{
			"error": err.Error(),
		})
	}
	return err
}

func replyWithData(msg vento.ActionEnvelope, data map[string]any) error {
	if msg.CanReply() {
		return msg.ReplyJSON(data)
	}
	return nil
}

func getWorkingDir() string {
	if dir, err := os.Getwd(); err == nil {
		return dir
	}
	return "."
}
