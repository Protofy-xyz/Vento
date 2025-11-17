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

export const buildSwitchSubsystems = (switchConfig: any): any[] => {
  if (!switchConfig) return []
  const switches = Array.isArray(switchConfig) ? switchConfig : [switchConfig]
  return switches
    .filter((sw) => sw && (sw.platform === 'gpio' || sw.type === 'switch'))
    .map((sw, idx) => {
      const componentId = sw.id || `Relay${idx + 1}`
      const name = sw.id || sw.name || componentId
      return {
        componentId,
        name,
        type: 'switch',
        config: {
          restoreMode: sw.restore_mode || sw.restoreMode || 'OFF',
        },
        actions: [
          {
            name: 'on',
            label: 'Turn on',
            description: 'turns on the gpio',
          },
          {
            name: 'off',
            label: 'Turn off',
            description: 'turns off the gpio',
          },
          {
            name: 'toggle',
            label: 'Toggle',
            description: 'Toggles the gpio',
          },
        ],
      }
    })
}
