import { deepClone } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'
import { normalizeGpioHandle, extractPinNumber } from './templateHelpers'

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
            label: 'Restore mode',
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

export const buildSwitchTemplate = (
  context: ComponentTemplateContext
): ComponentTemplate => {
  const relayIndex = (context.componentCounts['switch'] || 0) + 1
  return {
    label: 'Relé / Switch GPIO',
    description: 'Crea un relé controlado por un pin digital.',
    fields: [
      { name: 'id', label: 'ID interno', type: 'text', required: true },
      { name: 'label', label: 'Nombre visible', type: 'text' },
      {
        name: 'pin',
        label: 'GPIO',
        type: 'text',
        required: true,
        placeholder: 'GPIO25',
        useConnectionDatalist: true,
      },
      {
        name: 'alwaysOn',
        label: 'Restore mode',
        type: 'boolean',
        description: 'Mantiene el relé activado tras reinicio.',
      },
    ],
    defaults: {
      id: context.ensureUniqueId(`Relay${relayIndex}`),
      label: `Relay ${relayIndex}`,
      pin: '',
      alwaysOn: false,
    },
    build: (values, helpers) => {
      const id = helpers.ensureUniqueId(values.id || `Relay${relayIndex}`)
      const label = values.label || id
      const pin = normalizeGpioHandle(values.pin)
      const pinNumber = extractPinNumber(pin)
      return {
        id,
        type: 'device',
        label,
        category: 'switch',
        meta: {
          kind: 'switch',
          raw: {
            id,
            name: label,
            platform: 'gpio',
            pin: pinNumber,
            restore_mode: values.alwaysOn ? 'ALWAYS_ON' : 'ALWAYS_OFF',
          },
        },
        editableProps: {
          alwaysOn: {
            type: 'boolean',
            label: 'Restore mode',
            description: 'If enabled, the relay reset state will be always on.',
            default: !!values.alwaysOn,
          },
        },
        pins: {
          left: [
            {
              name: 'control',
              description: 'Control pin to activate the relay',
              connectedTo: pin,
              type: 'input',
            },
          ],
          right: [],
        },
      }
    },
  }
}
