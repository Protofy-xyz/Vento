// Package cards provides embedded card HTML templates for device monitors and actions.
package cards

import (
	_ "embed"
)

// Bytes is a card template that formats byte values to human-readable format (KB, MB, GB, TB)
//
//go:embed bytes.js
var Bytes string
