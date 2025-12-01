//go:build windows

package subsystems

/*
#cgo CXXFLAGS: -std=c++11
#cgo LDFLAGS: -lmfplat -lmf -lmfreadwrite -lmfuuid -lole32 -loleaut32 -lstdc++

#include <stdlib.h>
#include "camera_windows.h"
*/
import "C"

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unsafe"

	"ventoagent/internal/cards"
	"ventoagent/internal/vento"
)

var cameraInitialized = false
var cameraCount = 0

func initCameras() int {
	if cameraInitialized {
		return cameraCount
	}
	cameraCount = int(C.camera_init())
	cameraInitialized = true
	return cameraCount
}

func getCameraName(device int) string {
	buf := make([]byte, 256)
	C.camera_get_name(C.int(device), (*C.char)(unsafe.Pointer(&buf[0])), C.int(len(buf)))

	// Find null terminator
	for i, b := range buf {
		if b == 0 {
			return string(buf[:i])
		}
	}
	return string(buf)
}

func captureFrame(device, width, height, quality int) ([]byte, int, int, error) {
	var outData *C.uchar
	var outSize C.int

	result := C.camera_capture(C.int(device), C.int(width), C.int(height), C.int(quality),
		&outData, &outSize)

	if result == 0 || outData == nil {
		lastErr := C.camera_get_last_error()
		return nil, 0, 0, fmt.Errorf("capture failed (HRESULT: 0x%08X)", uint32(lastErr))
	}

	defer C.camera_free_buffer(outData)

	// Copy data to Go
	data := C.GoBytes(unsafe.Pointer(outData), outSize)

	if len(data) < 12 {
		return nil, 0, 0, fmt.Errorf("invalid capture data")
	}

	// Parse header
	actualWidth := int(binary.LittleEndian.Uint32(data[0:4]))
	actualHeight := int(binary.LittleEndian.Uint32(data[4:8]))
	// format := binary.LittleEndian.Uint32(data[8:12]) // 0 = RGB

	rgbData := data[12:]
	expectedSize := actualWidth * actualHeight * 3
	if len(rgbData) < expectedSize {
		return nil, 0, 0, fmt.Errorf("incomplete RGB data: got %d, expected %d", len(rgbData), expectedSize)
	}

	// Convert RGB to image
	img := image.NewRGBA(image.Rect(0, 0, actualWidth, actualHeight))
	for y := 0; y < actualHeight; y++ {
		for x := 0; x < actualWidth; x++ {
			idx := (y*actualWidth + x) * 3
			r := rgbData[idx]
			g := rgbData[idx+1]
			b := rgbData[idx+2]
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}

	// Encode to JPEG
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	if err != nil {
		return nil, 0, 0, fmt.Errorf("JPEG encode failed: %w", err)
	}

	return buf.Bytes(), actualWidth, actualHeight, nil
}

// CameraMultiTemplate creates a subsystem for each detected camera.
type CameraMultiTemplate struct {
	httpClient *vento.Client
	token      string
	cameras    []cameraInfo
}

type cameraInfo struct {
	id       string
	name     string
	deviceNo int
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

	count := initCameras()
	if count == 0 {
		log.Printf("[camera] no cameras detected")
		return
	}

	usedNames := make(map[string]int)
	for i := 0; i < count; i++ {
		name := getCameraName(i)
		sanitized := sanitizeCameraName(name, i)

		// Handle duplicate names
		if count := usedNames[sanitized]; count > 0 {
			sanitized = fmt.Sprintf("%s_%d", sanitized, count)
		}
		usedNames[sanitized]++

		t.cameras = append(t.cameras, cameraInfo{
			id:       sanitized,
			name:     name,
			deviceNo: i,
		})
		log.Printf("[camera] detected camera %d: %s -> subsystem: %s", i, name, sanitized)
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
		cameraLabel = fmt.Sprintf("Camera %d", cam.deviceNo)
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
						"type":     "frame",
						"status":   "ready",
						"camera":   camCopy.name,
						"device":   camCopy.deviceNo,
						"platform": "windows",
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
							"width": map[string]any{
								"type":        "number",
								"description": "Image width",
								"default":     1280,
							},
							"height": map[string]any{
								"type":        "number",
								"description": "Image height",
								"default":     720,
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
		var params struct {
			Quality int `json:"quality"`
			Width   int `json:"width"`
			Height  int `json:"height"`
		}
		params.Quality = 85
		params.Width = 1280
		params.Height = 720

		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &params)
		}
		if params.Quality < 1 {
			params.Quality = 1
		}
		if params.Quality > 100 {
			params.Quality = 100
		}
		if params.Width < 160 {
			params.Width = 160
		}
		if params.Height < 120 {
			params.Height = 120
		}

		log.Printf("[%s] taking picture %dx%d quality %d", cam.id, params.Width, params.Height, params.Quality)

		imgData, actualWidth, actualHeight, err := captureFrame(cam.deviceNo, params.Width, params.Height, params.Quality)
		if err != nil {
			log.Printf("[%s] capture failed: %v", cam.id, err)
			replyJSONWin(msg, map[string]any{"error": err.Error()})
			return err
		}

		filename := fmt.Sprintf("%s_%d.jpg", cam.id, time.Now().Unix())
		remotePath, err := t.uploadImage(imgData, filename)
		if err != nil {
			log.Printf("[%s] upload failed: %v", cam.id, err)
			replyJSONWin(msg, map[string]any{"error": err.Error()})
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
			"width":     actualWidth,
			"height":    actualHeight,
			"timestamp": timestamp,
			"camera":    cam.name,
		}

		// Update monitor with last capture info
		if err := msg.PublishJSON(monitorEndpoint, result); err != nil {
			log.Printf("[%s] failed to update monitor: %v", cam.id, err)
		}

		// Reply to action
		replyJSONWin(msg, result)

		return nil
	}
}

func replyJSONWin(msg vento.ActionEnvelope, data map[string]any) {
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

	var uploadResp struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&uploadResp); err != nil {
		return fmt.Sprintf("data/tmp/%s", filename), nil
	}

	if uploadResp.Path != "" {
		return uploadResp.Path, nil
	}
	return fmt.Sprintf("data/tmp/%s", filename), nil
}
