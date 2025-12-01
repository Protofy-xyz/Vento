//go:build !((linux && amd64) || darwin || windows)

package subsystems

import "ventoagent/internal/vento"

// CameraMultiTemplate stub for unsupported platforms (Linux ARM, etc).
type CameraMultiTemplate struct{}

// NewCameraMultiTemplate returns a stub on unsupported platforms.
func NewCameraMultiTemplate(httpClient *vento.Client, token string) *CameraMultiTemplate {
	return &CameraMultiTemplate{}
}

// BuildAll returns nil on unsupported platforms.
func (t *CameraMultiTemplate) BuildAll(deviceName string) []Definition {
	return nil
}

