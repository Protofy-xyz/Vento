package vento

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// Client wraps HTTP calls to the Vento API.
type Client struct {
	baseURL *url.URL
	http    *http.Client
}

// NewClient builds a client for the provided base URL.
func NewClient(rawBase string) (*Client, error) {
	if strings.TrimSpace(rawBase) == "" {
		return nil, errors.New("empty host")
	}
	parsed, err := url.Parse(rawBase)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "http"
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/")
	return &Client{
		baseURL: parsed,
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}, nil
}

// WaitForReady polls the API until it responds (any HTTP response), or times out.
// Any HTTP response (even 401/404) means the server is running.
// It retries every retryInterval for up to maxWait duration.
func (c *Client) WaitForReady(ctx context.Context, maxWait, retryInterval time.Duration) error {
	deadline := time.Now().Add(maxWait)
	healthURL := *c.baseURL
	healthURL.Path = path.Join(healthURL.Path, "/api/core/v1/boards")

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("server not ready after %v", maxWait)
		}

		// Check if context cancelled
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Try HEAD request (lightweight, no body)
		reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodHead, healthURL.String(), nil)
		if err != nil {
			cancel()
			return err
		}

		resp, err := c.http.Do(req)
		cancel()

		if err == nil {
			resp.Body.Close()
			// Any HTTP response means server is running (even 401/404)
			return nil
		}

		// Wait before retry
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(retryInterval):
		}
	}
}

// Login performs username/password authentication and returns the session token.
func (c *Client) Login(ctx context.Context, username, password string) (string, error) {
	payload := map[string]string{
		"username": username,
		"password": password,
	}
	var resp loginResponse
	if err := c.doJSON(ctx, http.MethodPost, "/api/core/v1/auth/login", "", payload, &resp); err != nil {
		return "", err
	}
	if resp.Session.Token == "" {
		return "", errors.New("login succeeded but token missing")
	}
	return resp.Session.Token, nil
}

// DeviceExists checks whether the device already exists.
func (c *Client) DeviceExists(ctx context.Context, token, deviceName string) (bool, error) {
	err := c.doJSON(ctx, http.MethodGet, "/api/core/v1/devices/"+deviceName, token, nil, nil)
	if err == nil {
		return true, nil
	}
	var apiErr *Error
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
	}
	return false, err
}

// RegisterDevice registers a new device with the provided definition.
func (c *Client) RegisterDevice(ctx context.Context, token string, payload any) error {
	return c.doJSON(ctx, http.MethodPost, "/api/core/v1/devices", token, payload, nil)
}

// UpdateDevice updates an existing device payload.
func (c *Client) UpdateDevice(ctx context.Context, token, deviceName string, payload any) error {
	return c.doJSON(ctx, http.MethodPost, "/api/core/v1/devices/"+deviceName, token, payload, nil)
}

// SetSubsystems replaces the subsystem array for a device.
func (c *Client) SetSubsystems(ctx context.Context, token, deviceName string, subs []Subsystem) error {
	body := map[string]any{
		"subsystem": subs,
	}
	return c.UpdateDevice(ctx, token, deviceName, body)
}

// TriggerRegisterActions forces Vento to rebuild all device boards.
// Deprecated: Use RegenerateBoardForDevice for single device regeneration.
func (c *Client) TriggerRegisterActions(ctx context.Context, token string) error {
	return c.doJSON(ctx, http.MethodGet, "/api/core/v1/devices/registerActions", token, nil, nil)
}

// RegenerateBoardForDevice regenerates the board for a specific device.
func (c *Client) RegenerateBoardForDevice(ctx context.Context, token, deviceName string) error {
	return c.doJSON(ctx, http.MethodGet, "/api/core/v1/devices/"+deviceName+"/regenerateBoard", token, nil, nil)
}

// BaseURL returns the configured base URL string.
func (c *Client) BaseURL() string {
	return c.baseURL.String()
}

// BaseURLObject returns a copy of the base url for lower level helpers.
func (c *Client) BaseURLObject() *url.URL {
	if c.baseURL == nil {
		return nil
	}
	cp := *c.baseURL
	return &cp
}

// Hostname returns the hostname part used for MQTT connections.
func (c *Client) Hostname() string {
	return c.baseURL.Hostname()
}

// HTTPClient exposes the underlying HTTP client (primarily for testing).
func (c *Client) HTTPClient() *http.Client {
	return c.http
}

func (c *Client) doJSON(ctx context.Context, method, apiPath, token string, body any, out any) error {
	req, err := c.buildRequest(ctx, method, apiPath, token, body)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		apiErr := &Error{StatusCode: res.StatusCode}
		respBody, _ := io.ReadAll(res.Body)
		apiErr.Body = strings.TrimSpace(string(respBody))
		return apiErr
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func (c *Client) buildRequest(ctx context.Context, method, apiPath, token string, body any) (*http.Request, error) {
	fullURL := *c.baseURL
	fullURL.Path = path.Join(fullURL.Path, apiPath)

	var payload io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		payload = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL.String(), payload)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
		q := req.URL.Query()
		q.Set("token", token)
		req.URL.RawQuery = q.Encode()
	}
	return req, nil
}

type loginResponse struct {
	Session struct {
		Token string `json:"token"`
		User  struct {
			ID    string `json:"id"`
			Type  string `json:"type"`
			Admin bool   `json:"admin"`
		} `json:"user"`
	} `json:"session"`
}

// Error represents an HTTP error response.
type Error struct {
	StatusCode int
	Body       string
}

func (e *Error) Error() string {
	if e.Body != "" {
		return fmt.Sprintf("vento api error %d: %s", e.StatusCode, e.Body)
	}
	return fmt.Sprintf("vento api error %d", e.StatusCode)
}
