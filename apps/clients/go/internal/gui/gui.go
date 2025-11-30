// Package gui provides a graphical login dialog for desktop platforms.
package gui

// LoginResult contains the credentials entered by the user.
type LoginResult struct {
	Host     string
	Username string
	Password string
	OK       bool // true if user clicked Connect, false if cancelled
}

// IsAvailable returns true if GUI is available on this platform.
func IsAvailable() bool {
	return isAvailable()
}

// ShowLoginDialog displays a login dialog and blocks until the user submits or cancels.
// Returns the entered credentials or empty result if cancelled.
func ShowLoginDialog(defaultHost, defaultUsername string) LoginResult {
	return showLoginDialog(defaultHost, defaultUsername)
}

