//go:build !windows && !darwin && !(linux && amd64)

package logview

// InitLogViewer is a no-op on unsupported platforms
func InitLogViewer() {}

// ShowLogWindow is a no-op on unsupported platforms
func ShowLogWindow() {}

// HideLogWindow is a no-op on unsupported platforms
func HideLogWindow() {}

// CloseLogWindow is a no-op on unsupported platforms
func CloseLogWindow() {}

// Cleanup is a no-op on unsupported platforms
func Cleanup() {}
