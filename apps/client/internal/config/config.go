package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const defaultMonitorInterval = 30

// Config represents the persisted configuration for the agent.
type Config struct {
	Host                   string `json:"host"`
	Username               string `json:"username"`
	Token                  string `json:"token"`
	DeviceName             string `json:"device_name"`
	MonitorIntervalSeconds int    `json:"monitor_interval_seconds"`
}

// CLIOverrides holds optional overrides coming from CLI flags.
type CLIOverrides struct {
	Host            string
	Username        string
	DeviceName      string
	Token           string
	MonitorInterval int
}

// Manager is a threadsafe config loader/saver.
type Manager struct {
	path string
	mu   sync.Mutex
}

// NewManager creates a config manager pointing to the provided file path.
func NewManager(path string) *Manager {
	if strings.TrimSpace(path) == "" {
		path = "config.json"
	}
	return &Manager{path: filepath.Clean(path)}
}

// Path returns the config file path.
func (m *Manager) Path() string {
	return m.path
}

// Load reads the config from disk (if present) and returns defaults otherwise.
func (m *Manager) Load() (*Config, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cfg := &Config{MonitorIntervalSeconds: defaultMonitorInterval}
	data, err := os.ReadFile(m.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return cfg, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return cfg, nil
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	cfg.Normalize()
	return cfg, nil
}

// Save persists the config to disk.
func (m *Manager) Save(cfg *Config) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cfg.Normalize()
	payload, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(m.path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	// best-effort atomic write
	tmpFile := fmt.Sprintf("%s.tmp.%d", m.path, time.Now().UnixNano())
	if err := os.WriteFile(tmpFile, payload, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmpFile, m.path); err != nil {
		_ = os.Remove(tmpFile)
		return err
	}
	return nil
}

// Normalize applies default values and normalizes fields for comparison.
func (c *Config) Normalize() {
	c.Host = strings.TrimSpace(c.Host)
	c.Username = strings.TrimSpace(c.Username)
	c.DeviceName = strings.TrimSpace(c.DeviceName)
	if c.MonitorIntervalSeconds <= 0 {
		c.MonitorIntervalSeconds = defaultMonitorInterval
	}
	if c.Host != "" && !strings.HasPrefix(c.Host, "http://") && !strings.HasPrefix(c.Host, "https://") {
		c.Host = "http://" + c.Host
	}
	c.Host = strings.TrimSuffix(c.Host, "/")
}

// ApplyCLIOverrides merges CLI overrides to the config.
func (c *Config) ApplyCLIOverrides(overrides CLIOverrides) {
	if overrides.Host != "" {
		c.Host = overrides.Host
	}
	if overrides.Username != "" {
		c.Username = overrides.Username
	}
	if overrides.DeviceName != "" {
		c.DeviceName = overrides.DeviceName
	}
	if overrides.Token != "" {
		c.Token = overrides.Token
	}
	if overrides.MonitorInterval > 0 {
		c.MonitorIntervalSeconds = overrides.MonitorInterval
	}
}

// MonitorInterval returns the configured monitor interval as duration.
func (c *Config) MonitorInterval() time.Duration {
	if c.MonitorIntervalSeconds <= 0 {
		return defaultMonitorInterval * time.Second
	}
	return time.Duration(c.MonitorIntervalSeconds) * time.Second
}

// GenerateDeviceName creates a unique random device identifier.
var hostnameSanitizer = regexp.MustCompile(`[^a-z0-9_]+`)

func GenerateDeviceName() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		host = "device"
	}
	host = strings.ToLower(strings.TrimSpace(host))
	host = hostnameSanitizer.ReplaceAllString(host, "_")
	host = strings.Trim(host, "_")
	if host == "" {
		host = "device"
	}

	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%s_%s", host, "0000")
	}
	return fmt.Sprintf("%s_%s", host, strings.ToLower(hex.EncodeToString(buf)))
}
