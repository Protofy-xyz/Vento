package agent

import (
	"context"
	"fmt"
	"log"

	"ventoagent/internal/config"
	"ventoagent/internal/subsystems"
	"ventoagent/internal/vento"
)

// ConfigWriter abstracts the config persistence used by the agent.
type ConfigWriter interface {
	Save(*config.Config) error
}

// Options configure the Agent.
type Options struct {
	Config              *config.Config
	Client              *vento.Client
	ConfigWriter        ConfigWriter
	SkipRegisterActions bool
	RunOnce             bool
}

// Agent runs the local monitoring loop.
type Agent struct {
	cfg   *config.Config
	http  *vento.Client
	store ConfigWriter

	mqtt *vento.MQTTClient

	subs *subsystems.Set

	skipRegisterActions bool
	runOnce             bool
}

// New builds a new Agent from the provided options.
func New(opts Options) *Agent {
	return &Agent{
		cfg:                 opts.Config,
		http:                opts.Client,
		store:               opts.ConfigWriter,
		subs:                subsystems.NewSet(opts.Config),
		skipRegisterActions: opts.SkipRegisterActions,
		runOnce:             opts.RunOnce,
	}
}

// Start ensures the device exists, connects to MQTT and launches monitors.
func (a *Agent) Start(ctx context.Context) error {
	a.subs.Prepare(a.cfg.DeviceName)

	if err := a.ensureDevice(ctx); err != nil {
		return fmt.Errorf("ensure device: %w", err)
	}

	mqttClient, err := vento.ConnectMQTT(ctx, a.http.BaseURLObject(), a.cfg.DeviceName, a.cfg.Username, a.cfg.Token, a.handleAction)
	if err != nil {
		return fmt.Errorf("mqtt connection failed: %w", err)
	}
	a.mqtt = mqttClient
	defer a.mqtt.Close()
	log.Printf("connected to mqtt broker as %s", a.cfg.DeviceName)

	// Set up reconnection handler to re-publish boot data
	a.mqtt.SetOnReconnect(func() {
		log.Printf("reconnected - re-publishing boot data...")
		a.subs.PublishBoot(ctx, a.mqtt)
	})

	a.subs.PublishBoot(ctx, a.mqtt)
	if a.runOnce {
		return nil
	}

	a.subs.StartIntervals(ctx, a.mqtt)

	<-ctx.Done()
	return ctx.Err()
}

func (a *Agent) ensureDevice(ctx context.Context) error {
	exists, err := a.http.DeviceExists(ctx, a.cfg.Token, a.cfg.DeviceName)
	if err != nil {
		return err
	}
	payload := a.subs.DevicePayload(a.cfg.DeviceName)
	if exists {
		return a.http.UpdateDevice(ctx, a.cfg.Token, a.cfg.DeviceName, payload)
	}
	log.Printf("device %s not found, registering...", a.cfg.DeviceName)
	createPayload := map[string]any{
		"name":     payload.Name,
		"platform": payload.Platform,
	}
	if err := a.http.RegisterDevice(ctx, a.cfg.Token, createPayload); err != nil {
		return err
	}
	if err := a.http.UpdateDevice(ctx, a.cfg.Token, a.cfg.DeviceName, payload); err != nil {
		return err
	}
	if !a.skipRegisterActions {
		if err := a.http.RegenerateBoardForDevice(ctx, a.cfg.Token, a.cfg.DeviceName); err != nil {
			log.Printf("warning: failed to regenerate board: %v", err)
		}
	}
	// persist generated config to disk
	if a.store != nil {
		if err := a.store.Save(a.cfg); err != nil {
			log.Printf("warning: failed to persist config: %v", err)
		}
	}
	return nil
}

func (a *Agent) handleAction(msg vento.ActionEnvelope) {
	if handled := a.subs.HandleAction(msg); handled {
		return
	}
	log.Printf("unhandled action[%s/%s]: %s", msg.Subsystem, msg.Action, string(msg.Payload))
}
