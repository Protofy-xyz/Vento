//go:build windows || darwin
// +build windows darwin

package tray

import (
	"fmt"
	"log"
	"sync"

	"github.com/getlantern/systray"
)

// windowsTray implements TrayController for Windows.
type windowsTray struct {
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
}

var (
	instance *windowsTray
	once     sync.Once
)

// Start initializes and runs the system tray (blocking).
// Should be called from the main goroutine on Windows.
func Start(callbacks TrayCallbacks) TrayController {
	once.Do(func() {
		instance = &windowsTray{
			callbacks: callbacks,
			quitChan:  make(chan struct{}),
			state:     StateDisconnected,
		}
	})

	// Run systray in a separate goroutine
	go systray.Run(instance.onReady, instance.onExit)

	return instance
}

// StartAsync starts the system tray without blocking.
func StartAsync(callbacks TrayCallbacks) TrayController {
	return Start(callbacks)
}

func (t *windowsTray) onReady() {
	t.mu.Lock()
	defer t.mu.Unlock()

	systray.SetTitle("Vento Agent")
	systray.SetTooltip("Vento Agent - Desconectado")

	// Set the icon
	systray.SetIcon(iconDisconnected)

	// Menu items
	t.mStatus = systray.AddMenuItem("⚫ Desconectado", "Estado de conexión")
	t.mStatus.Disable()

	systray.AddSeparator()

	t.mHost = systray.AddMenuItem("Servidor: -", "Servidor Vento")
	t.mHost.Disable()

	t.mDevice = systray.AddMenuItem("Dispositivo: -", "Nombre del dispositivo")
	t.mDevice.Disable()

	systray.AddSeparator()

	t.mQuit = systray.AddMenuItem("Salir", "Cerrar Vento Agent")

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

func (t *windowsTray) onExit() {
	close(t.quitChan)
}

// UpdateState updates the connection state displayed in the tray.
func (t *windowsTray) UpdateState(state ConnectionState, host string, deviceName string) {
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
		systray.SetTooltip("Vento Agent - Desconectado")
		t.mStatus.SetTitle("⚫ Desconectado")
	case StateConnecting:
		systray.SetIcon(iconConnecting)
		systray.SetTooltip("Vento Agent - Conectando...")
		t.mStatus.SetTitle("🟡 Conectando...")
	case StateConnected:
		systray.SetIcon(iconConnected)
		tooltip := fmt.Sprintf("Vento Agent - Conectado a %s", host)
		systray.SetTooltip(tooltip)
		t.mStatus.SetTitle("🟢 Conectado")
	}

	if host != "" {
		t.mHost.SetTitle(fmt.Sprintf("Servidor: %s", host))
	} else {
		t.mHost.SetTitle("Servidor: -")
	}

	if deviceName != "" {
		t.mDevice.SetTitle(fmt.Sprintf("Dispositivo: %s", deviceName))
	} else {
		t.mDevice.SetTitle("Dispositivo: -")
	}
}

// Quit triggers a graceful shutdown.
func (t *windowsTray) Quit() {
	systray.Quit()
}

