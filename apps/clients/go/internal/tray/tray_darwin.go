//go:build darwin
// +build darwin

package tray

import (
	"fmt"
	"log"
	"sync"

	"github.com/getlantern/systray"
)

// darwinTray implements TrayController for macOS using getlantern/systray.
type darwinTray struct {
	mu         sync.RWMutex
	state      ConnectionState
	host       string
	deviceName string
	callbacks  TrayCallbacks

	mStatus     *systray.MenuItem
	mHost       *systray.MenuItem
	mDevice     *systray.MenuItem
	mLogs       *systray.MenuItem
	mQuit       *systray.MenuItem
	initialized bool
	quitChan    chan struct{}
}

var (
	instance *darwinTray
	once     sync.Once
)

// Start initializes and runs the system tray.
// On macOS, systray.Run must be called from the main thread.
func Start(callbacks TrayCallbacks) TrayController {
	once.Do(func() {
		instance = &darwinTray{
			callbacks: callbacks,
			quitChan:  make(chan struct{}),
			state:     StateDisconnected,
		}
	})

	// Run systray - on macOS this needs special handling
	// getlantern/systray handles the main thread requirement internally
	go systray.Run(instance.onReady, instance.onExit)

	return instance
}

// StartAsync starts the system tray without blocking.
func StartAsync(callbacks TrayCallbacks) TrayController {
	return Start(callbacks)
}

func (t *darwinTray) onReady() {
	t.mu.Lock()
	defer t.mu.Unlock()

	systray.SetTitle("Vento")
	systray.SetTooltip("Vento Agent - Disconnected")

	// Set the icon
	systray.SetIcon(iconDisconnected)

	// Menu items
	t.mStatus = systray.AddMenuItem("⚫ Disconnected", "Connection status")
	t.mStatus.Disable()

	systray.AddSeparator()

	t.mHost = systray.AddMenuItem("Server: -", "Vento server")
	t.mHost.Disable()

	t.mDevice = systray.AddMenuItem("Device: -", "Device name")
	t.mDevice.Disable()

	systray.AddSeparator()

	t.mLogs = systray.AddMenuItem("View Logs", "Show agent logs")

	systray.AddSeparator()

	t.mQuit = systray.AddMenuItem("Quit", "Close Vento Agent")

	t.initialized = true

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-t.mLogs.ClickedCh:
				log.Println("[tray] view logs requested")
				if t.callbacks.OnViewLogs != nil {
					t.callbacks.OnViewLogs()
				}
			case <-t.mQuit.ClickedCh:
				log.Println("[tray] quit requested via system tray")
				if t.callbacks.OnQuit != nil {
					t.callbacks.OnQuit()
				}
				systray.Quit()
				return
			case <-t.quitChan:
				return
			}
		}
	}()
}

func (t *darwinTray) onExit() {
	close(t.quitChan)
}

// UpdateState updates the connection state displayed in the tray.
func (t *darwinTray) UpdateState(state ConnectionState, host string, deviceName string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.state = state
	t.host = host
	t.deviceName = deviceName

	if !t.initialized {
		return
	}

	switch state {
	case StateDisconnected:
		systray.SetIcon(iconDisconnected)
		systray.SetTooltip("Vento Agent - Disconnected")
		t.mStatus.SetTitle("⚫ Disconnected")
	case StateConnecting:
		systray.SetIcon(iconConnecting)
		systray.SetTooltip("Vento Agent - Connecting...")
		t.mStatus.SetTitle("🟡 Connecting...")
	case StateConnected:
		systray.SetIcon(iconConnected)
		tooltip := fmt.Sprintf("Vento Agent - Connected to %s", host)
		systray.SetTooltip(tooltip)
		t.mStatus.SetTitle("🟢 Connected")
	}

	if host != "" {
		t.mHost.SetTitle(fmt.Sprintf("Server: %s", host))
	} else {
		t.mHost.SetTitle("Server: -")
	}

	if deviceName != "" {
		t.mDevice.SetTitle(fmt.Sprintf("Device: %s", deviceName))
	} else {
		t.mDevice.SetTitle("Device: -")
	}
}

// Quit triggers a graceful shutdown.
func (t *darwinTray) Quit() {
	systray.Quit()
}

