import { Text, TooltipSimple, YStack } from '@my/ui'
import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

export const DeviceNode = memo(({ data, selected }: NodeProps<any>) => {
  const { id, label, pins = {}, editableProps = {}, side } = data
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
      style={{
        width: isCenter ? 320 : 200,
        height: isCenter ? 480 : 'auto',
        border: `2px solid ${borderColor}`,
        backgroundColor: 'var(--bgPanel)',
        position: 'relative',
        display: 'flex',
        alignItems: isCenter ? 'center' : 'flex-start',
        // justifyContent: 'center',
        padding: isCenter ? 0 : 8,
      }}
    >

      {/* === ESP32 (sin cambios visuales) === */}
      {isCenter && (
        <> {label || id}

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
                <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{p.name}</span>
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
                <span style={{ fontSize: 9, whiteSpace: 'nowrap', marginRight: 6 }}>{p.name}</span>
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
                  <YStack key={key} flex={1}>
                    <Text fontSize="$2" color="$color" textAlign={leftPins.length > 0 ? 'center' : 'left'}>
                      {prop.label || key}
                    </Text>
                    <TooltipSimple label={String(prop.default)} restMs={0} delay={{ open: 500, close: 0 }}>
                      <Text
                        fontSize="$2"
                        fontWeight="300"
                        color="$color"
                        textAlign={leftPins.length > 0 ? 'center' : 'left'}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {String(prop.default)}
                      </Text>
                    </TooltipSimple>
                  </YStack>
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