package subsystems

import (
	"context"
	"log"
	"strings"
	"time"

	"ventoagent/internal/config"
	"ventoagent/internal/vento"
)

// Set glues all templates together for the agent runtime.
type Set struct {
	templates      []Template
	definitions    []Definition
	actionHandlers map[string]ActionConfig
}

// NewSet constructs the default subsystem set. Duplicate the template entries
// below to register additional subsystems.
func NewSet(cfg *config.Config) *Set {
	return &Set{
		templates: []Template{
			NewSystemInfoTemplate(),
			NewGamepadTemplate(),
		},
	}
}

// Prepare materializes all subsystem definitions for the provided device.
func (s *Set) Prepare(deviceName string) {
	s.definitions = make([]Definition, 0, len(s.templates))
	s.actionHandlers = make(map[string]ActionConfig)
	for _, tpl := range s.templates {
		def := tpl.Build(deviceName)
		s.definitions = append(s.definitions, def)
		for _, action := range def.Actions {
			s.actionHandlers[actionKey(def.Name, action.Action.Name)] = action
		}
	}
}

// DevicePayload returns the payload used to register the device in Vento.
func (s *Set) DevicePayload(deviceName string) vento.DevicePayload {
	subsystems := make([]vento.Subsystem, len(s.definitions))
	for i, def := range s.definitions {
		subsystems[i] = def.subsystem()
	}
	return vento.BuildDevicePayload(deviceName, subsystems)
}

// PublishBoot runs all boot-time monitor publishers.
func (s *Set) PublishBoot(ctx context.Context, mqtt *vento.MQTTClient) {
	for _, def := range s.definitions {
		for _, mon := range def.Monitors {
			if mon.Boot == nil {
				continue
			}
			if err := mon.Boot(ctx, mqtt); err != nil {
				log.Printf("[subsystem:%s monitor:%s] boot publish failed: %v", def.Name, mon.Monitor.Name, err)
			}
		}
	}
}

// StartIntervals launches goroutines for each monitor interval.
func (s *Set) StartIntervals(ctx context.Context, mqtt *vento.MQTTClient) {
	for _, def := range s.definitions {
		for _, mon := range def.Monitors {
			if mon.Interval <= 0 || mon.Tick == nil {
				continue
			}
			go s.runMonitor(ctx, mqtt, def.Name, mon)
		}
	}
}

func (s *Set) runMonitor(ctx context.Context, mqtt *vento.MQTTClient, subsystem string, mon MonitorConfig) {
	ticker := time.NewTicker(mon.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := mon.Tick(ctx, mqtt); err != nil {
				log.Printf("[subsystem:%s monitor:%s] periodic publish failed: %v", subsystem, mon.Monitor.Name, err)
			}
		}
	}
}

// HandleAction dispatches the payload to the matching action handler.
func (s *Set) HandleAction(msg vento.ActionEnvelope) bool {
	handler, ok := s.actionHandlers[actionKey(msg.Subsystem, msg.Action)]
	if !ok {
		return false
	}
	if handler.Handler == nil {
		return true
	}
	if err := handler.Handler(msg); err != nil {
		log.Printf("[subsystem:%s action:%s] handler error: %v", msg.Subsystem, msg.Action, err)
	}
	return true
}

func actionKey(subsystem, action string) string {
	return strings.ToLower(subsystem) + ":" + strings.ToLower(action)
}
