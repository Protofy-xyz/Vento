// Package cards provides embedded card HTML templates for device monitors and actions.
package cards

import (
	_ "embed"
)

// Bytes formats byte values to human-readable format (KB, MB, GB, TB)
//
//go:embed bytes.js
var Bytes string

// Frequency formats MHz values to GHz when appropriate
//
//go:embed frequency.js
var Frequency string

// Text displays text values elegantly without textarea
//
//go:embed text.js
var Text string
