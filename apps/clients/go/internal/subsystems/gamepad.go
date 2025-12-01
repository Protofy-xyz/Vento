//go:build linux || windows
// +build linux windows

package subsystems

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"reflect"
	"sync"
	"time"

	"github.com/0xcafed00d/joystick"

	"ventoagent/internal/vento"
)

// GamepadTemplate detects and exposes connected gamepads/joysticks.
type GamepadTemplate struct {
	mu sync.RWMutex

	// Last known state for change detection
	lastConnectedCount int
	lastConnectedIDs   []int
	lastStates         map[int]*GamepadState
}

// GamepadInfo holds information about a connected gamepad.
type GamepadInfo struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	AxisCount   int    `json:"axisCount"`
	ButtonCount int    `json:"buttonCount"`
}

// GamepadState holds the current input state of a gamepad.
type GamepadState struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Axes    []int  `json:"axes"`
	Buttons uint32 `json:"buttons"`
}

// MaxGamepads is the maximum number of gamepads to scan for.
const MaxGamepads = 8

func NewGamepadTemplate() Template {
	return &GamepadTemplate{
		lastStates: make(map[int]*GamepadState),
	}
}

func (t *GamepadTemplate) Build(deviceName string) Definition {
	return Definition{
		Name: "gamepads",
		Type: "virtual",
		Monitors: []MonitorConfig{
			{
				Monitor: vento.Monitor{
					Name:           "connected",
					Label:          "Connected gamepads",
					Description:    "List of connected gamepads/joysticks (publishes only on change)",
					Endpoint:       "/gamepads/monitors/connected",
					ConnectionType: "mqtt",
					Ephemeral:      true,
					CardProps: map[string]any{
						"icon":  "gamepad-2",
						"color": "$purple10",
						"order": 100,
					},
				},
				Boot:     t.publishConnectedGamepadsIfChanged,
				Interval: 3 * time.Second, // Check for new/removed gamepads every 3s
				Tick:     t.publishConnectedGamepadsIfChanged,
			},
			{
				Monitor: vento.Monitor{
					Name:           "state",
					Label:          "Gamepad state",
					Description:    "Current state of all connected gamepads (publishes only on change)",
					Endpoint:       "/gamepads/monitors/state",
					ConnectionType: "mqtt",
					Ephemeral:      true,
					CardProps: map[string]any{
						"icon":  "activity",
						"color": "$purple9",
						"order": 101,
					},
				},
				Interval: 50 * time.Millisecond, // Poll at 20Hz, but only publish on change
				Tick:     t.publishGamepadStateIfChanged,
			},
		},
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:           "list",
					Label:          "List gamepads",
					Description:    "Get detailed information about all connected gamepads",
					Endpoint:       "/gamepads/actions/list",
					ConnectionType: "mqtt",
					CardProps: map[string]any{
						"icon":  "list",
						"color": "$purple8",
						"order": 102,
					},
					Mode: "request-reply",
				},
				Handler: t.handleListGamepads,
			},
			{
				Action: vento.Action{
					Name:           "read",
					Label:          "Read gamepad",
					Description:    "Read the current state of a specific gamepad",
					Endpoint:       "/gamepads/actions/read",
					ConnectionType: "mqtt",
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"id": map[string]any{
								"type":        "number",
								"title":       "Gamepad ID",
								"default":     0,
								"description": "ID of the gamepad (0-7)",
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "scan",
						"color": "$purple7",
						"order": 103,
					},
					Mode: "request-reply",
				},
				Handler: t.handleReadGamepad,
			},
		},
	}
}

// scanConnectedGamepads returns info about all connected gamepads.
func (t *GamepadTemplate) scanConnectedGamepads() ([]*GamepadInfo, []int) {
	var connected []*GamepadInfo
	var ids []int

	for id := 0; id < MaxGamepads; id++ {
		js, err := joystick.Open(id)
		if err != nil {
			continue
		}

		info := &GamepadInfo{
			ID:          id,
			Name:        js.Name(),
			AxisCount:   js.AxisCount(),
			ButtonCount: js.ButtonCount(),
		}
		js.Close()

		connected = append(connected, info)
		ids = append(ids, id)
	}

	return connected, ids
}

// readGamepadState reads the current state of a specific gamepad.
func (t *GamepadTemplate) readGamepadState(id int) (*GamepadState, error) {
	if id < 0 || id >= MaxGamepads {
		return nil, fmt.Errorf("invalid gamepad ID: %d (must be 0-%d)", id, MaxGamepads-1)
	}

	js, err := joystick.Open(id)
	if err != nil {
		return nil, fmt.Errorf("gamepad %d not connected", id)
	}
	defer js.Close()

	state, err := js.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read gamepad state: %w", err)
	}

	return &GamepadState{
		ID:      id,
		Name:    js.Name(),
		Axes:    append([]int{}, state.AxisData...),
		Buttons: state.Buttons,
	}, nil
}

// connectedChanged checks if the connected gamepads have changed.
func (t *GamepadTemplate) connectedChanged(count int, ids []int) bool {
	if count != t.lastConnectedCount {
		return true
	}
	if len(ids) != len(t.lastConnectedIDs) {
		return true
	}
	for i, id := range ids {
		if t.lastConnectedIDs[i] != id {
			return true
		}
	}
	return false
}

// stateChanged checks if the gamepad state has changed.
func (t *GamepadTemplate) stateChanged(id int, state *GamepadState) bool {
	last, exists := t.lastStates[id]
	if !exists {
		return true
	}
	if state.Buttons != last.Buttons {
		return true
	}
	if !reflect.DeepEqual(state.Axes, last.Axes) {
		return true
	}
	return false
}

func (t *GamepadTemplate) publishConnectedGamepadsIfChanged(ctx context.Context, mqtt *vento.MQTTClient) error {
	gamepads, ids := t.scanConnectedGamepads()

	t.mu.Lock()
	defer t.mu.Unlock()

	// Check if anything changed
	if !t.connectedChanged(len(gamepads), ids) {
		return nil // No change, don't publish
	}

	// Update last known state
	t.lastConnectedCount = len(gamepads)
	t.lastConnectedIDs = ids

	// Clean up states for disconnected gamepads
	for id := range t.lastStates {
		found := false
		for _, connectedID := range ids {
			if id == connectedID {
				found = true
				break
			}
		}
		if !found {
			delete(t.lastStates, id)
		}
	}

	payload := map[string]any{
		"count":    len(gamepads),
		"gamepads": gamepads,
	}

	log.Printf("[gamepad] connection changed: %d gamepad(s) connected", len(gamepads))
	return mqtt.Publish("/gamepads/monitors/connected", payload)
}

func (t *GamepadTemplate) publishGamepadStateIfChanged(ctx context.Context, mqtt *vento.MQTTClient) error {
	t.mu.RLock()
	connectedIDs := t.lastConnectedIDs
	t.mu.RUnlock()

	if len(connectedIDs) == 0 {
		return nil // No gamepads connected, skip
	}

	var changedStates []*GamepadState

	t.mu.Lock()
	for _, id := range connectedIDs {
		state, err := t.readGamepadState(id)
		if err != nil {
			continue
		}

		if t.stateChanged(id, state) {
			changedStates = append(changedStates, state)
			// Update last known state
			t.lastStates[id] = state
		}
	}
	t.mu.Unlock()

	if len(changedStates) == 0 {
		return nil // No changes
	}

	return mqtt.Publish("/gamepads/monitors/state", changedStates)
}

func (t *GamepadTemplate) handleListGamepads(msg vento.ActionEnvelope) error {
	gamepads, _ := t.scanConnectedGamepads()

	response := map[string]any{
		"count":    len(gamepads),
		"gamepads": gamepads,
	}

	if msg.CanReply() {
		return msg.ReplyJSON(response)
	}
	return nil
}

func (t *GamepadTemplate) handleReadGamepad(msg vento.ActionEnvelope) error {
	var payload struct {
		ID int `json:"id"`
	}

	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		// Default to gamepad 0 if no payload
		payload.ID = 0
	}

	state, err := t.readGamepadState(payload.ID)
	if err != nil {
		if msg.CanReply() {
			return msg.ReplyJSON(map[string]any{
				"error": err.Error(),
			})
		}
		return err
	}

	if msg.CanReply() {
		return msg.ReplyJSON(state)
	}
	return nil
}

func init() {
	log.Println("[gamepad] gamepad detection enabled")
}
