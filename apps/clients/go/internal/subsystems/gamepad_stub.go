//go:build !linux && !windows
// +build !linux,!windows

package subsystems

// GamepadMultiTemplate stub for unsupported platforms (macOS, etc.)
type GamepadMultiTemplate struct{}

func NewGamepadMultiTemplate() MultiTemplate {
	return &GamepadMultiTemplate{}
}

func (t *GamepadMultiTemplate) BuildAll(deviceName string) []Definition {
	// No gamepad support on this platform - return empty slice
	return nil
}

// Legacy function for compatibility
func NewGamepadTemplate() Template {
	return &legacyGamepadTemplate{}
}

type legacyGamepadTemplate struct{}

func (t *legacyGamepadTemplate) Build(deviceName string) Definition {
	return Definition{}
}
