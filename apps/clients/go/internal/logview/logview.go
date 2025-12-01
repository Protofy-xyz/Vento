package logview

import (
	"io"
	"sync"
)

// Buffer is a thread-safe circular buffer that captures log output
type Buffer struct {
	mu        sync.RWMutex
	data      []byte
	maxSize   int
	listeners []chan struct{}
}

// NewBuffer creates a new log buffer with the given max size
func NewBuffer(maxSize int) *Buffer {
	return &Buffer{
		data:    make([]byte, 0, maxSize),
		maxSize: maxSize,
	}
}

// Write implements io.Writer
func (b *Buffer) Write(p []byte) (n int, err error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.data = append(b.data, p...)
	
	// Trim if over max size (keep last maxSize bytes)
	if len(b.data) > b.maxSize {
		b.data = b.data[len(b.data)-b.maxSize:]
	}

	// Notify listeners
	for _, ch := range b.listeners {
		select {
		case ch <- struct{}{}:
		default:
		}
	}

	return len(p), nil
}

// String returns the current buffer contents as a string
func (b *Buffer) String() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return string(b.data)
}

// Subscribe returns a channel that receives notifications when new data is written
func (b *Buffer) Subscribe() chan struct{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan struct{}, 1)
	b.listeners = append(b.listeners, ch)
	return ch
}

// Unsubscribe removes a listener channel
func (b *Buffer) Unsubscribe(ch chan struct{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i, c := range b.listeners {
		if c == ch {
			b.listeners = append(b.listeners[:i], b.listeners[i+1:]...)
			close(ch)
			return
		}
	}
}

// MultiWriter creates a writer that writes to both the buffer and another writer
func (b *Buffer) MultiWriter(other io.Writer) io.Writer {
	return io.MultiWriter(b, other)
}

// Global log buffer
var globalBuffer = NewBuffer(1024 * 1024) // 1MB buffer

// GetGlobalBuffer returns the global log buffer
func GetGlobalBuffer() *Buffer {
	return globalBuffer
}

