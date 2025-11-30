//go:build !windows && !darwin
// +build !windows,!darwin

package tray

// noopTray is a no-op implementation for non-Windows platforms.
type noopTray struct{}

// Start returns a no-op tray controller on non-Windows platforms.
func Start(callbacks TrayCallbacks) TrayController {
	return &noopTray{}
}

// StartAsync is the same as Start for non-Windows platforms.
func StartAsync(callbacks TrayCallbacks) TrayController {
	return Start(callbacks)
}

func (t *noopTray) UpdateState(state ConnectionState, host string, deviceName string) {}

func (t *noopTray) Quit() {}

