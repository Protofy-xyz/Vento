package subsystems

import (
	"context"
	"time"

	"ventoagent/internal/vento"
)

// Template is the minimal contract for a subsystem plugin.
// Each template returns a Definition describing monitors, actions, and intervals.
type Template interface {
	Build(deviceName string) Definition
}

// Definition captures everything needed to expose a subsystem in Vento and run it locally.
type Definition struct {
	Name     string
	Type     string
	Monitors []MonitorConfig
	Actions  []ActionConfig
}

// MonitorConfig wires a Vento monitor definition with boot/interval publishers.
type MonitorConfig struct {
	Monitor  vento.Monitor
	Boot     func(ctx context.Context, mqtt *vento.MQTTClient) error
	Interval time.Duration
	Tick     func(ctx context.Context, mqtt *vento.MQTTClient) error
}

// ActionConfig wires a Vento action definition with its handler.
type ActionConfig struct {
	Action  vento.Action
	Handler func(payload []byte) error
}

func (d Definition) subsystem() vento.Subsystem {
	monitors := make([]vento.Monitor, len(d.Monitors))
	for i, m := range d.Monitors {
		monitors[i] = m.Monitor
	}
	actions := make([]vento.Action, len(d.Actions))
	for i, a := range d.Actions {
		actions[i] = a.Action
	}
	return vento.Subsystem{
		Name:     d.Name,
		Type:     d.Type,
		Monitors: monitors,
		Actions:  actions,
	}
}
