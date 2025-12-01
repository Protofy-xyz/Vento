//go:build (linux && amd64) || darwin

package subsystems

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/pion/mediadevices"
	"github.com/pion/mediadevices/pkg/prop"

	"ventoagent/internal/cards"
	"ventoagent/internal/vento"

	// Import camera drivers for each platform
	_ "github.com/pion/mediadevices/pkg/driver/camera" // V4L2 for Linux, AVFoundation for macOS
)

// CameraMultiTemplate creates a subsystem for each detected camera.
type CameraMultiTemplate struct {
	httpClient *vento.Client
	token      string
	cameras    []cameraInfo
}

type cameraInfo struct {
	id       string
	name     string
	deviceID string
}

// NewCameraMultiTemplate creates a new camera multi-template.
func NewCameraMultiTemplate(httpClient *vento.Client, token string) *CameraMultiTemplate {
	tpl := &CameraMultiTemplate{
		httpClient: httpClient,
		token:      token,
	}
	tpl.detectCameras()
	return tpl
}

func (t *CameraMultiTemplate) detectCameras() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[camera] panic during camera detection: %v", r)
		}
	}()

	drivers := mediadevices.EnumerateDevices()

	usedNames := make(map[string]int)
	idx := 0
	for _, d := range drivers {
		if d.Kind == mediadevices.VideoInput {
			sanitized := sanitizeCameraName(d.Label, idx)
			
			// Handle duplicate names
			if count := usedNames[sanitized]; count > 0 {
				sanitized = fmt.Sprintf("%s_%d", sanitized, count)
			}
			usedNames[sanitized]++
			
			t.cameras = append(t.cameras, cameraInfo{
				id:       sanitized,
				name:     d.Label,
				deviceID: d.DeviceID,
			})
			log.Printf("[camera] detected camera %d: %s -> subsystem: %s", idx, d.Label, sanitized)
			idx++
		}
	}

	if len(t.cameras) == 0 {
		log.Printf("[camera] no cameras detected")
	}
}

// sanitizeCameraName converts a camera name to a valid subsystem identifier
func sanitizeCameraName(name string, index int) string {
	if name == "" {
		return fmt.Sprintf("camera_%d", index)
	}
	
	// Convert to lowercase
	s := strings.ToLower(name)
	
	// Replace spaces and special chars with underscores
	re := regexp.MustCompile(`[^a-z0-9]+`)
	s = re.ReplaceAllString(s, "_")
	
	// Remove leading/trailing underscores
	s = strings.Trim(s, "_")
	
	// Limit length
	if len(s) > 40 {
		s = s[:40]
	}
	
	if s == "" {
		return fmt.Sprintf("camera_%d", index)
	}
	
	return s
}

// BuildAll returns a Definition for each detected camera.
func (t *CameraMultiTemplate) BuildAll(deviceName string) []Definition {
	if len(t.cameras) == 0 {
		return nil
	}

	defs := make([]Definition, 0, len(t.cameras))
	singleCamera := len(t.cameras) == 1
	for _, cam := range t.cameras {
		defs = append(defs, t.buildCameraDefinition(deviceName, cam, singleCamera))
	}
	return defs
}

func (t *CameraMultiTemplate) buildCameraDefinition(deviceName string, cam cameraInfo, singleCamera bool) Definition {
	subsystemName := cam.id
	cameraLabel := cam.name
	if cameraLabel == "" {
		cameraLabel = fmt.Sprintf("Camera %d", 0) // deviceID is string on Linux/macOS
	}

	// Use simpler labels if there's only one camera
	monitorLabel := "Last Frame"
	actionLabel := "Take Picture"
	if !singleCamera {
		monitorLabel = fmt.Sprintf("%s - Last Frame", cameraLabel)
		actionLabel = fmt.Sprintf("%s - Take Picture", cameraLabel)
	}

	// Copy variables for closure
	camCopy := cam
	monitorEndpoint := fmt.Sprintf("/%s/monitors/last_capture", subsystemName)

	return Definition{
		Name: subsystemName,
		Monitors: []MonitorConfig{
			{
				Monitor: vento.Monitor{
					Name:        "last_capture",
					Label:       monitorLabel,
					Description: fmt.Sprintf("Last captured photo from %s", cameraLabel),
					Endpoint:    monitorEndpoint,
					CardProps: map[string]any{
						"icon":  "camera",
						"color": "$blue10",
						"order": 110,
						"html":  cards.Frame,
					},
				},
				Boot: func(ctx context.Context, mqtt *vento.MQTTClient) error {
					info := map[string]any{
						"type":      "frame",
						"status":    "ready",
						"camera":    camCopy.name,
						"device_id": camCopy.deviceID,
						"platform":  runtime.GOOS,
					}
					return mqtt.Publish(fmt.Sprintf("devices/%s%s", deviceName, monitorEndpoint), info)
				},
			},
		},
		Actions: []ActionConfig{
			{
				Action: vento.Action{
					Name:           "take_picture",
					Label:          actionLabel,
					Description:    fmt.Sprintf("Capture a photo from %s", cameraLabel),
					Endpoint:       fmt.Sprintf("/%s/actions/take_picture", subsystemName),
					ConnectionType: "mqtt",
					Mode:           "request-reply",
					ReplyTimeoutMs: 30000,
					Payload: vento.ActionPayload{
						Type: "json-schema",
						Schema: map[string]any{
							"quality": map[string]any{
								"type":        "number",
								"description": "JPEG quality (1-100)",
								"default":     85,
							},
						},
					},
					CardProps: map[string]any{
						"icon":  "camera",
						"color": "$blue10",
						"order": 111,
					},
				},
				Handler: t.createTakePictureHandler(camCopy, monitorEndpoint),
			},
		},
	}
}

func (t *CameraMultiTemplate) createTakePictureHandler(cam cameraInfo, monitorEndpoint string) func(vento.ActionEnvelope) error {
	return func(msg vento.ActionEnvelope) error {
		// Parse payload
		var params struct {
			Quality int `json:"quality"`
		}
		params.Quality = 85 // default

		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &params)
		}
		if params.Quality < 1 {
			params.Quality = 1
		}
		if params.Quality > 100 {
			params.Quality = 100
		}

		log.Printf("[%s] taking picture with quality %d", cam.id, params.Quality)

		// Capture image
		imgData, width, height, err := captureImage(cam.deviceID, params.Quality)
		if err != nil {
			log.Printf("[%s] capture failed: %v", cam.id, err)
			replyJSON(msg, map[string]any{"error": err.Error()})
			return err
		}

		// Upload to Vento
		filename := fmt.Sprintf("%s_%d.jpg", cam.id, time.Now().Unix())
		remotePath, err := t.uploadImage(imgData, filename)
		if err != nil {
			log.Printf("[%s] upload failed: %v", cam.id, err)
			replyJSON(msg, map[string]any{"error": err.Error()})
			return err
		}

		log.Printf("[%s] photo uploaded to %s", cam.id, remotePath)

		timestamp := time.Now().Unix()
		imageUrl := fmt.Sprintf("%s/api/core/v1/files/%s?key=%d", t.httpClient.BaseURL(), remotePath, timestamp)
		result := map[string]any{
			"type":      "frame",
			"frame":     remotePath,
			"imageUrl":  imageUrl,
			"key":       timestamp,
			"width":     width,
			"height":    height,
			"timestamp": timestamp,
			"camera":    cam.name,
		}

		// Update monitor with last capture info
		if err := msg.PublishJSON(monitorEndpoint, result); err != nil {
			log.Printf("[%s] failed to update monitor: %v", cam.id, err)
		}

		// Reply with path
		replyJSON(msg, result)

		return nil
	}
}

func captureImage(deviceID string, quality int) ([]byte, int, int, error) {
	// Create codec selector for JPEG
	codecSelector := mediadevices.NewCodecSelector()

	// Get video track from the specific device
	stream, err := mediadevices.GetUserMedia(mediadevices.MediaStreamConstraints{
		Video: func(c *mediadevices.MediaTrackConstraints) {
			c.DeviceID = prop.String(deviceID)
			c.Width = prop.Int(1280)
			c.Height = prop.Int(720)
		},
		Codec: codecSelector,
	})
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to get video stream: %w", err)
	}
	defer func() {
		for _, track := range stream.GetTracks() {
			track.Close()
		}
	}()

	videoTracks := stream.GetVideoTracks()
	if len(videoTracks) == 0 {
		return nil, 0, 0, fmt.Errorf("no video tracks available")
	}

	videoTrack := videoTracks[0]

	// Get the video reader
	reader, ok := videoTrack.(*mediadevices.VideoTrack)
	if !ok {
		return nil, 0, 0, fmt.Errorf("failed to get video reader")
	}

	// Read a single frame
	var capturedImage image.Image
	var mu sync.Mutex
	var captureErr error
	done := make(chan struct{})

	frameReader := reader.NewReader(false)

	go func() {
		defer close(done)
		frame, release, err := frameReader.Read()
		if err != nil {
			mu.Lock()
			captureErr = err
			mu.Unlock()
			return
		}
		defer release()

		// Convert to standard image
		mu.Lock()
		capturedImage = cloneImage(frame)
		mu.Unlock()
	}()

	// Wait for frame with timeout
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		return nil, 0, 0, fmt.Errorf("timeout waiting for frame")
	}

	mu.Lock()
	defer mu.Unlock()

	if captureErr != nil {
		return nil, 0, 0, captureErr
	}
	if capturedImage == nil {
		return nil, 0, 0, fmt.Errorf("no image captured")
	}

	// Encode to JPEG
	var buf bytes.Buffer
	err = jpeg.Encode(&buf, capturedImage, &jpeg.Options{Quality: quality})
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to encode jpeg: %w", err)
	}

	bounds := capturedImage.Bounds()
	return buf.Bytes(), bounds.Dx(), bounds.Dy(), nil
}

func cloneImage(src image.Image) image.Image {
	bounds := src.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			dst.Set(x, y, src.At(x, y))
		}
	}
	return dst
}

func replyJSON(msg vento.ActionEnvelope, data map[string]any) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("[camera] failed to marshal reply: %v", err)
		return
	}
	if err := msg.Reply(jsonBytes); err != nil {
		log.Printf("[camera] failed to send reply: %v", err)
	}
}

func (t *CameraMultiTemplate) uploadImage(imgData []byte, filename string) (string, error) {
	// Create multipart form
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := part.Write(imgData); err != nil {
		return "", fmt.Errorf("failed to write image data: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %w", err)
	}

	// Build upload URL
	uploadURL := fmt.Sprintf("%s/api/core/v1/files/data/tmp?token=%s", t.httpClient.BaseURL(), t.token)

	req, err := http.NewRequest("POST", uploadURL, &body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+t.token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response to get path
	var uploadResp struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&uploadResp); err != nil {
		// If we can't decode, assume default path
		return fmt.Sprintf("data/tmp/%s", filename), nil
	}

	if uploadResp.Path != "" {
		return uploadResp.Path, nil
	}
	return fmt.Sprintf("data/tmp/%s", filename), nil
}
