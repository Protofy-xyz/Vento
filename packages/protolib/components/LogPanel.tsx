
import React from 'react'
import { XStack, YStack, Text, ScrollView, Popover, Input, Theme, Spacer, ToggleGroup, Switch, Tooltip, Checkbox } from '@my/ui'
import { JSONView } from './JSONView'
import { useTint } from '../lib/Tints'
import { InteractiveIcon } from './InteractiveIcon'
import { Ban, Microscope, Bug, Info, AlertCircle, XCircle, Bomb, Filter, Check } from '@tamagui/lucide-icons'
import { Tinted } from './Tinted'
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react'
import { useHighlightedCard } from '@extensions/boards/store/boardStore'

const types = {
    10: { name: "TRACE", color: "$green3", icon: Microscope },
    20: { name: "DEBUG", color: "$color4", icon: Bug },
    30: { name: "INFO", color: "$color7", icon: Info },
    40: { name: "WARN", color: "$yellow7", icon: AlertCircle },
    50: { name: "ERROR", color: "$red7", icon: XCircle },
    60: { name: "FATAL", color: "$red10", icon: Bomb }
}

type Level = { name: string; icon: React.ComponentType<any> };
const levels: Level[] = [
    { name: "trace", icon: Microscope },
    { name: "debug", icon: Bug },
    { name: "info", icon: Info },
    { name: "warn", icon: AlertCircle },
    { name: "error", icon: XCircle },
    { name: "fatal", icon: Bomb }
]
const initialLevels = ['info', 'warn', 'error', 'fatal']

function formatTimestamp(ts) {
    const d = new Date(ts)

    const time = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })

    const date = d.toLocaleDateString() // respeta el orden del locale

    return `${time} ${date}` // sin coma en medio
}

const MessageList = React.memo(({ data, topic }: any) => {
    const sender = topic.split("/")[1]
    const type = topic.split("/")[2]
    const Icon = types[type]?.icon
    const message = JSON.parse(data)
    const { level, time, pid, hostname, msg, name, _meta, ...cleanData } = message

    const from = _meta && _meta.card && _meta.board ? <Text o={0.7} fontSize={14} fontWeight={"500"}>
        {'[board] ' + _meta.board + ' ' + _meta.card}
    </Text> : <Text o={0.7} fontSize={14} fontWeight={"500"}>[{sender}]</Text>

    const [highlightedCardState, setHighlightedCard] = useHighlightedCard()

    return <XStack
        pb="$2"
        ml={"$0"}
        ai="center"
        jc="center"
        f={1}
        onHoverIn={() => {
            if (_meta?.board && _meta?.card) {
                setHighlightedCard(_meta.board + '/' + _meta.card)
            }
        }}
        onHoverOut={() => {
            setHighlightedCard("")
        }}
    >
        <YStack f={1}>
            <XStack f={1} hoverStyle={{ bc: "$bgContent" }} cursor="pointer" ai="center" mb="$2" py={3} px="$3">
                <XStack ai="center" hoverStyle={{ o: 1 }} o={0.9} f={1}>
                    <Tinted><XStack mr={"$2"}><Icon size={20} strokeWidth={2} color={types[type]?.color} /></XStack></Tinted>
                    {/* <Chip text={types[type]?.name+"("+topic+")"} color={types[type]?.color} h={25} /> */}
                    {/* <Chip text={types[type]?.name} color={types[type]?.color} h={25} /> */}
                    {from}
                    <Text ml={"$3"} o={0.9} fontSize={14} fontWeight={"500"}>{msg}</Text>
                    <Spacer f={1} />
                    <XStack ai='center' space="$2">
                        <Text o={0.5} fontSize={13} fontWeight={"400"}>{formatTimestamp(time)}</Text>
                    </XStack>
                </XStack>
            </XStack>
            <YStack pl="$3">
                <Tinted><JSONView
                    src={cleanData}
                /></Tinted>
            </YStack>
        </YStack>
    </XStack>
})


export const LogPanel = ({ AppState, logs, setLogs }) => {
    const [state, setAppState] = useAtom<any>(AppState)
    const appState: any = state

    const [filteredMessages, setFilteredMessages] = useState([])
    const [search, setSearch] = useState('')
    const selectedLevels = appState.levels ?? initialLevels
    const allLevelNames = React.useMemo(() => levels.map(level => level.name), [])
    const allToggled = selectedLevels.length === levels.length

    useEffect(() => {
        const activeLevels = appState.levels ?? initialLevels
        setFilteredMessages(logs.filter((m: any) => {
            // console.log('message: ', m)
            const topic = m?.topic
            const from = topic.split("/")[1]
            //@ts-ignore
            const type = types[topic.split("/")[2]]
            // console.log('result: ', type && (!search || JSON.stringify(m).toLowerCase().includes(search.toLocaleLowerCase())) && appState.levels.includes(type.name.toLocaleLowerCase()))
            return type && (!search || JSON.stringify(m).toLowerCase().includes(search.toLocaleLowerCase())) && activeLevels.includes(type.name.toLocaleLowerCase())
        }))
    }, [search, logs, appState.levels])

    useEffect(() => {
        if (!appState.levels) {
            setAppState(prev => ({ ...prev, levels: initialLevels }))
        }
    }, [appState.levels, setAppState])

    const { tint } = useTint()
    const color = React.useMemo(() => ("$" + tint + "8"), [tint]);

    return <Theme>
        <YStack f={1}>
            <XStack px="$2" ai="center" backgroundColor={'$backgroundTransparent'} borderBottomWidth={1} borderColor={"$borderColor"}>
                <XStack px="$2" py="$1.5" ai="center" space="$2" backgroundColor="$backgroundTransparent" borderBottomWidth={1} borderColor="$borderColor">
                    <XStack px="$2" ai="center" backgroundColor={'$backgroundTransparent'} >
                        <Popover placement="bottom-start">
                            <Popover.Trigger m="$0" p="$0">
                                <InteractiveIcon size={20} Icon={Ban} onPress={() => setLogs([])} />
                            </Popover.Trigger>
                        </Popover>
                        <Popover placement="bottom-start">
                            <Popover.Trigger m="$0" p="$0">
                                <InteractiveIcon size={20} Icon={Filter} />
                            </Popover.Trigger>
                            <Popover.Content p="$3" boc="$borderColor" bw={1} bc="$bgPanel" gap="$2" br="$6" elevation="$2">
                                <Text fontSize="$2" fontWeight="700">
                                    Log levels
                                </Text>
                                <XStack w="100%" jc="space-between" pt="$2" px="$2" ai="center" gap="$2">
                                    <Text fontSize="$3" col="$gray10" >
                                        All levels
                                    </Text>
                                    <Checkbox
                                        bc="$bgContent"
                                        size="$4"
                                        height={20}
                                        checked={allToggled}
                                        onCheckedChange={() => {
                                            if (allToggled) {
                                                setAppState((prev) => ({ ...prev, levels: [] }))
                                            } else {
                                                setAppState((prev) => ({ ...prev, levels: allLevelNames }))
                                            }
                                        }}
                                    >
                                        <Checkbox.Indicator>
                                            <Check size={16} color={"$color"} />
                                        </Checkbox.Indicator>
                                    </Checkbox>
                                </XStack>
                                {/* @ts-ignore */}
                                <ToggleGroup
                                    orientation='vertical'
                                    type="multiple"
                                    onValueChange={(values) => { setAppState(prev => ({ ...prev, levels: values })); }}
                                    value={selectedLevels} > {levels.map((level: Level) => {
                                        const inActive = !selectedLevels || !selectedLevels.includes(level.name)
                                        const bgColor = inActive ? "$bgPanel" : "$bgContent"
                                        return (
                                            <ToggleGroup.Item jc="flex-start" ai="center" flexDirection="row" px="$3" py="$2" miw="160px"
                                                key={level.name}
                                                value={level.name}
                                                focusStyle={{ borderColor: "transparent", bc: bgColor }}
                                                pressStyle={{ borderColor: "transparent", bc: bgColor }}
                                                borderColor={inActive ? "transparent" : "$gray4"}
                                                hoverStyle={{ bc: "$bgContent" }}
                                                bc={bgColor} borderRadius="$4" >
                                                <Tinted> <level.icon size="$1" o={inActive ? 0.8 : 1} color={inActive ? "$color" : "$color8"} /></Tinted>
                                                <Text o={inActive ? 0.8 : 1} ml={"$4"}>{level.name.charAt(0).toUpperCase() + level.name.slice(1)}</Text>
                                            </ToggleGroup.Item>
                                        )
                                    })}
                                </ToggleGroup>
                            </Popover.Content>
                        </Popover>
                    </XStack>
                </XStack>
                <Input
                    focusStyle={{ borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0, outlineWidth: 0 }}
                    forceStyle='focus'
                    br={0}
                    backgroundColor={'$backgroundTransparent'}
                    value={search}
                    width={"100%"}
                    onChangeText={(text) => {
                        setSearch(text);
                    }}
                    placeholder='Search logs...'
                    bw={0}
                />
            </XStack>

            <ScrollView bc="transparent" f={1} height={"calc( 100vh - 90px )"} p="2px" py="$1">
                {filteredMessages.map((m, i) => {
                    return <XStack bc="transparent" hoverStyle={{ bc: "$bgPanel", outlineWidth: 2, outlineColor: color, outlineStyle: "solid" }} key={i} btw={0} bbw={1} boc={"$color4"} p="$1">
                        <MessageList data={m.message} topic={m.topic} />
                    </XStack>
                })}
            </ScrollView>
        </YStack>
    </Theme>
}