//go:build !linux && !windows
// +build !linux,!windows

package subsystems

// GamepadTemplate stub for unsupported platforms (macOS, etc.)
type GamepadTemplate struct{}

func NewGamepadTemplate() Template {
	return &GamepadTemplate{}
}

func (t *GamepadTemplate) Build(deviceName string) Definition {
	// Return empty definition - no gamepad support on this platform
	return Definition{
		Name: "gamepads",
		Type: "virtual",
	}
}

