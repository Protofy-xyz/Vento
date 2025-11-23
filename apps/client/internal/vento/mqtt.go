package vento

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// ActionHandler handles action messages.
type ActionHandler func(subsystem, action string, payload []byte)

// MQTTClient wraps the MQTT client helper.
type MQTTClient struct {
	deviceName string
	client     mqtt.Client
}

// ConnectMQTT establishes an MQTT connection using username/token.
func ConnectMQTT(ctx context.Context, baseURL *url.URL, deviceName, username, token string, handler ActionHandler) (*MQTTClient, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(buildBrokerAddress(baseURL))
	opts.SetClientID(fmt.Sprintf("%s-%d", deviceName, time.Now().UnixNano()))
	opts.SetKeepAlive(30 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetUsername(username)
	opts.SetPassword(token)
	opts.SetOrderMatters(false)

	actionsTopic := fmt.Sprintf("devices/%s/+/actions/#", deviceName)
	opts.OnConnect = func(c mqtt.Client) {
		if token := c.Subscribe(actionsTopic, 1, func(_ mqtt.Client, msg mqtt.Message) {
			subsystem, action := extractSubsystemAction(msg.Topic())
			if handler != nil && subsystem != "" && action != "" {
				handler(subsystem, action, msg.Payload())
			}
		}); token.Wait() && token.Error() != nil {
			// log? best-effort
		}
	}

	client := mqtt.NewClient(opts)
	tokenResp := client.Connect()
	if tokenResp == nil {
		return nil, fmt.Errorf("invalid mqtt token")
	}
	cancelCh := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			client.Disconnect(200)
		case <-cancelCh:
		}
	}()
	defer close(cancelCh)
	if !tokenResp.WaitTimeout(10 * time.Second) {
		return nil, fmt.Errorf("timeout connecting to mqtt broker")
	}
	if err := tokenResp.Error(); err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	return &MQTTClient{
		deviceName: deviceName,
		client:     client,
	}, nil
}

func buildBrokerAddress(base *url.URL) string {
	host := "localhost"
	if base != nil && base.Hostname() != "" {
		host = base.Hostname()
	}
	return fmt.Sprintf("tcp://%s:%d", host, 1883)
}

// Publish sends the payload for the given endpoint.
func (m *MQTTClient) Publish(endpoint string, payload any) error {
	if m == nil {
		return fmt.Errorf("mqtt client not initialized")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	topic := fmt.Sprintf("devices/%s%s", m.deviceName, endpoint)
	token := m.client.Publish(topic, 1, false, data)
	token.Wait()
	return token.Error()
}

// Close disconnects the MQTT client.
func (m *MQTTClient) Close() {
	if m == nil || m.client == nil {
		return
	}
	m.client.Disconnect(250)
}

func extractSubsystemAction(topic string) (string, string) {
	parts := mqttTopicParts(topic)
	if len(parts) < 5 {
		return "", ""
	}
	// topic format: devices/<device>/<subsystem>/actions/<action>
	if parts[0] != "devices" {
		return "", ""
	}
	subsystem := parts[2]
	action := parts[len(parts)-1]
	return subsystem, action
}

func mqttTopicParts(topic string) []string {
	raw := strings.Split(topic, "/")
	parts := make([]string, 0, len(raw))
	for _, p := range raw {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}
