package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"ventoagent/internal/agent"
	"ventoagent/internal/config"
	"ventoagent/internal/vento"
)

type cliOptions struct {
	ConfigPath          string
	Host                string
	Username            string
	Password            string
	DeviceName          string
	MonitorInterval     int
	Token               string
	SkipRegisterActions bool
	Once                bool
}

func parseFlags() cliOptions {
	opts := cliOptions{}
	flag.StringVar(&opts.ConfigPath, "config", "config.json", "path to config file")
	flag.StringVar(&opts.Host, "host", "", "vento host (ex: http://localhost:8000)")
	flag.StringVar(&opts.Username, "user", "", "vento username")
	flag.StringVar(&opts.Password, "password", "", "vento password (optional, will prompt if empty)")
	flag.StringVar(&opts.DeviceName, "device", "", "device name override")
	flag.IntVar(&opts.MonitorInterval, "interval", 0, "monitor interval in seconds (defaults to config or 30)")
	flag.StringVar(&opts.Token, "token", "", "existing vento token (skips login when provided)")
	flag.BoolVar(&opts.SkipRegisterActions, "skip-register-actions", false, "do not trigger /devices/registerActions after ensuring the device")
	flag.BoolVar(&opts.Once, "once", false, "run monitors once and exit (useful for debugging)")
	flag.Parse()
	return opts
}

func main() {
	opts := parseFlags()

	manager := config.NewManager(opts.ConfigPath)
	cfg, err := manager.Load()
	if err != nil {
		log.Fatalf("failed reading config: %v", err)
	}

	cfg.ApplyCLIOverrides(config.CLIOverrides{
		Host:            opts.Host,
		Username:        opts.Username,
		DeviceName:      opts.DeviceName,
		Token:           opts.Token,
		MonitorInterval: opts.MonitorInterval,
	})

	// If both host and token are provided via CLI, skip all prompts (headless mode)
	headlessMode := opts.Host != "" && opts.Token != ""

	prompter := config.NewPrompter(os.Stdin, os.Stdout)

	if cfg.Host == "" {
		if headlessMode {
			log.Fatal("host is required in headless mode")
		}
		hostDefault := "http://localhost:8000"
		input, perr := prompter.AskDefault("Vento host (ex: http://localhost:8000)", hostDefault)
		if perr != nil {
			log.Fatalf("unable to read host: %v", perr)
		}
		cfg.Host = input
	}

	// Only prompt for username if we need to login (no token provided)
	if cfg.Username == "" && cfg.Token == "" {
		userDefault := cfg.Username
		if userDefault == "" {
			userDefault = "admin"
		}
		input, perr := prompter.AskDefault("Vento username", userDefault)
		if perr != nil {
			log.Fatalf("unable to read username: %v", perr)
		}
		cfg.Username = input
	}

	cfg.Normalize()
	if cfg.DeviceName == "" {
		cfg.DeviceName = config.GenerateDeviceName()
		log.Printf("generated device name: %s", cfg.DeviceName)
	}

	// Only save config if not in headless mode (avoid overwriting with partial data)
	if !headlessMode {
		if err := manager.Save(cfg); err != nil {
			log.Fatalf("failed saving initial config: %v", err)
		}
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	ventoClient, err := vento.NewClient(cfg.Host)
	if err != nil {
		log.Fatalf("invalid host %q: %v", cfg.Host, err)
	}

	if cfg.Token == "" {
		password := opts.Password
		if password == "" {
			var perr error
			password, perr = prompter.Ask("Vento password")
			if perr != nil {
				log.Fatalf("unable to read password: %v", perr)
			}
		}
		token, err := ventoClient.Login(ctx, cfg.Username, password)
		if err != nil {
			log.Fatalf("login failed: %v", err)
		}
		cfg.Token = token
		if err := manager.Save(cfg); err != nil {
			log.Fatalf("failed storing token: %v", err)
		}
		log.Println("authenticated successfully")
	} else {
		if headlessMode {
			log.Println("running in headless mode with provided token")
		} else {
			log.Println("using token from config")
		}
	}

	if cfg.Token == "" {
		log.Fatal("token not available after login attempt")
	}

	ag := agent.New(agent.Options{
		Config:              cfg,
		Client:              ventoClient,
		ConfigWriter:        manager,
		SkipRegisterActions: opts.SkipRegisterActions,
		RunOnce:             opts.Once,
	})

	if err := ag.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
		msg := err.Error()
		if !strings.HasSuffix(msg, "\n") {
			msg += "\n"
		}
		fmt.Fprint(os.Stderr, msg)
		os.Exit(1)
	}

	log.Println("shutting down")
}
