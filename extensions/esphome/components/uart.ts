import { deepClone } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'
import { normalizeGpioHandle, extractPinNumber } from './templateHelpers'

export const buildUARTComponents = (uartConfig: any): any[] => {
  if (!uartConfig) return []
  const uartConfigs = Array.isArray(uartConfig) ? uartConfig : [uartConfig]

  return uartConfigs.map((uart, idx) => {
    const uartId = uart.id || UART
    return {
      id: uartId,
      type: 'device',
      label: uart.name || UART ,
      category: 'uart',
      meta: {
        kind: 'uart',
        raw: deepClone(uart),
      },
      editableProps: {
        baud: {
          type: 'number',
          label: 'Baud Rate',
          description: 'Baud rate for UART communication',
          default: uart.baud_rate || 115200,
        },
      },
      pins: {
        left: [
          {
            name: 'tx',
            description: 'tx pin of UART bus',
            connectedTo: uart.tx_pin !== undefined ? GPIO : null,
            type: 'input',
          },
          {
            name: 'rx',
            description: 'rx pin of UART bus',
            connectedTo: uart.rx_pin !== undefined ? GPIO : null,
            type: 'input',
          },
        ],
        right: [
          {
            name: 'uart_bus',
            description: 'UART bus',
            connectedTo: null,
            type: 'output',
          },
        ],
      },
    }
  })
}

export const buildUARTTemplate = (
  context: ComponentTemplateContext
): ComponentTemplate => {
  const uartIndex = (context.componentCounts['uart'] || 0) + 1
  return {
    label: 'UART',
    description: 'Configures a UART bus with TX/RX.',
    fields: [
      { name: 'id', label: 'Internal ID', type: 'text', required: true },
      { name: 'label', label: 'Display name', type: 'text' },
      {
        name: 'tx_pin',
        label: 'TX GPIO',
        type: 'text',
        required: true,
        placeholder: 'GPIO1',
        useConnectionDatalist: true,
      },
      {
        name: 'rx_pin',
        label: 'RX GPIO',
        type: 'text',
        required: true,
        placeholder: 'GPIO3',
        useConnectionDatalist: true,
      },
      {
        name: 'baud_rate',
        label: 'Baud rate',
        type: 'number',
        placeholder: '115200',
      },
    ],
    defaults: {
      id: context.ensureUniqueId(`UART${uartIndex}`),
      label: `UART ${uartIndex}`,
      tx_pin: '',
      rx_pin: '',
      baud_rate: 115200,
    },
    build: (values, helpers) => {
      const id = helpers.ensureUniqueId(values.id || `UART${uartIndex}`)
      const label = values.label || id
      const txPin = normalizeGpioHandle(values.tx_pin)
      const rxPin = normalizeGpioHandle(values.rx_pin)
      const baudRate =
        values.baud_rate === '' || values.baud_rate === undefined
          ? 115200
          : Number(values.baud_rate)
      return {
        id,
        type: 'device',
        label,
        category: 'uart',
        meta: {
          kind: 'uart',
          raw: {
            id,
            name: label,
            baud_rate: baudRate,
            tx_pin: extractPinNumber(txPin),
            rx_pin: extractPinNumber(rxPin),
          },
        },
        editableProps: {
          baud: {
            type: 'number',
            label: 'Baud Rate',
            description: 'Baud rate for UART communication',
            default: baudRate,
          },
        },
        pins: {
          left: [
            {
              name: 'tx',
              description: 'tx pin of UART bus',
              connectedTo: txPin,
              type: 'input',
            },
            {
              name: 'rx',
              description: 'rx pin of UART bus',
              connectedTo: rxPin,
              type: 'input',
            },
          ],
          right: [
            {
              name: 'uart_bus',
              description: 'UART bus',
              connectedTo: null,
              type: 'output',
            },
          ],
        },
      }
    },
  }
}
