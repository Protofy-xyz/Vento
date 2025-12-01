//go:build linux || windows
// +build linux windows

package subsystems

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"sync"
	"time"

	"github.com/0xcafed00d/joystick"

	"ventoagent/internal/vento"
)

// GamepadMultiTemplate creates one subsystem per connected gamepad at startup.
type GamepadMultiTemplate struct{}

// MaxGamepads is the maximum number of gamepads to scan for.
const MaxGamepads = 8

func NewGamepadMultiTemplate() MultiTemplate {
	return &GamepadMultiTemplate{}
}

// BuildAll scans for connected gamepads and creates a subsystem for each one.
func (t *GamepadMultiTemplate) BuildAll(deviceName string) []Definition {
	var definitions []Definition

	for id := 0; id < MaxGamepads; id++ {
		js, err := joystick.Open(id)
		if err != nil {
			continue // Gamepad not connected at this ID
		}

		name := js.Name()
		axisCount := js.AxisCount()
		buttonCount := js.ButtonCount()
		js.Close()

		log.Printf("[gamepad] found gamepad %d: %s (%d axes, %d buttons)", id, name, axisCount, buttonCount)

		// Create a subsystem for this gamepad
		def := buildGamepadDefinition(id, name, axisCount, buttonCount)
		definitions = append(definitions, def)
	}

	if len(definitions) == 0 {
		log.Println("[gamepad] no gamepads connected at startup")
	} else {
		log.Printf("[gamepad] created %d gamepad subsystem(s)", len(definitions))
	}

	return definitions
}

// buildGamepadDefinition creates a Definition for a single gamepad.
func buildGamepadDefinition(id int, name string, axisCount, buttonCount int) Definition {
	gp := &gamepadInstance{
		id:          id,
		name:        name,
		axisCount:   axisCount,
		buttonCount: buttonCount,
	}

	subsystemName := fmt.Sprintf("gamepad_%d", id)
	label := fmt.Sprintf("Gamepad %d", id)
	if name != "" {
		label = name
	}

	return Definition{
		Name: subsystemName,
		Type: "virtual",
		Monitors: []MonitorConfig{
			{
				Monitor: vento.Monitor{
					Name:           "info",
					Label:          label,
					Description:    fmt.Sprintf("Gamepad info: %s (%d axes, %d buttons)", name, axisCount, buttonCount),
					Endpoint:       fmt.Sprintf("/%s/monitors/info", subsystemName),
					ConnectionType: "mqtt",
					Ephemeral:      false,
					CardProps: map[string]any{
						"icon":  "gamepad-2",
						"color": "$purple10",
						"order": 100 + id*10,
					},
				},
				Boot: gp.publishInfo,
			},
			{
				Monitor: vento.Monitor{
					Name:           "axes",
					Label:          "Axes",
					Description:    "Current axis values (publishes only on change)",
					Endpoint:       fmt.Sprintf("/%s/monitors/axes", subsystemName),
					ConnectionType: "mqtt",
					Ephemeral:      true,
					CardProps: map[string]any{
						"icon":  "move",
						"color": "$purple9",
						"order": 101 + id*10,
					},
				},
				Boot:     gp.publishAxesIfChanged,
				Interval: 50 * time.Millisecond, // Poll at 20Hz
				Tick:     gp.publishAxesIfChanged,
			},
			{
				Monitor: vento.Monitor{
					Name:           "buttons",
					Label:          "Buttons",
					Description:    "Current button states (publishes only on change)",
					Endpoint:       fmt.Sprintf("/%s/monitors/buttons", subsystemName),
					ConnectionType: "mqtt",
					Ephemeral:      true,
					CardProps: map[string]any{
						"icon":  "circle-dot",
						"color": "$purple8",
						"order": 102 + id*10,
					},
				},
				Boot:     gp.publishButtonsIfChanged,
				Interval: 50 * time.Millisecond, // Poll at 20Hz
				Tick:     gp.publishButtonsIfChanged,
			},
		},
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:           "read",
					Label:          "Read state",
					Description:    "Read the current state of this gamepad",
					Endpoint:       fmt.Sprintf("/%s/actions/read", subsystemName),
					ConnectionType: "mqtt",
					CardProps: map[string]any{
						"icon":  "scan",
						"color": "$purple7",
						"order": 103 + id*10,
					},
					Mode: "request-reply",
				},
				Handler: gp.handleRead,
			},
		},
	}
}

// gamepadInstance holds the state for a single gamepad subsystem.
type gamepadInstance struct {
	id          int
	name        string
	axisCount   int
	buttonCount int

	mu          sync.Mutex
	lastAxes    []int
	lastButtons uint32
	connected   bool
}

func (g *gamepadInstance) readState() (axes []int, buttons uint32, err error) {
	js, err := joystick.Open(g.id)
	if err != nil {
		return nil, 0, fmt.Errorf("gamepad %d disconnected", g.id)
	}
	defer js.Close()

	state, err := js.Read()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read gamepad: %w", err)
	}

	return append([]int{}, state.AxisData...), state.Buttons, nil
}

func (g *gamepadInstance) publishInfo(ctx context.Context, mqtt *vento.MQTTClient) error {
	endpoint := fmt.Sprintf("/gamepad_%d/monitors/info", g.id)
	return mqtt.Publish(endpoint, map[string]any{
		"id":          g.id,
		"name":        g.name,
		"axisCount":   g.axisCount,
		"buttonCount": g.buttonCount,
		"connected":   true,
	})
}

func (g *gamepadInstance) publishAxesIfChanged(ctx context.Context, mqtt *vento.MQTTClient) error {
	axes, _, err := g.readState()
	if err != nil {
		g.mu.Lock()
		wasConnected := g.connected
		g.connected = false
		g.mu.Unlock()

		if wasConnected {
			log.Printf("[gamepad_%d] disconnected", g.id)
		}
		return nil // Don't publish if disconnected
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	if !g.connected {
		g.connected = true
		log.Printf("[gamepad_%d] reconnected", g.id)
	}

	// Check for changes
	if reflect.DeepEqual(axes, g.lastAxes) {
		return nil // No change
	}

	g.lastAxes = axes

	endpoint := fmt.Sprintf("/gamepad_%d/monitors/axes", g.id)
	return mqtt.Publish(endpoint, axes)
}

func (g *gamepadInstance) publishButtonsIfChanged(ctx context.Context, mqtt *vento.MQTTClient) error {
	_, buttons, err := g.readState()
	if err != nil {
		return nil // Don't publish if disconnected (axes monitor handles logging)
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	// Check for changes
	if buttons == g.lastButtons {
		return nil // No change
	}

	g.lastButtons = buttons

	// Convert buttons bitmask to array of pressed button indices
	var pressed []int
	for i := 0; i < g.buttonCount; i++ {
		if buttons&(1<<i) != 0 {
			pressed = append(pressed, i)
		}
	}

	endpoint := fmt.Sprintf("/gamepad_%d/monitors/buttons", g.id)
	return mqtt.Publish(endpoint, map[string]any{
		"raw":     buttons,
		"pressed": pressed,
	})
}

func (g *gamepadInstance) handleRead(msg vento.ActionEnvelope) error {
	axes, buttons, err := g.readState()
	if err != nil {
		if msg.CanReply() {
			return msg.ReplyJSON(map[string]any{
				"error":     err.Error(),
				"connected": false,
			})
		}
		return err
	}

	// Convert buttons bitmask to array of pressed button indices
	var pressed []int
	for i := 0; i < g.buttonCount; i++ {
		if buttons&(1<<i) != 0 {
			pressed = append(pressed, i)
		}
	}

	response := map[string]any{
		"id":          g.id,
		"name":        g.name,
		"connected":   true,
		"axes":        axes,
		"buttonsRaw":  buttons,
		"pressed":     pressed,
		"axisCount":   g.axisCount,
		"buttonCount": g.buttonCount,
	}

	if msg.CanReply() {
		return msg.ReplyJSON(response)
	}
	return nil
}

// Legacy function for compatibility - not used anymore
func NewGamepadTemplate() Template {
	return &legacyGamepadTemplate{}
}

type legacyGamepadTemplate struct{}

func (t *legacyGamepadTemplate) Build(deviceName string) Definition {
	return Definition{} // Empty, use NewGamepadMultiTemplate instead
}

func init() {
	log.Println("[gamepad] gamepad detection enabled")
}
