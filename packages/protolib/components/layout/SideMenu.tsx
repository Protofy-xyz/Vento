import React from 'react'
import { YStack, useMedia, Button, Square, XStack, TooltipSimple } from '@my/ui'
import { useState } from 'react'
import { PanelLeftOpen, PanelLeftClose, PanelLeft, Globe, Settings } from '@tamagui/lucide-icons'
import { SiteConfig } from '@my/config/dist/AppConfig'
import { ThemeToggle } from '../../components/ThemeToggle'
import { ColorToggleButton } from '../../components/ColorToggleButton'
import { SessionLogoutButton } from '../../components/SessionLogoutButton'
import { isElectron } from '../../lib/isElectron'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { Popover } from '../../components/Popover'

export const CollapsedSideMenuAtom = atomWithStorage('collapsedSideMenu', false)

export const SideMenu = ({ sideBarColor = '$background', children, themeSwitcher = true, tintSwitcher = true, logo, collapsedLogo, ...props }: any) => {
    const disableOpenMenu = false

    const isXs = useMedia().xs
    const [open, setOpen] = useState(false)
    const [collapsed, setCollapsed] = useAtom(CollapsedSideMenuAtom)
    const width = collapsed ? 64 : 260

    const settingsTintSwitcher = SiteConfig.ui?.tintSwitcher
    const settingsThemeSwitcher = SiteConfig.ui?.themeSwitcher

    const settingsTintSwitcherEnabled = settingsTintSwitcher === undefined ? true : settingsTintSwitcher
    const settingsThemeSwitcherEnabled = settingsTintSwitcher === undefined ? true : settingsThemeSwitcher

    return <YStack id="app-sidemenu" bw={0} bc={sideBarColor} {...props}>
        <YStack
            animateOnly={["width"]}
            // @ts-ignore
            animation="quick"
            width={width}
            height="0"
            flex={1}
            overflow={"hidden"}
            $sm={{
                zIndex: 100,
                height: '100%',
                backgroundColor: "$backgroundStrong",
                display: open ? 'flex' : 'none',
            }}
            style={{ overflowY: 'auto' }}
        >
            <YStack px={collapsed ? "$2" : "$5"} pt={collapsed ? "$3" : "$5"} jc="center" ai={collapsed ? "center" : "flex-start"} height={"fit-content"}>
                {/* do not use ternary, use `display` to have both images loaded and only play 
                with visibility */}
                <YStack display={collapsed ? "none" : "flex"}>{logo}</YStack>
                <YStack display={collapsed ? "flex" : "none"}>{collapsedLogo}</YStack>
            </YStack>
            <YStack pos='relative'>
                {React.cloneElement(children, { ...children.props, collapsed })}
            </YStack>
        </YStack>
        <XStack jc={collapsed ? "center" : "space-between"} m={collapsed ? "$2" : "$4"} ai="center">
            {(tintSwitcher || themeSwitcher) &&
                <XStack display={collapsed ? "none" : "flex"}>
                    {themeSwitcher && settingsThemeSwitcherEnabled && <ThemeToggle borderWidth={0} chromeless />}
                    {tintSwitcher && settingsTintSwitcherEnabled && <ColorToggleButton borderWidth={0} chromeless />}
                    {!isElectron() && <SessionLogoutButton borderWidth={0} chromeless />}
                    {isElectron() && <TooltipSimple
                        groupId="header-actions-theme"
                        label={`Open with browser`}
                    >
                        <Button
                            size="$3"
                            chromeless
                            onPress={() => window['electronAPI'].openExternal("http://localhost:8000")}
                            aria-label="Toggle light/dark color scheme"
                            icon={Globe}
                            scaleIcon={1.3}
                            color="$gray9"
                        >
                        </Button>
                    </TooltipSimple>}
                </XStack>
            }

            {collapsed ? (
                <Popover
                    menuPlacement="right"
                    color="$background"
                    trigger={
                        <YStack
                            p="$2"
                            cursor='pointer'
                            hoverStyle={{ backgroundColor: '$gray4' }}
                            br="$4"
                        >
                            <Settings size={20} color="$gray9" strokeWidth={1.5} />
                        </YStack>
                    }
                >
                    <XStack p="$2" gap="$1" ai="center">
                        {themeSwitcher && settingsThemeSwitcherEnabled && <ThemeToggle borderWidth={0} chromeless />}
                        {tintSwitcher && settingsTintSwitcherEnabled && <ColorToggleButton borderWidth={0} chromeless />}
                        {!isElectron() && <SessionLogoutButton borderWidth={0} chromeless />}
                        {isElectron() && (
                            <TooltipSimple label="Open in browser">
                                <Button
                                    size="$3"
                                    chromeless
                                    onPress={() => window['electronAPI'].openExternal("http://localhost:8000")}
                                    icon={Globe}
                                    scaleIcon={1.3}
                                    color="$gray9"
                                />
                            </TooltipSimple>
                        )}
                    </XStack>
                </Popover>
            ) : (
                <YStack
                    onPress={() => setCollapsed(!collapsed)}
                    p="$2"
                    als="flex-end"
                    cursor='pointer'
                    hoverStyle={{ backgroundColor: '$gray4' }}
                    br="$4"
                >
                    <Square animation="quick">
                        <PanelLeft size={19} color="$gray9" />
                    </Square>
                </YStack>
            )}
        </XStack>
        {
            isXs && !disableOpenMenu && <>
                <YStack
                    backgroundColor="$background"
                    h="100%"
                    width='100vw'
                    display={open ? 'flex' : 'none'}
                    onPress={e => {
                        setOpen(false)
                        e.stopPropagation()
                    }}
                ></YStack>

                <Button
                    onPress={() => setOpen(!open)}
                    position="fixed"
                    zIndex={99999}
                    left="16px"
                    top="15px"
                    icon={open ? PanelLeftClose : PanelLeftOpen}
                    scaleIcon={1.5}
                    size="$3"
                    backgroundColor="transparent"
                    circular
                >
                </Button>
            </>
        }
    </YStack >
}