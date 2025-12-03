import { XStack, Text } from '@my/ui'
import { Tinted } from './Tinted'
import React, { createElement } from 'react'

type IconLike = React.ReactNode | React.ComponentType<{ size?: number }>

type TabItem = {
  id: string
  label?: string
  icon?: IconLike
  disabled?: boolean
}

type TabsArray = TabItem[]
type TabsMap = Record<string, Omit<TabItem, 'id'>>

type TabBarProps = {
  tabs: TabsArray | TabsMap
  selectedId?: string
  onSelect: (id: string) => void
  iconSize?: number
}

const normalizeTabs = (tabs: TabsArray | TabsMap): TabItem[] => {
  if (Array.isArray(tabs)) return tabs
  return Object.keys(tabs).map((id) => ({ id, ...tabs[id] }))
}

const renderIcon = (icon?: IconLike, size = 16) => {
  if (!icon) return null
  return React.isValidElement(icon) ? icon : createElement(icon, { size })
}

export const TabBar = React.forwardRef<any, TabBarProps>(
  ({ tabs, selectedId, onSelect, iconSize = 16, ...props }, ref) => {
    const items = normalizeTabs(tabs)

    return (
      <XStack borderBottomColor="$gray6" borderBottomWidth="1px" ref={ref} {...props}>
        {items.map((tab, index) => {
          const isSelected = selectedId === tab.id

          return (
            <Tinted key={tab.id ?? index}>
              <XStack
                onPress={() => !tab.disabled && onSelect(tab.id)}
                cursor={tab.disabled ? 'default' : 'pointer'}
                paddingVertical="$2.5"
                paddingHorizontal="$4"
                disabled={tab.disabled}
                style={{
                  boxShadow: isSelected ? '0px 2px 0px var(--color8)' : 'none',
                  transition: 'box-shadow 0.2s ease',
                }}
                justifyContent="center"
                gap="$2"
                alignItems="center"
                opacity={isSelected ? 1 : tab.disabled ? 0.2 : 0.6}
                hoverStyle={{ opacity: tab.disabled ? null : 0.9 }}
              >
                {renderIcon(tab.icon, iconSize)}
                {tab.label && <Text fontSize="$4">{tab.label}</Text>}
              </XStack>
            </Tinted>
          )
        })}
      </XStack>
    )
  }
)
