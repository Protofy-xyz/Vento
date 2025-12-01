//go:build (!windows && !linux) || (linux && !amd64) || (windows && !amd64) || darwin
// +build !windows,!linux linux,!amd64 windows,!amd64 darwin

package tray

// noopTray is a no-op implementation for unsupported platforms.
type noopTray struct{}

// Start returns a no-op tray controller on unsupported platforms.
func Start(callbacks TrayCallbacks) TrayController {
	return &noopTray{}
}

// StartAsync is the same as Start for unsupported platforms.
func StartAsync(callbacks TrayCallbacks) TrayController {
	return Start(callbacks)
}

func (t *noopTray) UpdateState(state ConnectionState, host string, deviceName string) {}

func (t *noopTray) Quit() {}
