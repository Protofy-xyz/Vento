package config

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

// Prompter handles interactive stdin prompts.
type Prompter struct {
	reader *bufio.Reader
	writer io.Writer
}

// NewPrompter creates a new interactive prompter backed by the given reader/writer.
func NewPrompter(r io.Reader, w io.Writer) *Prompter {
	return &Prompter{
		reader: bufio.NewReader(r),
		writer: w,
	}
}

// Ask prompts the user for input without defaulting.
func (p *Prompter) Ask(label string) (string, error) {
	return p.ask(label, "")
}

// AskDefault prompts the user and falls back to defaultValue on empty input.
func (p *Prompter) AskDefault(label, defaultValue string) (string, error) {
	return p.ask(label, defaultValue)
}

func (p *Prompter) ask(label, defaultValue string) (string, error) {
	display := label
	if defaultValue != "" {
		display = fmt.Sprintf("%s [%s]", label, defaultValue)
	}
	if _, err := fmt.Fprintf(p.writer, "%s: ", display); err != nil {
		return "", err
	}
	line, err := p.reader.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}
	value := strings.TrimSpace(line)
	if value == "" {
		value = strings.TrimSpace(defaultValue)
	}
	return value, nil
}
