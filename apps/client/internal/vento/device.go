package vento

// DevicePayload represents the device registration payload.
type DevicePayload struct {
	Name       string      `json:"name"`
	CurrentSDK string      `json:"currentSdk"`
	Subsystem  []Subsystem `json:"subsystem,omitempty"`
}

// Subsystem defines monitors/actions for a device capability.
type Subsystem struct {
	Name     string    `json:"name"`
	Type     string    `json:"type"`
	Monitors []Monitor `json:"monitors,omitempty"`
	Actions  []Action  `json:"actions,omitempty"`
}

// Monitor configures a monitor endpoint.
type Monitor struct {
	Name           string         `json:"name"`
	Label          string         `json:"label"`
	Description    string         `json:"description,omitempty"`
	Units          string         `json:"units,omitempty"`
	Endpoint       string         `json:"endpoint"`
	ConnectionType string         `json:"connectionType"`
	CardProps      map[string]any `json:"cardProps,omitempty"`
	Ephemeral      bool           `json:"ephemeral"`
}

// Action configures an action endpoint.
type Action struct {
	Name           string         `json:"name"`
	Label          string         `json:"label"`
	Description    string         `json:"description,omitempty"`
	Endpoint       string         `json:"endpoint"`
	ConnectionType string         `json:"connectionType"`
	Payload        ActionPayload  `json:"payload"`
	CardProps      map[string]any `json:"cardProps,omitempty"`
	Mode           string         `json:"mode,omitempty"`
	ReplyTimeoutMs int            `json:"replyTimeoutMs,omitempty"`
}

// ActionPayload describes the expected payload contract for an action.
type ActionPayload struct {
	Type   string         `json:"type"`
	Schema map[string]any `json:"schema,omitempty"`
	Value  any            `json:"value,omitempty"`
}

const (
	PrintActionEndpoint   = "/system/actions/print"
	ExecuteActionEndpoint = "/system/actions/execute"
	ListDirActionEndpoint = "/system/actions/list_dir"
	ReadFileActionEndpoint = "/system/actions/read_file"
	WriteFileActionEndpoint = "/system/actions/write_file"
	DeleteFileActionEndpoint = "/system/actions/delete_file"
	MkdirActionEndpoint = "/system/actions/mkdir"
	MemoryTotalEndpoint   = "/system/monitors/memory_total"
	MemoryUsageEndpoint   = "/system/monitors/memory_used"
	SystemSubsystemName   = "system"
	SystemSubsystemType   = "virtual"
	PrinterSubsystemName  = "stdout"
)

// BuildDevicePayload builds the device payload using the provided subsystem definitions.
func BuildDevicePayload(deviceName string, subs []Subsystem) DevicePayload {
	return DevicePayload{
		Name:       deviceName,
		CurrentSDK: "ventoagent",
		Subsystem:  subs,
	}
}
