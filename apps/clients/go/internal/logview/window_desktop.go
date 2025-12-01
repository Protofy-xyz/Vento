//go:build windows || darwin || (linux && amd64)

package logview

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

var (
	logFile       *os.File
	logFilePath   string
	logMu         sync.Mutex
	writerStarted bool
)

// InitLogViewer initializes the log viewer and starts writing to file
func InitLogViewer() {
	logMu.Lock()
	defer logMu.Unlock()

	if writerStarted {
		return
	}

	// Put log file next to the executable
	exePath, err := os.Executable()
	if err != nil {
		// Fallback to current directory
		exePath, _ = os.Getwd()
	}
	exeDir := filepath.Dir(exePath)
	logFilePath = filepath.Join(exeDir, "ventoagent.log")

	// Create/truncate log file
	logFile, err = os.Create(logFilePath)
	if err != nil {
		// Try current working directory as fallback
		cwd, _ := os.Getwd()
		logFilePath = filepath.Join(cwd, "ventoagent.log")
		logFile, err = os.Create(logFilePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[logview] failed to create log file: %v\n", err)
			return
		}
	}

	fmt.Fprintf(os.Stderr, "[logview] logging to: %s\n", logFilePath)

	writerStarted = true

	// Start goroutine to continuously write logs to file
	go writeLogsToFile()
}

func writeLogsToFile() {
	buffer := GetGlobalBuffer()
	updateCh := buffer.Subscribe()
	lastLen := 0

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-updateCh:
		case <-ticker.C:
		}

		logMu.Lock()
		if logFile == nil {
			logMu.Unlock()
			return
		}

		content := buffer.String()
		if len(content) > lastLen {
			// Write only new content
			newContent := content[lastLen:]
			logFile.WriteString(newContent)
			logFile.Sync()
			lastLen = len(content)
		}
		logMu.Unlock()
	}
}

// ShowLogWindow opens the log file with live tail
func ShowLogWindow() {
	// First, flush current logs to file
	logMu.Lock()
	path := logFilePath
	if logFile != nil {
		buffer := GetGlobalBuffer()
		content := buffer.String()
		logFile.Truncate(0)
		logFile.Seek(0, 0)
		logFile.WriteString(content)
		logFile.Sync()
	}
	logMu.Unlock()

	if path == "" {
		fmt.Fprintf(os.Stderr, "[logview] log file not initialized\n")
		return
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		// Use cmd.exe to show file with type and pause, then open notepad
		// This is more reliable than PowerShell's Get-Content
		cmd = exec.Command("notepad.exe", path)
	case "darwin":
		// Open with Console.app or default text editor
		cmd = exec.Command("open", path)
	case "linux":
		// Try to open with default application
		if _, err := exec.LookPath("xdg-open"); err == nil {
			cmd = exec.Command("xdg-open", path)
		} else {
			cmd = exec.Command("gedit", path)
		}
	default:
		fmt.Fprintf(os.Stderr, "[logview] unsupported platform: %s\n", runtime.GOOS)
		return
	}

	err := cmd.Start()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[logview] failed to open log viewer: %v\n", err)
	}
}

// HideLogWindow is a no-op for file-based logs
func HideLogWindow() {}

// CloseLogWindow is a no-op for file-based logs
func CloseLogWindow() {}

// Cleanup is a no-op for file-based logs
func Cleanup() {}
