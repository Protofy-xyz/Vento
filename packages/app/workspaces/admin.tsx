import { Box, LayoutDashboard } from '@tamagui/lucide-icons'

export default ({ boards, objects }) => {
    const objectsWithPage = objects ? objects.filter(o => o?.features?.adminPage) : []

    const objectsMenu = (objectsWithPage.length
        ? objectsWithPage.map((obj) => ({
            name: obj.name.charAt(0).toUpperCase() + obj.name.slice(1),
            icon: Box,
            href: '/workspace/' + obj.features.adminPage,
        }))
        : [])

    // Base menu groups
    const menuByGroup: Record<string, any[]> = {
        Boards: [],
        Storage: objectsMenu,
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
