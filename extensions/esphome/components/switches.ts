import { deepClone } from './utils'

export const buildSwitchComponents = (switchConfig: any): any[] => {
  if (!switchConfig) return []
  const switches = Array.isArray(switchConfig) ? switchConfig : [switchConfig]

  return switches
    .filter((sw) => sw && sw.platform === 'gpio')
    .map((sw, idx) => {
      return {
        id: sw.id || `Relay${idx + 1}`,
        type: 'device',
        label: sw.name || `Relay${idx + 1}` ,
        category: 'switch',
        meta: {
          kind: 'switch',
          raw: deepClone(sw),
        },
        editableProps: {
          alwaysOn: {
            type: 'boolean',
            label: 'Always On',
            description: 'If enabled, the relay reset state will be always on.',
            default: sw.restore_mode === 'ALWAYS_ON',
          },
        },
        pins: {
          left: [
            {
              name: 'control',
              description: 'Control pin to activate the relay',
              connectedTo: sw.pin !== undefined ? `GPIO${sw.pin}` : null,
              type: 'input',
            },
          ],
          right: [],
        },
      }
    })
}
