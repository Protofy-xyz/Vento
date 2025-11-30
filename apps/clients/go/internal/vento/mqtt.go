package vento

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// ActionEnvelope carries metadata about an action invocation.
type ActionEnvelope struct {
	Subsystem string
	Action    string
	Payload   []byte
	Topic     string
	RequestID string

	reply func([]byte) error
}

// Reply sends a raw payload back to the reply topic.
func (e ActionEnvelope) Reply(payload []byte) error {
	if e.reply == nil {
		return fmt.Errorf("reply channel not available")
	}
	return e.reply(payload)
}

// ReplyString replies using a string payload.
func (e ActionEnvelope) ReplyString(payload string) error {
	return e.Reply([]byte(payload))
}

// ReplyJSON marshals v to JSON and replies with it.
func (e ActionEnvelope) ReplyJSON(v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return e.Reply(data)
}

// CanReply indicates whether a reply topic was provided.
func (e ActionEnvelope) CanReply() bool {
	return e.reply != nil
}

// ActionHandler handles action messages.
type ActionHandler func(ActionEnvelope)

// ReconnectCallback is called when the client reconnects after a disconnect.
type ReconnectCallback func()

// ConnectionLostCallback is called when the client loses connection.
type ConnectionLostCallback func()

// MQTTClient wraps the MQTT client helper.
type MQTTClient struct {
	deviceName       string
	client           mqtt.Client
	onReconnect      ReconnectCallback
	onConnectionLost ConnectionLostCallback
	isFirstConnect   bool
}

// SetOnReconnect sets a callback to be called when the client reconnects.
func (m *MQTTClient) SetOnReconnect(cb ReconnectCallback) {
	m.onReconnect = cb
}

// SetOnConnectionLost sets a callback to be called when connection is lost.
func (m *MQTTClient) SetOnConnectionLost(cb ConnectionLostCallback) {
	m.onConnectionLost = cb
}

// ConnectMQTT establishes an MQTT connection using username/token.
func ConnectMQTT(ctx context.Context, baseURL *url.URL, deviceName, username, token string, handler ActionHandler) (*MQTTClient, error) {
	mqttClient := &MQTTClient{
		deviceName:     deviceName,
		isFirstConnect: true,
	}

	opts := mqtt.NewClientOptions()
	opts.AddBroker(buildBrokerAddress(baseURL))
	opts.SetClientID(fmt.Sprintf("%s-%d", deviceName, time.Now().UnixNano()))
	opts.SetKeepAlive(30 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(30 * time.Second)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)
	opts.SetUsername(username)
	opts.SetPassword(token)
	opts.SetOrderMatters(false)

	actionsTopic := fmt.Sprintf("devices/%s/+/actions/#", deviceName)

	opts.OnConnect = func(c mqtt.Client) {
		log.Printf("[mqtt] connected to broker")

		// Subscribe to actions topic
		if token := c.Subscribe(actionsTopic, 1, func(_ mqtt.Client, msg mqtt.Message) {
			subsystem, action, requestID, isReply := extractSubsystemAction(msg.Topic())
			if handler == nil || subsystem == "" || action == "" || isReply {
				return
			}
			env := ActionEnvelope{
				Subsystem: subsystem,
				Action:    action,
				Payload:   msg.Payload(),
				Topic:     msg.Topic(),
				RequestID: requestID,
			}
			if requestID != "" {
				replyTopic := msg.Topic() + "/reply"
				env.reply = func(payload []byte) error {
					token := c.Publish(replyTopic, 1, false, payload)
					token.Wait()
					return token.Error()
				}
			}
			handler(env)
		}); token.Wait() && token.Error() != nil {
			log.Printf("[mqtt] failed to subscribe to actions: %v", token.Error())
		} else {
			log.Printf("[mqtt] subscribed to %s", actionsTopic)
		}

		// Call reconnect callback (skip on first connect)
		if !mqttClient.isFirstConnect && mqttClient.onReconnect != nil {
			log.Printf("[mqtt] triggering reconnect callback")
			go mqttClient.onReconnect()
		}
		mqttClient.isFirstConnect = false
	}

	opts.OnConnectionLost = func(c mqtt.Client, err error) {
		log.Printf("[mqtt] connection lost: %v - will attempt to reconnect", err)
		if mqttClient.onConnectionLost != nil {
			go mqttClient.onConnectionLost()
		}
	}

	opts.OnReconnecting = func(c mqtt.Client, opts *mqtt.ClientOptions) {
		log.Printf("[mqtt] attempting to reconnect...")
	}

	client := mqtt.NewClient(opts)
	mqttClient.client = client

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
	if !tokenResp.WaitTimeout(15 * time.Second) {
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

	return mqttClient, nil
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

func extractSubsystemAction(topic string) (subsystem string, action string, requestID string, isReply bool) {
	parts := mqttTopicParts(topic)
	if len(parts) < 5 {
		return "", "", "", false
	}
	// topic format: devices/<device>/<subsystem>/actions/<action>
	if parts[0] != "devices" {
		return "", "", "", false
	}
	if parts[3] != "actions" {
		return "", "", "", false
	}
	subsystem = parts[2]
	action = parts[4]

	// replies follow .../<action>/<requestId>/reply
	if len(parts) >= 6 && parts[len(parts)-1] == "reply" {
		return "", "", "", true
	}

	if len(parts) >= 6 {
		requestID = parts[5]
	}
	return subsystem, action, requestID, false
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
