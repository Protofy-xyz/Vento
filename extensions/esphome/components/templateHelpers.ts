import { toNumberFromGpio } from './utils'

export const normalizeGpioHandle = (value?: string | number) => {
  if (value === undefined || value === null) return ''
  const str = String(value).trim().toUpperCase()
  if (!str) return ''
  if (str.startsWith('GPIO')) return str
  if (/^\d+$/.test(str)) return `GPIO${str}`
  return str
}

export const extractPinNumber = (value?: string | number) => {
  const parsed = toNumberFromGpio(value)
  return typeof parsed === 'number' ? parsed : undefined
}
