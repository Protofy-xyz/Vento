import React, { useMemo } from 'react'
import { SelectList } from 'protolib/components/SelectList'
import type { SelectTriggerProps } from '@my/ui'

type ConnectionSelectProps = {
  title: string
  value?: string | null
  onValueChange: (value: string) => void
  connectionOptions?: string[]
  placeholder?: string
  triggerProps?: SelectTriggerProps
  selectorStyle?: {
    normal?: Record<string, any>
    hover?: Record<string, any>
  }
}

const defaultTriggerProps: SelectTriggerProps = {
  backgroundColor: 'transparent',
  borderColor: 'var(--gray6)',
  width: '100%',
}

const defaultSelectorStyle = { normal: { width: '100%' } }

const sanitizeOptions = (connectionOptions?: string[]) =>
  Array.from(
    new Set(
      (connectionOptions || []).filter(
        (option): option is string =>
          typeof option === 'string' && option.trim().length > 0
      )
    )
  )

const ConnectionSelect = ({
  title,
  value,
  onValueChange,
  connectionOptions,
  placeholder = 'Selecciona un pin o bus',
  triggerProps,
  selectorStyle,
}: ConnectionSelectProps) => {
  const sanitizedOptions = useMemo(
    () => sanitizeOptions(connectionOptions),
    [connectionOptions]
  )

  const elements = useMemo(() => {
    const baseElements = sanitizedOptions.map((option) => ({
      value: option,
      caption: option,
    }))

    const currentValue = value ?? ''
    if (currentValue && !sanitizedOptions.includes(currentValue)) {
      baseElements.push({ value: currentValue, caption: currentValue })
    }

    return [{ value: '', caption: 'Sin conexión' }, ...baseElements]
  }, [sanitizedOptions, value])

  return (
    <SelectList
      title={title}
      elements={elements}
      value={value ?? ''}
      setValue={onValueChange}
      placeholder={placeholder}
      triggerProps={{ ...defaultTriggerProps, ...(triggerProps || {}) }}
      selectorStyle={selectorStyle ?? defaultSelectorStyle}
    />
  )
}

export default ConnectionSelect

