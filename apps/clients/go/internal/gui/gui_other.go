//go:build (!windows && !darwin && !linux) || (linux && !amd64) || (windows && !amd64)
// +build !windows,!darwin,!linux linux,!amd64 windows,!amd64

package gui

func isAvailable() bool {
	return false
}

func showLoginDialog(defaultHost, defaultUsername string) LoginResult {
	return LoginResult{OK: false}
}
