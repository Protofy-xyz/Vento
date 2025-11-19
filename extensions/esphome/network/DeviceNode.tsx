import { Text, TooltipSimple, YStack } from '@my/ui'
import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

export const DeviceNode = memo(({ data, selected }: NodeProps<any>) => {
  const {
    id,
    label,
    pins = {},
    editableProps = {},
    side
  } = data
  const componentImage = data?.meta?.image?.src ?? null
  const leftPins = pins.left || []
  const rightPins = pins.right || []
  const editableEntries = Object.entries(editableProps)
  const hasEditableProps = editableEntries.length > 0
  const handleRows = Math.max(leftPins.length, rightPins.length, 1)
  const handlesAreaHeight = handleRows * 28

  // colores según tipo
  const getPinColor = (pin: any) => {
    const t = pin.type?.toLowerCase?.() || ''
    if (t.includes('power')) return '#666'
    if (t.includes('gpio')) return '#3b82f6'
    if (t.includes('input')) return 'var(--color7)'
    if (t.includes('output')) return 'var(--color8)'
    if (t.includes('bus')) return '#00c896'
    return 'var(--color7)'
  }

  const isCenter = data.center ?? false
  const isLeftSide = side === 'left'
  const isRightSide = side === 'right'

  const borderColor = selected ? 'var(--color7)' : 'var(--gray6)'

  return (
    <YStack
      hoverStyle={{
        scale: 1.02,
      }}
      animation="bouncy"
      scale={selected ? 1.02 : 1}
      borderRadius="$6"
      padding={isCenter ? '$0' : '$2'}
      style={{
        width: isCenter ? 320 : 200,
        height: isCenter ? 480 : 'auto',
        border: `1px solid ${borderColor}`,
        backgroundColor: 'var(--bgPanel)',
        position: 'relative',
        display: 'flex',
        alignItems: isCenter ? 'center' : 'flex-start',
      }}
    >

      {/* === ESP32 (sin cambios visuales) === */}
      {isCenter && (
        <>
          {componentImage && (
            <div
              style={{
                position: 'absolute',
                inset: 24,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <img
                src={componentImage}
                alt={label || id}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  ...(data?.meta?.image?.style ? data.meta.image.style : {})
                }}
              />
            </div>
          )}

          <Text
            fontSize="$5"
            fontWeight="700"
            style={{
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              width: '100%',
              marginTop: 12,
              color: 'var(--color)',
            }}
          >
            {label || id}
          </Text>

          {/* LEFT PINS */}
          {leftPins.map((p: any, i: number) => {
            const top = ((i + 1) * 100) / (leftPins.length + 1)
            const color = getPinColor(p)
            return (
              <div
                key={`L-${p.name}`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: 0,
                  width: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingLeft: 6,
                  transform: 'translateY(-50%)',
                }}
              >
                <Handle
                  id={p.name}
                  type="source"
                  position={Position.Left}
                  style={{
                    background: color,
                    width: 8,
                    height: 8,
                    marginRight: 6,
                  }}
                />
                <Text fontSize="$2">{p.name}</Text>
              </div>
            )
          })}

          {/* RIGHT PINS */}
          {rightPins.map((p: any, i: number) => {
            const top = ((i + 1) * 100) / (rightPins.length + 1)
            const color = getPinColor(p)
            return (
              <div
                key={`R-${p.name}`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  right: 0,
                  width: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 6,
                  transform: 'translateY(-50%)',
                }}
              >
                <Text fontSize="$2">{p.name}</Text>
                <Handle
                  id={p.name}
                  type="source"
                  position={Position.Right}
                  style={{
                    background: color,
                    width: 8,
                    height: 8,
                  }}
                />
              </div>
            )
          })}
        </>
      )}

      {/* === OTROS DISPOSITIVOS === */}
      {!isCenter && (
        <>
          {/* Editable props */}
          <YStack width="100%" gap="$3">
            <Text
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {label || id}
            </Text>

            {hasEditableProps && (
              <YStack maxWidth="100%" flex={1} gap="$2">
                {editableEntries.map(([key, prop]: any) => (
                  <TooltipSimple label={String(prop.default)} restMs={0} delay={{ open: 500, close: 0 }}>
                    <YStack key={key} flex={1} backgroundColor="$bgContent" borderRadius="$5" padding="$2" gap="$1">
                      <Text fontSize="$1" color="$gray9" textAlign={'left'}>
                        {prop.label || key}
                      </Text>
                      <Text
                        fontSize="$2"
                        fontWeight="300"
                        color="$color"
                        textAlign={'left'}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {String(prop.default)}
                      </Text>
                    </YStack>
                  </TooltipSimple>
                ))}
              </YStack>
            )}
          </YStack>

          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: handlesAreaHeight,
              marginTop: hasEditableProps ? 12 : 8,
            }}
          >
            {/* === INPUTS === */}
            {leftPins.map((pin: any, i: number) => {
              const top = ((i + 1) * 100) / (leftPins.length + 1)
              const color = getPinColor(pin)

              const isRight = isRightSide
              const handlePos = isRight ? Position.Left : Position.Right
              const handleType = 'target'
              const justify = isRight ? 'flex-start' : 'flex-end'

              return (
                <div
                  key={`IN-${pin.name}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: isRight ? 0 : 'auto',
                    right: isRight ? 'auto' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: justify,
                    transform: 'translateY(-50%)',
                  }}
                >
                  {isRight ? (
                    <>
                      <Handle
                        id={pin.name}
                        type={handleType}
                        position={handlePos}
                        style={{
                          background: color,
                          width: 8,
                          height: 8,
                          marginLeft: -8,
                        }}
                      />
                      <Text fontSize="$2">{pin.name}</Text>
                    </>
                  ) : (
                    <>
                      <Text fontSize="$2">{pin.name}</Text>
                      <Handle
                        id={pin.name}
                        type={handleType}
                        position={handlePos}
                        style={{
                          background: color,
                          width: 8,
                          height: 8,
                          marginRight: -8,
                        }}
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* === OUTPUTS === */}
            {rightPins.map((pin: any, i: number) => {
              const top = ((i + 1) * 100) / (rightPins.length + 1)
              const color = getPinColor(pin)

              const isRight = isRightSide
              const handlePos = isRight ? Position.Right : Position.Left
              const handleType = 'source'
              const justify = isRight ? 'flex-end' : 'flex-start'

              return (
                <div
                  key={`OUT-${pin.name}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    right: isRight ? 0 : 'auto',
                    left: isRight ? 'auto' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: justify,
                    transform: 'translateY(-50%)',
                  }}
                >
                  {isRight ? (
                    <>
                      <Text fontSize="$2">{pin.name}</Text>
                      <Handle
                        id={pin.name}
                        type={handleType}
                        position={handlePos}
                        style={{
                          background: color,
                          width: 8,
                          height: 8,
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Handle
                        id={pin.name}
                        type={handleType}
                        position={handlePos}
                        style={{
                          background: color,
                          width: 8,
                          height: 8,
                          marginRight: 6,
                        }}
                      />
                      <Text fontSize="$2">{pin.name}</Text>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

    </YStack>
  )
})

export default DeviceNode