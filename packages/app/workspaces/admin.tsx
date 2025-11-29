import { Router, Cog, Boxes, Box, LayoutDashboard, Zap, Blocks, Bot, Folder } from '@tamagui/lucide-icons'
import { MonitorCog as RawMonitorCog } from 'lucide-react'
import { styled } from 'tamagui'

const MonitorCog = styled(RawMonitorCog, {
    name: 'MonitorCog',
    size: '$true',
    color: 'currentColor',
})

const enableArduinos = false

export default ({ boards, objects }) => {
    const objectsWithPage = objects ? objects.filter(o => o?.features?.adminPage) : []

    const integrations = [
        // { name: 'Agents', icon: Bot, href: '/workspace/boards' }, // Removed - using Network page via logo click
        { name: 'Assets', icon: Blocks, href: '/workspace/assets' },
        { name: 'Tasks', icon: Zap, href: '/workspace/tasks' },
        { name: 'Devices', icon: Router, href: '/workspace/devices' },
        { name: 'Storages', icon: Boxes, href: '/workspace/objects' },
        // { name: 'Events', icon: 'activity', href: '/workspace/events' },
        { name: 'Files', icon: Folder, href: '/workspace/files?path=/', path: '' },
        { name: 'Config', icon: Cog, href: '/workspace/config' },
    ]
    if (enableArduinos) integrations.push({ name: 'Arduinos', icon: Router, href: '/workspace/arduinos' })

    // const manageBoards = { name: 'Manage Boards', icon: MonitorCog, href: '/workspace/boards' }

    const objectsMenu = (objectsWithPage.length
        ? objectsWithPage.map((obj) => ({
            name: obj.name.charAt(0).toUpperCase() + obj.name.slice(1),
            icon: Box,
            href: '/workspace/' + obj.features.adminPage,
        }))
        : [])
    //objectsMenu.push({ name: 'Manage Storage', icon: Boxes, href: '/workspace/objects' })

    // Base menu groups
    const menuByGroup: Record<string, any[]> = {
        Boards: [],
        Storage: objectsMenu,
        Platform: integrations,
    }

    // 1. Group boards by category (preserve tags for later)
    if (Array.isArray(boards)) {
        boards.forEach((board) => {
            const category = board?.category || 'Agents'
            if (!menuByGroup[category]) menuByGroup[category] = []

            const display = (board.displayName ?? board.name) ?? ''
            const item = {
                name: display.charAt(0).toUpperCase() + display.slice(1),
                icon: board.icon ?? LayoutDashboard,
                href: '/workspace/boards/view?board=' + board.name,
                __tags: Array.isArray(board?.tags) ? board.tags : [],
            }
            menuByGroup[category].push(item)
        })
    }

    // 2. Process tags inside the "Boards" group only
    const tagOrder: string[] = []

    if (Array.isArray(menuByGroup['Agents'])) {
        const remainingInBoards: any[] = []

        menuByGroup['Agents'].forEach((item) => {
            const tags: string[] = item.__tags || []
            const cleanItem = { name: item.name, icon: item.icon, href: item.href }

            if (!tags.length) {
                remainingInBoards.push(cleanItem)
                return
            }

            // If tags exist, create or use a tab for each tag
            tags.forEach((raw) => {
                const tag = String(raw).trim()
                if (!tag) return

                // Capitalize the first letter of the tag
                const tabName = tag.charAt(0).toUpperCase() + tag.slice(1)

                if (!menuByGroup[tabName]) menuByGroup[tabName] = []
                menuByGroup[tabName].push(cleanItem)

                if (!tagOrder.includes(tabName) && tabName !== 'Agents') tagOrder.push(tabName)
            })
        })

        // Replace "Agents" with the remaining items (those without tags)
        menuByGroup['Agents'] = remainingInBoards
    }

    // 3. Append "Manage Agents" at the end of the Agents group
    if (!menuByGroup['Agents']) menuByGroup['Agents'] = []
    //menuByGroup['Agents'].push(manageBoards)

    // 4. Build the final menu order:
    //    Boards → tags → all remaining groups (in their original order)
    const finalMenu: Record<string, any[]> = {}

    // a) Boards first
    if (menuByGroup['Agents']) finalMenu['Agents'] = menuByGroup['Agents']

    // b) Then the tabs generated from tags (in order of appearance)
    tagOrder.forEach((tab) => {
        if (menuByGroup[tab]) finalMenu[tab] = menuByGroup[tab]
    })

    // c) Finally, the rest of the categories (preserve insertion order)
    Object.keys(menuByGroup).forEach((key) => {
        if (key === 'Agents') return
        if (tagOrder.includes(key)) return
        finalMenu[key] = menuByGroup[key]
    })

    // 5. Return the complete workspace configuration
    return {
        default: '/workspace/',
        label: 'Admin panel',
        assistant: true,
        logs: true,
        menu: finalMenu,
    }
}
