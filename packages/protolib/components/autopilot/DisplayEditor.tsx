import React, { useMemo, useState, useCallback } from 'react'
import { YStack, XStack, Label, Input, Checkbox, Text, Paragraph, ScrollView, ToggleGroup, useTheme } from '@my/ui'
import { Check } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { IconSelect } from '../IconSelect'
import { InputColor } from '../InputColor'
import { Toggle } from '../Toggle'
import { useBoardLayer } from '@extensions/boards/store/boardStore'

const colors = ["orange", "yellow", "green", "blue", "purple", "pink", "red", "gray"]
const colorShades = [11, 9, 7, 5]
const presetColors = [...colorShades.reduce((total, current) => {
    colors.forEach((val) => {
        total.push(`var(--${val}${current})`)
    })
    return total
}, []), "default"]


export const SettingsTitle = ({ children, error = "", ...props }) => {
    return (
        <XStack ai={"center"}>
            <Label ml={"$3"} h={"$3.5"} color="$gray9" size="$5" {...props}>
                {children}
            </Label>
            {error ? (
                <Text color={"$red9"} fontSize={"$1"} ml={"$3"}>
                    {error}
                </Text>
            ) : null}
        </XStack>
    )
}


export const SettingsSectionTitle = ({ children, error = "", ...props }) => {
    return (
        <XStack ai={"center"}>
            <Label ml={"$3"} h={"$3.5"} color="$text" size="$7" fontWeight={500} {...props}>
                {children}
            </Label>
            {error ? (
                <Text color={"$red9"} fontSize={"$1"} ml={"$3"}>
                    {error}
                </Text>
            ) : null}
        </XStack>
    )
}

const SettingsSection = ({ children, title, ...props }) => {
    return (
        <YStack flex={1}>
            <SettingsSectionTitle>{title}</SettingsSectionTitle>
            <YStack f={1} borderRadius="$3" p="$4" bc="$bgPanel" {...props}>{children}</YStack>
        </YStack>
    )
}

type Setting = {
    key: string
    label: string
    description?: string
    section: string
    type: 'checkbox' | 'text' | 'toggle'
    indent?: number
    placeholder?: string
    visible?: (ctx: { card: any; cardData: any }) => boolean
    // get/set custom for especial cases (tokens, buttonMode...)
    get?: (cardData: any, card: any) => any
    set?: (cardData: any, value: any) => any // returns new cardData
}

export const DisplayEditor = ({
    card,
    cardData,
    setCardData,
    icons,
    board,
    style,
}: {
    card: any
    cardData: any
    icons: any
    setCardData: (data: any) => void
    board: any
    style?: any
}) => {
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState("")

    const getCheckedDefault = useCallback((cd: any, key: string, noValueIs: boolean = false) => {
        if (cd[key] === undefined) return noValueIs
        return cd[key]
    }, [])
    const [activeLayer] = useBoardLayer();

    const settings: Setting[] = [
        // ----- General -----
        { label: 'Keep value permanently', description: 'Persiste the value of the card on project restart', key: 'persistValue', type: 'toggle', section: 'General', visible: ({ card }) => card.type === 'action' },
        { label: 'Autorun on start', description: 'Autorun the card on board start', key: 'autorun', type: 'toggle', section: 'General', visible: ({ card }) => card.type === 'action' },
        { label: 'Always report value', description: 'Report the card value on each execution to the board', key: 'alwaysReportValue', type: 'toggle', section: 'General' },
        { label: 'Keep history', description: 'Save value changes to history database', key: 'keepHistory', type: 'toggle', section: 'General' },
        { label: 'History retention (days)', description: 'Number of days to keep history entries (default 30)', key: 'historyRetentionDays', type: 'text', section: 'General', indent: 1, visible: ({ cardData }) => !!cardData.keepHistory, get: (cd) => cd.historyRetentionDays ?? '30' },
        { label: 'Natural language rules', description: 'Enable natural language rules view', key: 'editRulesInNaturalLanguage', type: 'toggle', section: 'General', get: (cd) => cd.editRulesInNaturalLanguage !== false },
        { label: 'Low code', description: 'Enable low code view', key: 'editRulesInLowCode', type: 'toggle', section: 'General', get: (cd) => cd.editRulesInLowCode !== false },
        { label: 'Layer', description: 'Layer to show the card in', key: 'layer', type: 'text', section: 'General', get: (cd) => cd.layer ?? activeLayer },
        // ----- Display -----
        { label: 'Display title', description: 'Show name of the card as title', key: 'displayTitle', type: 'toggle', section: 'Display', get: (cd) => cd.displayTitle !== false },
        { label: 'Display icon', description: 'Show the card icon', key: 'displayIcon', type: 'toggle', section: 'Display', get: (cd) => cd.displayIcon !== false },
        { label: 'Display frame', description: 'Show a background frame to the card content', key: 'displayFrame', type: 'toggle', section: 'Display', get: (cd) => cd.displayFrame !== false },
        { label: 'Markdown display', description: 'Show the card output as formatted markdown', key: 'markdownDisplay', type: 'toggle', section: 'Display' },
        { label: 'Html display', description: 'Show the card output as formatted html', key: 'htmlDisplay', type: 'toggle', section: 'Display' },
        { label: 'Display value', description: 'Show the card output value on the card', key: 'displayResponse', type: 'toggle', section: 'Display', get: (cd) => cd.displayResponse !== false, visible: ({ card }) => card.type === 'action' },
        { label: 'Display button', description: 'Show the card execution button', key: 'displayButton', type: 'toggle', section: 'Display', get: (cd) => cd.displayButton !== false, visible: ({ card }) => card.type === 'action' },
        { label: 'Button text', description: 'Displayed text on the execution button', key: 'buttonLabel', type: 'text', section: 'Display', visible: ({ card, cardData }) => card.type === 'action' && !!getCheckedDefault(cardData, 'displayButton', true) },
        {
            label: 'Button Full',
            description: 'Grow the button size to fill the card size',
            key: 'buttonMode',
            type: 'toggle',
            section: 'Display',
            visible: ({ card, cardData }) => card.type === 'action' && !!getCheckedDefault(cardData, 'displayButton', true),
            get: (cd) => cd.buttonMode === 'full',
            set: (cd, checked) => {
                if (checked) return { ...cd, buttonMode: 'full' }
                const { buttonMode, ...rest } = cd
                return rest
            },
        },
        {
            label: 'Display button icon',
            description: 'Show the card icon on the execution button',
            key: 'displayButtonIcon',
            type: 'toggle',
            section: 'Display',
            visible: ({ card, cardData }) => card.type === 'action' && !!getCheckedDefault(cardData, 'displayButton', true),
            get: (cd) => cd.displayButtonIcon === true,
            set: (cd, checked) => ({ ...cd, displayButtonIcon: !!checked }),
        },
        { label: 'Auto Minimize', description: 'Enable card auto minimize to show in reduced space boards', key: 'autoResponsive', type: 'toggle', section: 'Display', get: (cd) => cd.autoResponsive !== false },

        // ----- Paths and Permissions -----
        {
            label: 'API access',
            description: 'Allow access to this card through the API.',
            key: 'apiAccess',
            type: 'toggle',
            section: 'Paths and Permissions',
            get: (cd) => Object.keys(cd.tokens ?? {}).length > 0,
            set: (cd, checked) => {
                if (checked) return { ...cd, tokens: { read: uuidv4(), run: uuidv4() } }
                const { tokens, ...rest } = cd
                return rest
            },
        },
        { label: 'User access', key: 'userAccess', type: 'toggle', section: 'Paths and Permissions' },
        { label: 'Admin access', key: 'adminAccess', type: 'toggle', section: 'Paths and Permissions' },

        { label: 'Allow public read', description: 'Allow the read of the card content outside board', key: 'publicRead', type: 'toggle', section: 'Paths and Permissions' },
        { label: 'Card read path', description: 'Path to read the content of the card outside the board. This setting requires <Allow public read> to be enabled.', key: 'enableCustomPath', type: 'toggle', section: 'Paths and Permissions' },
        {
            label: 'Path to card',
            key: 'customPath',
            type: 'text',
            section: 'Paths and Permissions',
            indent: 1,
            visible: ({ cardData }) => !!cardData.enableCustomPath,
            get: (cd) => cd.customPath ?? `/workspace/cards/${cd.name}`,
        },
        { label: 'Card page path', description: 'Path of the card content page. This setting requires <Allow public read> to be enabled.', key: 'customCardViewPath', type: 'text', placeholder: "Path to card (Ex: /card)", section: 'Paths and Permissions' },
        // @ts-ignore
        ...(cardData.type === "action"
            ? [
                { label: 'Event Trigger', description: 'event path triggering this action', key: 'eventPath', type: 'text', placeholder: "Event path trigger (Ex: auth/login/done)", section: 'Paths and Permissions' },
                { label: 'Default Input', description: 'The default input name for this action. Used by Event Trigger and similar triggers to know the name of the input to put the event payload into.', key: 'defaultInput', type: 'text', placeholder: "Default input name", section: 'Paths and Permissions' },
                { label: 'Allow public run', key: 'publicRun', type: 'toggle', section: 'Paths and Permissions' },
                { label: 'Custom run path', key: 'enableCustomRunPath', type: 'toggle', section: 'Paths and Permissions' },
                {
                    label: 'Path to card run',
                    key: 'customRunPath',
                    type: 'text',
                    section: 'Paths and Permissions',
                    indent: 1,
                    visible: ({ cardData }) => !!cardData.enableCustomRunPath,
                    get: (cd) => cd.customRunPath ?? `/workspace/cards/${cd.name}/run`,
                },

                { label: 'Run Card Page Path', key: 'customCardRunViewPath', type: 'text', placeholder: "Path to card run (Ex: /card/run)", section: 'Paths and Permissions' },
                { label: 'Request approval', description: 'Require user approval before executing this action', key: 'requestApproval', type: 'toggle', section: 'Paths and Permissions', visible: ({ card }) => card.type === 'action' },
                { label: 'Approval message', description: 'Custom message shown when requesting approval', key: 'approvalMessage', type: 'text', section: 'Paths and Permissions', indent: 1, visible: ({ card, cardData }) => card.type === 'action' && !!(cardData?.requestApproval === true), placeholder: 'Explain what this action will do' },
            ]
            : []
        ),
    ]

    // Group settings by section and filter by visible
    const settingsBySection = useMemo(() => {
        const acc: Record<string, Setting[]> = {}
        const ctx = { card, cardData }
        for (const s of settings) {
            if (s.visible && !s.visible(ctx)) continue
            if (!acc[s.section]) acc[s.section] = []
            acc[s.section].push(s)
        }
        return acc
    }, [settings, card, cardData])

    const renderSetting = (s: Setting, optionIndex: number, totalOptionsCount: Number) => {

        const indentMl = s.indent ? `$${s.indent * 4}` : undefined
        let comp = null

        if (s.type === 'checkbox') {
            const checked = s.get ? !!s.get(cardData, card) : getCheckedDefault(cardData, s.key)
            const onCheckedChange = (checkedVal: boolean) => {
                if (s.set) {
                    setCardData(s.set(cardData, checkedVal))
                } else {
                    setCardData({ ...cardData, [s.key]: checkedVal })
                }
            }

            comp = <XStack key={s.key} ai="center" gap="$2" ml={indentMl}>
                <Checkbox
                    w="$2"
                    h="$2"
                    focusStyle={{ outlineWidth: 0 }}
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    className="no-drag"
                    bc="$bgContent"
                    boc="$gray6"
                >
                    <Checkbox.Indicator>
                        <Check size={16} color='var(--color8)' />
                    </Checkbox.Indicator>
                </Checkbox>
                <Label>{s.label}</Label>
            </XStack>
        } else if (s.type === 'text') {
            const value = s.get ? s.get(cardData, card) : cardData?.[s.key] ?? ''
            comp = <XStack key={s.key} ai="center" justifyContent="space-between" gap="$5" ml={indentMl}>
                <YStack gap="0px" flex={1}>
                    <Label
                        color={"$text"}
                        fontSize={"$5"}
                        lineHeight={"fit-content"}>{s.label}</Label>
                    <Label
                        fontSize={"$5"}
                        color="$gray10"
                        lineHeight={"fit-content"}>{s.description}</Label>
                </YStack>
                <Input
                    minWidth={"250px"}
                    value={value}
                    placeholder={s["placeholder"] ?? s.label}
                    onChangeText={(t) => {
                        if (s.set) setCardData(s.set(cardData, t))
                        else setCardData({ ...cardData, [s.key]: t })
                    }}
                    bc="$bgContent"
                    placeholderTextColor="$gray9"
                    boc="$gray6"
                />
            </XStack>
        } else if (s.type === 'toggle') {
            const checked = s.get ? !!s.get(cardData, card) : getCheckedDefault(cardData, s.key)
            const onCheckedChange = (checkedVal: boolean) => {
                if (s.set) {
                    setCardData(s.set(cardData, checkedVal))
                } else {
                    setCardData({ ...cardData, [s.key]: checkedVal })
                }
            }

            comp = <XStack key={s.key} ai="center" justifyContent="space-between" gap="$5" ml={indentMl}>
                <YStack gap="0px" flex={1}>
                    <Label
                        color={"$text"}
                        fontSize={"$5"}
                        lineHeight={"fit-content"}>{s.label}</Label>
                    <Label
                        fontSize={"$5"}
                        color="$gray10"
                        lineHeight={"fit-content"}>{s.description}</Label>
                </YStack>
                <Toggle checked={checked} onChange={onCheckedChange} />
            </XStack>
        }


        return <div>
            {comp}
            {
                // option divider
                (optionIndex + 1) === totalOptionsCount
                    ? null
                    : <YStack style={{
                        width: "100%",
                        height: "2px",
                    }} bg="$bgContent" my="$3" opacity={0.7}></YStack>
            }
        </div>
    }

    return (
        <XStack f={1} gap="$6" style={style}>
            <YStack flexWrap="wrap" py="$6" pl="$5" >
                <YStack maw={400}>
                    <SettingsTitle error={error ?? ''}>
                        Name <Text color={"$color8"}>*</Text>
                    </SettingsTitle>
                    <Input
                        br={"8px"}
                        value={cardData.name}
                        bc="$bgPanel"
                        boc="$gray6"
                        color={error ? '$red9' : undefined}
                        onChangeText={(t) => {
                            const regex = /^[a-zA-Z0-9-_ ]*$/
                            if (regex.test(t)) setError(null)
                            // else setError("Invalid input, only letters, numbers, spaces, - and _ are allowed.")
                            setCardData({ ...cardData, name: t })
                        }}
                    />
                </YStack>

                <YStack w={400} >
                    <SettingsTitle>Icon</SettingsTitle>
                    <IconSelect
                        br={"8px"}
                        inputProps={{ backgroundColor: '$bgPanel', borderColor: error ? '$red9' : '$gray6' }}
                        icons={icons}
                        onSelect={(icon) => setCardData({ ...cardData, icon })}
                        selected={cardData.icon}
                    />
                </YStack>

                <YStack w={400}>
                    <SettingsTitle>Main Color</SettingsTitle>
                    <InputColor
                        br={"8px"}
                        color={cardData.color ?? ""}
                        mode='custom'
                        presetColors={presetColors}
                        popoverProps={{ width: "325px" }}
                        placeholder='#F7B500 or var(--yellow9)'
                        onChange={(color) => {
                            if (color === "default") {
                                delete cardData.color
                            } else {
                                cardData.color = color
                            }
                            setCardData({ ...cardData })
                        }}
                        inputProps={{
                            backgroundColor: '$bgPanel',
                            borderColor: error ? '$red9' : '$gray6',
                            onChange: e => {
                                setCardData({ ...cardData, color: e.target.value })
                            }
                        }}
                    />
                </YStack>
                <YStack w={400} display={cardData.displayFrame == false ? "none" : "block"}>
                    <SettingsTitle>Background Color</SettingsTitle>
                    <InputColor
                        br={"8px"}
                        color={cardData.bgColor ?? ""}
                        mode='custom'
                        placeholder='#F7B500 or var(--yellow9)'
                        presetColors={presetColors}
                        popoverProps={{ width: "325px" }}
                        onChange={(color) => {
                            if (color === "default") {
                                delete cardData.bgColor
                            } else {
                                cardData.bgColor = color
                            }
                            setCardData({ ...cardData })
                        }}
                        inputProps={{
                            backgroundColor: '$bgPanel',
                            borderColor: error ? '$red9' : '$gray6',
                            onChange: e => {
                                setCardData({ ...cardData, bgColor: e.target.value })
                            }
                        }}
                    />
                </YStack>
            </YStack >

            <YStack pb="$7" pr="$5" overflow='auto' overflowBlock='scroll' flex={1}>
                <YStack
                    pos='sticky' top="0px" left="0px" zIndex={20} pt="$11" px="$3"
                >
                    <Input
                        zi={1}
                        br={"8px"}
                        value={filter}
                        fontSize={"$5"}
                        placeholderTextColor={"$gray8"}
                        style={{
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            background: 'color-mix(in srgb, var(--bgPanel) 50%, transparent)',
                        }}
                        boc="$gray6"
                        color={error ? '$red9' : undefined}
                        onChangeText={(t) => {
                            setFilter(t)
                        }}
                        placeholder='Search for a setting'
                    />
                </YStack>
                <YStack display="grid" pt="$3" gap="$2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {Object.entries(settingsBySection).map(([section, items]) => {
                        // disable half sections for the moment
                        // const layout = section == "General" ? 'full' : 'half'
                        // const gridColumn = layout === 'full' ? '1 / -1' : 'auto'
                        const layout = "full"
                        const gridColumn = "1 / -1"
                        const loweredFilter = filter.toLowerCase()
                        const filteredItems = items.filter((i) => i?.label?.toLocaleLowerCase()?.includes(loweredFilter) || i?.description?.toLocaleLowerCase()?.includes(loweredFilter)) ?? []
                        return (
                            // @ts-ignore
                            <>
                                {
                                    filteredItems.length
                                        ? <YStack key={section} gridColumn='1 / -1' $gtMd={{ gridColumn }} >
                                            <SettingsSection title={section} flexDirection={"column"}>
                                                {filteredItems.map((setting, i) => renderSetting(setting, i, filteredItems.length))}
                                            </SettingsSection>
                                        </YStack>
                                        : <></>
                                }
                            </>
                        )
                    })}
                </YStack>
            </YStack>
        </XStack >
    )
}
