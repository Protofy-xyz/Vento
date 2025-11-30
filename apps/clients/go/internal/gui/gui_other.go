//go:build !windows && !darwin && !linux
// +build !windows,!darwin,!linux

package gui

func isAvailable() bool {
	return false
}

func showLoginDialog(defaultHost, defaultUsername string) LoginResult {
	return LoginResult{OK: false}
}
