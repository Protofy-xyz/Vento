
import React from 'react'
import { XStack, YStack, Text, ScrollView, Popover, Input, Theme, Spacer } from '@my/ui'
import { JSONView } from './JSONView'
import { useTint } from '../lib/Tints'
import { GroupButton } from './GroupButton'
import { ButtonGroup } from './ButtonGroup'
import { InteractiveIcon } from './InteractiveIcon'
import { Ban, Microscope, Bug, Info, AlertCircle, XCircle, Bomb, Filter } from '@tamagui/lucide-icons'
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
    const initialLevels = ['info', 'warn', 'error', 'fatal']

    useEffect(() => {
        setFilteredMessages(logs.filter((m: any) => {
            // console.log('message: ', m)
            const topic = m?.topic
            const from = topic.split("/")[1]
            //@ts-ignore
            const type = types[topic.split("/")[2]]
            // console.log('result: ', type && (!search || JSON.stringify(m).toLowerCase().includes(search.toLocaleLowerCase())) && appState.levels.includes(type.name.toLocaleLowerCase()))
            return type && (!search || JSON.stringify(m).toLowerCase().includes(search.toLocaleLowerCase())) && appState.levels.includes(type.name.toLocaleLowerCase())
        }))
    }, [search, logs, appState.levels])

    useEffect(() => {
        if (!appState.levels) {
            setAppState({ ...appState, levels: initialLevels })
        }
    }, [appState.levels])

    const { tint } = useTint()

    const toggleLevel = (level: string) => {
        const { levels } = appState;

        setAppState({
            ...appState,
            levels: levels.includes(level) ? levels.filter(l => l !== level) : [...levels, level],
        });
    };
    const color = React.useMemo(() => ("$" + tint + "8"), [tint]);

    return <Theme>
        <YStack f={1}>
            <XStack px="$2" ai="center" backgroundColor={'$backgroundTransparent'} borderBottomWidth={1} borderColor={"$borderColor"}>
                <Popover placement="bottom-start">
                    <Popover.Trigger m="$0" p="$0">
                        <InteractiveIcon size={20} Icon={Ban} onPress={() => setLogs([])} />
                    </Popover.Trigger>
                </Popover>
                <Popover placement="bottom-start">
                    <Popover.Trigger m="$0" p="$0">
                        <InteractiveIcon size={20} Icon={Filter} />
                    </Popover.Trigger>
                    <Popover.Content padding={0} space={0} bw={1} boc="$borderColor" bc={"$color1"} >
                        <ButtonGroup mode="vertical">
                            <GroupButton onPress={() => toggleLevel('trace')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('trace')}>
                                <Microscope size="$1" strokeWidth={1} />
                                <Text>Trace</Text>
                            </GroupButton>
                            <GroupButton onPress={() => toggleLevel('debug')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('debug')}>
                                <Bug size="$1" strokeWidth={1} />
                                <Text>Debug</Text>
                            </GroupButton>
                            <GroupButton onPress={() => toggleLevel('info')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('info')}>
                                <Info size="$1" strokeWidth={1} />
                                <Text>Info</Text>
                            </GroupButton>
                            <GroupButton onPress={() => toggleLevel('warn')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('warn')}>
                                <AlertCircle size="$1" strokeWidth={1} />
                                <Text>Warn</Text>
                            </GroupButton>
                            <GroupButton onPress={() => toggleLevel('error')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('error')}>
                                <XCircle size="$1" strokeWidth={1} />
                                <Text>Error</Text>
                            </GroupButton>
                            <GroupButton onPress={() => toggleLevel('fatal')} jc="flex-start" inActive={!appState.levels || !appState.levels.includes('fatal')}>
                                <Bomb size="$1" strokeWidth={1} />
                                <Text>Fatal</Text>
                            </GroupButton>
                        </ButtonGroup>
                    </Popover.Content>
                </Popover>
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
                    placeholder='Filter logs...'
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