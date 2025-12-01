//go:build !linux || (!arm && !arm64)

package subsystems

// GPIOTemplate stub for non-Raspberry Pi platforms
type GPIOTemplate struct{}

// NewGPIOTemplate returns a stub GPIO template
func NewGPIOTemplate() *GPIOTemplate {
	return &GPIOTemplate{}
}

// Build returns an empty definition on non-Pi platforms
func (t *GPIOTemplate) Build(deviceName string) Definition {
	return Definition{}
}

