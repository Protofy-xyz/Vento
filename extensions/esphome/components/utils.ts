export const deepClone = (value: any) => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

export const toNumberFromGpio = (handle?: string | number | null) => {
  if (handle === null || handle === undefined) return undefined
  if (typeof handle === 'number') return handle
  const text = String(handle)
  const match = text.match(/GPIO\s*(\d+)/i)
  if (match?.[1]) {
    return Number(match[1])
  }
  const genericDigits = text.match(/(\d+)/)
  if (genericDigits?.[1]) {
    return Number(genericDigits[1])
  }
  return text
}
