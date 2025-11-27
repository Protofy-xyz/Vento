import { XStack, Text, SizableText, StackProps, Paragraph, Stack, Tooltip } from '@my/ui'
import React from 'react'
import { useThemeSetting } from '@tamagui/next-theme'

export type PanelMenuItemProps = {
  icon?: React.ReactNode,
  text?: React.ReactNode,
  children?: React.ReactNode,
  onPress?: any,
  selected?: boolean,
  collapsed?: boolean
  extraLabel?: React.ReactNode;
}

export const PanelMenuItem = React.forwardRef(({ onPress, children, selected, collapsed = false, icon, text, extraLabel, ...props }: PanelMenuItemProps & StackProps, ref: any) => {
  const { resolvedTheme } = useThemeSetting()
  return (
    <Tooltip delay={200} restMs={100}>
      <Tooltip.Trigger>
        <XStack
          ref={ref}
          paddingHorizontal={"$4"}
          paddingVertical={7}
          hoverStyle={{
            backgroundColor: resolvedTheme == 'dark' ? '$color1' : "$color3"
          }}
          ai="center"
          br="$4"
          h={40}
          f={1}
          onPress={onPress}
          cursor='pointer'
          {...collapsed ? {
            paddingHorizontal: 0,
            justifyContent: "center",
            borderRadius: 0,
            height: 48,
            position: 'relative',
            hoverStyle: {
              backgroundColor: 'transparent',
            }
          } : {}}
          {...(selected && !collapsed ? {
            backgroundColor: resolvedTheme == 'dark' ? '$color2' : "$color4"
          } : {})}
          {...props}
        >
          {collapsed && selected && (
            <Stack 
              position="absolute" 
              left={-8} 
              height={36} 
              width={3} 
              backgroundColor="var(--color9)" 
              borderRadius={2}
            />
          )}
          {icon ? <Stack marginRight={text && !collapsed ? "$3" : "$0"}>
            {React.cloneElement(icon, { 
              ...icon.props, 
              color: selected ? 'var(--color8)' : icon.props?.color,
              ...(collapsed ? { 
                size: 28, 
                color: selected ? 'var(--gray11)' : 'var(--gray9)', 
                opacity: selected ? 1 : 0.6
              } : {})
            })}
          </Stack> : null}
          {text && !collapsed ? <SizableText numberOfLines={1} ellipsizeMode="tail" selectable={false} pointerEvents="none" color="$color" o={1} size="$4" fontWeight={selected ? "400" : "400"}>
            {text}
          </SizableText> : null}
          {extraLabel && !collapsed ? <XStack ml="auto" ai="center" jc="center" {...collapsed ? { ml: 0 } : {}}>
            <SizableText flexShrink={0} o={1} size="$1" bg="$color6" p="$2" borderRadius={"$5"} color="$color" pointerEvents="none" selectable={false}>{extraLabel}</SizableText>
          </XStack> : null}
          {children}
        </XStack>
      </Tooltip.Trigger>
      {collapsed && <Tooltip.Content
        enterStyle={{ x: 0, y: -5, opacity: 0, scale: 0.9 }}
        exitStyle={{ x: 0, y: -5, opacity: 0, scale: 0.9 }}
        scale={1}
        x={0}
        y={0}
        opacity={1}
        py="$2"
        animation={[
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
      >
        <Tooltip.Arrow />
        <Paragraph size="$2" lineHeight="$1">
          {text}
        </Paragraph>
      </Tooltip.Content>}
    </Tooltip>
  )
})