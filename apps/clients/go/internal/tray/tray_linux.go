//go:build linux
// +build linux

package tray

import (
	"fmt"
	"log"
	"os"
	"sync"

	"fyne.io/systray"
)

// hasDisplay checks if a graphical display is available
func hasDisplay() bool {
	// Check for X11
	if os.Getenv("DISPLAY") != "" {
		return true
	}
	// Check for Wayland
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return true
	}
	return false
}

// linuxTray implements TrayController for Linux.
type linuxTray struct {
	mu         sync.RWMutex
	state      ConnectionState
	host       string
	deviceName string
	callbacks  TrayCallbacks

	mStatus     *systray.MenuItem
	mHost       *systray.MenuItem
	mDevice     *systray.MenuItem
	mQuit       *systray.MenuItem
	initialized bool
	quitChan    chan struct{}
	enabled     bool
}

var (
	instance *linuxTray
	once     sync.Once
)

// Start initializes and runs the system tray (blocking).
func Start(callbacks TrayCallbacks) TrayController {
	once.Do(func() {
		instance = &linuxTray{
			callbacks: callbacks,
			quitChan:  make(chan struct{}),
			state:     StateDisconnected,
			enabled:   hasDisplay(),
		}
	})

	if !instance.enabled {
		log.Println("[tray] no display available, system tray disabled")
		return instance
	}

	// Run systray in a separate goroutine
	go systray.Run(instance.onReady, instance.onExit)

	return instance
}

// StartAsync starts the system tray without blocking.
func StartAsync(callbacks TrayCallbacks) TrayController {
	return Start(callbacks)
}

func (t *linuxTray) onReady() {
	t.mu.Lock()
	defer t.mu.Unlock()

	systray.SetTitle("Vento Agent")
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

	t.mQuit = systray.AddMenuItem("Quit", "Close Vento Agent")

	t.initialized = true

	// Handle menu clicks
	go func() {
		for {
			select {
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

func (t *linuxTray) onExit() {
	close(t.quitChan)
}

// UpdateState updates the connection state displayed in the tray.
func (t *linuxTray) UpdateState(state ConnectionState, host string, deviceName string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.state = state
	t.host = host
	t.deviceName = deviceName

	if !t.initialized || !t.enabled {
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
func (t *linuxTray) Quit() {
	if t.enabled {
		systray.Quit()
	}
}

