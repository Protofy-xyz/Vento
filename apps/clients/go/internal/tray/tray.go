// Package tray provides system tray functionality for the Vento agent.
package tray

// ConnectionState represents the current connection state to Vento.
type ConnectionState int

const (
	StateDisconnected ConnectionState = iota
	StateConnecting
	StateConnected
)

// TrayController provides an interface to control the system tray.
type TrayController interface {
	// UpdateState updates the connection state displayed in the tray.
	UpdateState(state ConnectionState, host string, deviceName string)
	// Quit triggers a graceful shutdown.
	Quit()
}

// TrayCallbacks contains callbacks for tray events.
type TrayCallbacks struct {
	OnQuit     func()
	OnViewLogs func()
}

