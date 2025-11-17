import { deepClone } from './utils'

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
