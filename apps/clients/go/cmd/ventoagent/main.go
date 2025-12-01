package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"ventoagent/internal/agent"
	"ventoagent/internal/config"
	"ventoagent/internal/gui"
	"ventoagent/internal/logview"
	"ventoagent/internal/tray"
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
	NoTray              bool
	NoGUI               bool
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
	flag.BoolVar(&opts.NoTray, "no-tray", false, "disable system tray icon (Windows/macOS)")
	flag.BoolVar(&opts.NoGUI, "no-gui", false, "disable GUI login dialog (use terminal prompts)")
	flag.Parse()
	return opts
}

// needsGUILogin checks if we should show the GUI login dialog
func needsGUILogin(opts cliOptions, cfg *config.Config) bool {
	// Check if on a supported platform (Windows, macOS, or Linux)
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		return false
	}

	// GUI explicitly disabled
	if opts.NoGUI {
		return false
	}

	// GUI not available on this platform
	if !gui.IsAvailable() {
		return false
	}

	// Already have credentials from CLI
	if opts.Host != "" && opts.Token != "" {
		return false
	}
	if opts.Host != "" && opts.Password != "" {
		return false
	}

	// Already have credentials in config
	if cfg.Host != "" && cfg.Token != "" {
		return false
	}

	// Need credentials - show GUI
	return true
}

func main() {
	// Set up log capture for the log viewer
	logBuffer := logview.GetGlobalBuffer()
	log.SetOutput(logBuffer.MultiWriter(os.Stderr))
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)

	// Initialize log viewer (starts Fyne in background)
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" || runtime.GOOS == "linux" {
		logview.InitLogViewer()
	}

	opts := parseFlags()

	manager := config.NewManager(opts.ConfigPath)
	cfg, err := manager.Load()
	if err != nil {
		log.Fatalf("failed reading config: %v", err)
	}

	// Apply CLI overrides first
	cfg.ApplyCLIOverrides(config.CLIOverrides{
		Host:            opts.Host,
		Username:        opts.Username,
		DeviceName:      opts.DeviceName,
		Token:           opts.Token,
		MonitorInterval: opts.MonitorInterval,
	})

	// Check if we need GUI login
	if needsGUILogin(opts, cfg) {
		log.Println("launching GUI login dialog...")

		result := gui.ShowLoginDialog(cfg.Host, cfg.Username)
		if !result.OK {
			log.Println("login cancelled by user")
			os.Exit(0)
		}

		// Apply GUI values
		cfg.Host = result.Host
		cfg.Username = result.Username
		opts.Password = result.Password

		log.Printf("connecting to %s as %s", cfg.Host, cfg.Username)
	}

	// Set up context with signal handling
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Initialize system tray (Windows, macOS, and Linux with display)
	var trayController tray.TrayController
	if (runtime.GOOS == "windows" || runtime.GOOS == "darwin" || runtime.GOOS == "linux") && !opts.NoTray {
		trayController = tray.StartAsync(tray.TrayCallbacks{
			OnQuit: func() {
				log.Println("quit requested from system tray")
				cancel()
			},
			OnViewLogs: func() {
				logview.ShowLogWindow()
			},
		})
		// Give the tray a moment to initialize
		time.Sleep(100 * time.Millisecond)
	}

	// Helper to update tray state
	updateTray := func(state tray.ConnectionState, host, deviceName string) {
		if trayController != nil {
			trayController.UpdateState(state, host, deviceName)
		}
	}

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

	// Update tray to show connecting state
	updateTray(tray.StateConnecting, cfg.Host, cfg.DeviceName)

	ventoClient, err := vento.NewClient(cfg.Host)
	if err != nil {
		updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
		log.Fatalf("invalid host %q: %v", cfg.Host, err)
	}

	// Wait for Vento server to be ready before proceeding
	log.Printf("waiting for Vento server at %s...", cfg.Host)
	if err := ventoClient.WaitForReady(ctx, 90*time.Second, 5*time.Second); err != nil {
		updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
		log.Fatalf("server not available: %v", err)
	}
	log.Println("server is ready")

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
			updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
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
		updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
		log.Fatal("token not available after login attempt")
	}

	ag := agent.New(agent.Options{
		Config:              cfg,
		Client:              ventoClient,
		ConfigWriter:        manager,
		SkipRegisterActions: opts.SkipRegisterActions,
		RunOnce:             opts.Once,
		OnConnected: func() {
			updateTray(tray.StateConnected, cfg.Host, cfg.DeviceName)
		},
		OnDisconnected: func() {
			updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
		},
	})

	if err := ag.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
		updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
		msg := err.Error()
		if !strings.HasSuffix(msg, "\n") {
			msg += "\n"
		}
		fmt.Fprint(os.Stderr, msg)
		os.Exit(1)
	}

	updateTray(tray.StateDisconnected, cfg.Host, cfg.DeviceName)
	log.Println("shutting down")
}
