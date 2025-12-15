import React, { memo } from 'react'
import { YStack, Text, XStack, TooltipSimple } from '@my/ui'
import { Handle, Position } from '@xyflow/react'
import { 
  Smartphone, Monitor, Cpu, Bot, Wifi, WifiOff, 
  Layers, Tag, Sparkles, AlertTriangle
} from '@tamagui/lucide-icons'
import { Tinted } from 'protolib/components/Tinted'
import { getIconUrl } from 'protolib/components/IconSelect'
import { shouldShowInArea } from 'protolib/helpers/Visibility'
import { ItemMenu } from 'protolib/components/ItemMenu'

// Get icon based on platform
export const getIconForPlatform = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case 'android':
    case 'mobile':
      return Smartphone
    case 'ventoagent':
    case 'desktop':
    case 'computer':
      return Monitor
    case 'esphome':
    case 'arduino':
      return Cpu
    default:
      return Bot
  }
}

// Mini chip for tags
const MiniChip = memo(({ label, color }: { label: string; color?: string }) => (
  <XStack
    br="$10"
    px="$2"
    py="$0.5"
    bg={color || '$color4'}
    ai="center"
  >
    <Text fontSize={9} fontWeight="500" color="$color8" numberOfLines={1}>
      {label}
    </Text>
  </XStack>
))

// Card icon preview (mini versions of board cards)
const CardIconPreview = memo(({ cards }: { cards: any[] }) => {
  const displayCards = cards?.slice(0, 5) || []
  const remaining = (cards?.length || 0) - 5
  
  if (!displayCards.length) return null
  
  return (
    <XStack gap="$1" ai="center" flexWrap="wrap">
      {displayCards.map((card, i) => (
        <YStack
          key={i}
          w={18}
          h={18}
          br={card.type === 'action' ? '$10' : '$1'}
          bg={card.color || '$color6'}
          ai="center"
          jc="center"
          opacity={0.85}
        >
          {card.icon && (
            <img
              src={getIconUrl(card.icon)}
              width={10}
              height={10}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            />
          )}
        </YStack>
      ))}
      {remaining > 0 && (
        <Text fontSize={9} color="$color8" ml="$1">+{remaining}</Text>
      )}
    </XStack>
  )
})

export type NetworkCardProps = {
  board: any
  platform?: string
  isConnected?: boolean
  isHidden?: boolean
  selected?: boolean
  // Mode: 'node' for ReactFlow, 'card' for grid
  mode?: 'node' | 'card'
  // For node mode
  handlePosition?: Position
  // For card mode
  onPress?: () => void
  onDelete?: () => void
  width?: number
}

// Network Card - unified rich design for all boards
export const NetworkCard = memo(({ 
  board,
  platform = 'virtual',
  isConnected: isConnectedProp,
  isHidden: isHiddenProp,
  selected = false,
  mode = 'card',
  handlePosition,
  onPress,
  onDelete,
  width
}: NetworkCardProps) => {
  // Show connection status only if explicitly provided
  // In grid view we don't have real-time connection info, so don't show badge
  const showConnectionStatus = isConnectedProp !== undefined
  const isConnected = isConnectedProp ?? false // Default to false when unknown
  const IconComponent = getIconForPlatform(platform)
  const cards = board?.cards || []
  const tags = board?.tags || []
  const displayName = board?.displayName || board?.name
  const hasAutopilot = board?.autopilot
  
  // Determine if hidden based on prop or visibility
  const isHidden = isHiddenProp ?? !shouldShowInArea(board, 'agents')
  
  // Border and styling only reflect connection status if we know it
  const borderColor = !showConnectionStatus ? '$color6' : (isConnected ? '$color8' : '$gray6')
  const bgColor = selected ? '$color2' : '$bgPanel'
  
  const cardWidth = mode === 'node' ? 260 : (width || '100%')
  const cardHeight = mode === 'node' ? 140 : 'auto'
  
  const content = (
    <YStack
      width={cardWidth}
      height={cardHeight}
      minHeight={mode === 'card' ? 140 : undefined}
      maxWidth={mode === 'card' ? (width || 400) : undefined}
      br="$4"
      bg={bgColor}
      borderWidth={showConnectionStatus && isConnected ? 2 : 1}
      borderColor={borderColor}
      cursor={'pointer'}
      hoverStyle={onPress ? { 
        borderColor: !showConnectionStatus ? '$color8' : (isConnected ? '$color8' : '$gray7'),
        scale: 1.01 
      } : {}}
      pressStyle={onPress ? { scale: 0.98 } : {}}
      onPress={onPress}
      style={{
        boxShadow: selected 
          ? '0 12px 32px rgba(0,0,0,0.25), 0 0 0 2px var(--color9)' 
          : (showConnectionStatus && isConnected)
            ? '0 6px 20px rgba(0,0,0,0.12), 0 0 20px rgba(var(--color9-rgb), 0.15)' 
            : '0 4px 12px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Hidden board badge - like the original BoardPreview */}
      {isHidden && (
        <Tinted>
          <TooltipSimple
            label="This board is hidden from default views. You can still see it when showing boards from all views."
            delay={{ open: 500, close: 0 }}
            restMs={0}
          >
            <XStack 
              position="absolute" 
              top={-10} 
              right={10} 
              bg="$yellow9" 
              br="$2" 
              px="$2" 
              py="$1"
              ai="center"
              gap="$1"
              zIndex={10}
            >
              <AlertTriangle size={12} color="black" />
              <Text fontSize={10} fontWeight="600" color="black" numberOfLines={1}>
                Hidden board
              </Text>
            </XStack>
          </TooltipSimple>
        </Tinted>
      )}
      
      {/* Header section */}
      <YStack p="$3" pb="$2">
        <XStack ai="flex-start" jc="space-between">
          <XStack ai="center" gap="$2" f={1} onPress={onPress}>
            <YStack
              w={36}
              h={36}
              br="$3"
              ai="center"
              jc="center"
              bg={!showConnectionStatus ? '$color4' : (isConnected ? '$color4' : '$gray4')}
            >
              <IconComponent 
                size={20} 
                color={!showConnectionStatus ? 'var(--color10)' : (isConnected ? 'var(--color10)' : 'var(--gray9)')} 
              />
            </YStack>
            <YStack f={1}>
              <XStack ai="center" gap="$1">
                <Text 
                  fontSize="$3" 
                  fontWeight="700" 
                  color="color9"
                  numberOfLines={1}
                  style={{ maxWidth: mode === 'card' ? 200 : 140 }}
                >
                  {displayName}
                </Text>
                {hasAutopilot && (
                  <Sparkles size={12} color="var(--color9)" />
                )}
              </XStack>
              <Text fontSize={10} color="$color8" numberOfLines={1}>
                {board?.name}
              </Text>
            </YStack>
          </XStack>
          
          {/* Right side: connection status + menu */}
          <XStack ai="center" gap="$2">
            {/* Connection status - only show if we have real connection info */}
            {showConnectionStatus && (
              isConnected ? (
                <XStack ai="center" gap="$1" bg="$color2" br="$10" px="$2" py="$1">
                  <Wifi size={10} color="var(--color10)" />
                  <Text fontSize={9} fontWeight="600" color="$color8">ON</Text>
                </XStack>
              ) : (
                <XStack ai="center" gap="$1" bg="$gray3" br="$10" px="$2" py="$1">
                  <WifiOff size={10} color="var(--gray8)" />
                  <Text fontSize={9} fontWeight="500" color="$gray9">OFF</Text>
                </XStack>
              )
            )}
            
            {/* Menu (both card and node modes) */}
            {onDelete && (
              <XStack
                onClick={(e) => { e.stopPropagation?.(); e.preventDefault?.(); }}
                onPointerDown={(e) => { e.stopPropagation?.(); }}
              >
                <ItemMenu
                  type="item"
                  sourceUrl={`/api/core/v1/boards/${board?.name}`}
                  element={{ data: board }}
                  deleteable={() => true}
                  onDelete={onDelete}
                />
              </XStack>
            )}
          </XStack>
        </XStack>
      </YStack>
      
      {/* Content section */}
      <YStack px="$3" pb="$3" gap="$2">
        {/* Cards preview */}
        {cards.length > 0 && (
          <XStack ai="center" gap="$2">
            <Layers size={11} color="var(--color8)" />
            <CardIconPreview cards={cards} />
            {cards.length > 0 && (
              <Text fontSize={9} color="$color8">
                {cards.length} card{cards.length !== 1 ? 's' : ''}
              </Text>
            )}
          </XStack>
        )}
        
        {/* Tags */}
        {tags.length > 0 && (
          <XStack ai="center" gap="$1" flexWrap="wrap">
            <Tag size={10} color="var(--color8)" />
            {tags.slice(0, 3).map((tag: string, i: number) => (
              <Tinted key={i}>
                <MiniChip label={tag} />
              </Tinted>
            ))}
            {tags.length > 3 && (
              <Text fontSize={9} color="$color8">+{tags.length - 3}</Text>
            )}
          </XStack>
        )}
        
        {/* Platform badge */}
        <XStack ai="center" jc="space-between">
          <XStack
            br="$2"
            px="$2"
            py="$0.5"
            bg="$color2"
          >
            <Text fontSize={9} fontWeight="600" color="$color10" textTransform="uppercase">
              {platform}
            </Text>
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )

  if (mode === 'node') {
    return (
      <div style={{ position: 'relative' }}>
        {content}
        {/* Invisible handle for floating edges (required by ReactFlow) */}
        <Handle 
          type="target" 
          position={handlePosition || Position.Left} 
          id="input"
          style={{ opacity: 0, pointerEvents: 'none' }} 
        />
      </div>
    )
  }

  return content
})

export default NetworkCard
