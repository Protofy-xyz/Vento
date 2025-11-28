import { Panel, PanelGroup } from "react-resizable-panels";
import { YStack, ScrollView, Text, Input, XStack, Button, Label, Accordion, Square } from "@my/ui";
import CustomPanelResizeHandle from "../MainPanel/CustomPanelResizeHandle";
import { JSONView } from "../JSONView";
import { useCallback, useMemo, useState } from "react";
import { AlignLeft, Braces, ChevronDown, Copy, Globe, Diamond, LayoutDashboard, Search } from "@tamagui/lucide-icons";
import { TabBar } from "../TabBar";
import { generateActionCode, generateStateCode } from "@extensions/boards/utils/ActionsAndStates"
import { Tinted } from "../Tinted";

const getLayerOrder = (board) => {
    const layerSet = new Set<string>(["base"]);
    (board?.cards ?? []).forEach((card: any) => layerSet.add(card?.layer ?? "base"));
    return Array.from(layerSet).sort((a, b) =>
        a === "base" ? -1 : b === "base" ? 1 : a.localeCompare(b, undefined, { sensitivity: "base" })
    );
};

const getCardLayerMap = (board) => {
    const layerMap = new Map<string, string>();
    (board?.cards ?? []).forEach((card: any) => {
        if (card?.name) layerMap.set(card.name, card.layer ?? "base");
    });
    return layerMap;
};

const groupByLayer = (
    items,
    layerOrder: string[] = [],
    layerResolver: (key: string, value: any) => string = () => "base"
) => {
    const grouped = new Map<string, Record<string, any>>();
    const seen = new Set<string>(layerOrder);

    for (const [key, value] of Object.entries(items ?? {})) {
        const layer = layerResolver(key, value) || "base";
        seen.add(layer);
        if (!grouped.has(layer)) grouped.set(layer, {});
        grouped.get(layer)![key] = value;
    }

    const finalOrder =
        layerOrder && layerOrder.length
            ? layerOrder
            : Array.from(seen).sort((a, b) =>
                a === "base" ? -1 : b === "base" ? 1 : a.localeCompare(b, undefined, { sensitivity: "base" })
            );

    const ordered: Record<string, any> = {};
    finalOrder.forEach((layer) => {
        if (grouped.has(layer)) ordered[layer] = grouped.get(layer);
    });
    for (const [layer, value] of grouped.entries()) {
        if (!(layer in ordered)) ordered[layer] = value;
    }

    return { data: ordered, order: finalOrder };
};

const buildOrderedLayers = (data, layerOrder: string[] = []) => {
    const ordered = [];
    layerOrder.forEach((layer) => {
        if (data?.[layer]) ordered.push([layer, data[layer]]);
    });
    for (const [layer, value] of Object.entries(data ?? {})) {
        if (!layerOrder.includes(layer)) ordered.push([layer, value]);
    }
    return ordered;
};

const useCopyFlash = () => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const triggerCopy = useCallback((key: string, text?: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 700);
    }, []);

    return { copiedKey, triggerCopy };
};

const CopyActionButton = ({ label, isCopied, onPress }) => (
    <Tinted>
        <Button
            bc={isCopied ? "transparent" : "$bgPanel"}
            alignSelf="flex-start"
            width="auto"
            size="$2"
            iconAfter={<Copy color={isCopied ? "transparent" : "$color8"} />}
            hoverStyle={{ backgroundColor: isCopied ? "transparent" : "$color5" }}
            onPress={onPress}
        >
            {isCopied
                ? <Text numberOfLines={1} overflow="visible" fos="$4" color="$color">copied to clipboard!</Text>
                : <Text fos="$4">{label}</Text>
            }
        </Button>
    </Tinted>
);

const LayerAccordion = ({ items, renderBody }) => (
    <Accordion type="multiple" defaultValue={items.map(([layer]) => layer)} width="100%" gap="$2">
        {items.map(([layer, content]: any) => (
            <Accordion.Item key={layer} value={layer} boc="$gray6" w="100%">
                <Accordion.Trigger bc="$bgPanel" unstyled p="$3" flexDirection="row" ai="center" br="$4" w="100%">
                    {({ open }) => (
                        <XStack flex={1} flexDirection="row" ai="center" jc="space-between">
                            <XStack ai="center" gap="$2">
                                <Diamond col="$gray9" size="$1" />
                                <Text fos="$4" fow={100}>{layer}</Text>
                            </XStack>
                            <Square o={0.8} animation="quick" rotate={open ? '180deg' : '0deg'} mr="$1.5">
                                <ChevronDown size="$1" />
                            </Square>
                        </XStack>
                    )}
                </Accordion.Trigger>
                <Accordion.Content bc="transparent" p="$2" pt="$1" w="100%">
                    {renderBody(content, layer)}
                </Accordion.Content>
            </Accordion.Item>
        ))}
    </Accordion>
);

const SearchField = ({ value, onChange }) => (
    <XStack gap="$2">
        <Search pos="absolute" left="$3" top={14} size={16} />
        <Input
            bg="$bgPanel"
            color="$gray12"
            paddingLeft="$7"
            bw={0}
            h="47px"
            boc="$gray6"
            w="100%"
            placeholder="search..."
            placeholderTextColor="$gray9"
            outlineColor="$gray8"
            value={value}
            onChangeText={onChange}
        />
    </XStack>
);

const StatesBoardsView = ({ data, boardName }) => {
    const [selectedBoard, setSelectedBoard] = useState(boardName)

    return <YStack gap="$2" ai="flex-start" f={1} width="100%">
        {Object.keys(data ?? {}).length > 0
            ? <BoardsAccordion boards={data} selectedBoard={selectedBoard} onSelectBoard={setSelectedBoard}>
                <JSONView
                    collapsed={1}
                    style={{ backgroundColor: 'transparent' }}
                    src={data?.[selectedBoard]}
                    collapseStringsAfterLength={100}
                    enableClipboard={(copy) => {
                        const path = generateStateCode([selectedBoard, ...copy.namespace], "boards")
                        navigator.clipboard.writeText(path)
                        return false
                    }}
                />

            </BoardsAccordion>
            : <YStack f={1} w="100%" ai="center" mt="$10">
                <Text fos="$4" col="$gray8">No states found</Text>
            </YStack>
        }
    </YStack>
}

const BoardsAccordion = ({ boards, children, selectedBoard, onSelectBoard }) => {

    const boardsList = useMemo(() => Object.keys(boards ?? {}), [boards]);


    return <YStack gap="$2" width={"100%"}> {
        boardsList.map((category => {
            return <XStack key={category} f={1}>
                <Accordion value={selectedBoard} onValueChange={onSelectBoard} collapsible onPress={(e) => e.stopPropagation()} type="single" flex={1}>
                    <Accordion.Item value={category} >
                        <Accordion.Trigger bc="$bgPanel" unstyled p="$3" flexDirection="row" ai="center" br="$4" w="100%">
                            {({ open }) => (
                                <XStack flex={1} flexDirection="row" ai="center" jc="space-between">
                                    <XStack ai="center" gap={"$2"}>
                                        <Globe col="$gray9" size="$1" />
                                        <Text fos="$4" ml={"$2"} fow={100}>{category}</Text>
                                    </XStack>
                                    <Square o={0.8} animation="quick" rotate={open ? '180deg' : '0deg'} mr={"$1.5"}>
                                        <ChevronDown size="$1" />
                                    </Square>
                                </XStack>
                            )}
                        </Accordion.Trigger>
                        <Accordion.Content bc="transparent" p="$2">
                            {children}
                        </Accordion.Content>
                    </Accordion.Item>
                </Accordion>
            </XStack>
        }))
    }
    </YStack>
}

const ActionsList = ({ data, onCopy }) => {
    const { copiedKey, triggerCopy } = useCopyFlash();

    const actions = useMemo(() => {
        const out: Array<[string, any]> = [];
        const walk = (obj: any) => {
            if (!obj || typeof obj !== "object") return;
            for (const [key, val] of Object.entries(obj)) {
                if (val && typeof val === "object" && (val as any).url) {
                    const label = (val as any).name || key;
                    out.push([label, val]);
                } else {
                    walk(val);
                }
            }
        };
        walk(data);
        return out.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
    }, [data]);

    const handleCopy = useCallback((val: any, key: string) => {
        triggerCopy(key, onCopy(val));
    }, [onCopy, triggerCopy]);

    if (!actions.length) return <Text fos="$4" col="$gray8">No actions found</Text>;

    return (
        <YStack width={"100%"} gap="$2">
            {actions.map(([key, val]) => {
                const isCopied = copiedKey === key;
                return <CopyActionButton key={key} label={key} isCopied={isCopied} onPress={() => handleCopy(val, key)} />
            })}
        </YStack>
    );
};

const LayeredActionsView = ({ data, layerOrder, onCopy }) => {
    const { copiedKey, triggerCopy } = useCopyFlash();

    const layers = useMemo(() => buildOrderedLayers(data, layerOrder), [data, layerOrder]);

    return (
        <LayerAccordion
            items={layers}
            renderBody={(actions, layer) => (
                <YStack gap="$1.5">
                    {Object.entries(actions ?? {}).map(([key, val]: any) => {
                        const compoundKey = `${layer}:${key}`;
                        return (
                            <CopyActionButton
                                key={key}
                                label={key}
                                isCopied={copiedKey === compoundKey}
                                onPress={() => triggerCopy(compoundKey, onCopy(val))}
                            />
                        )
                    })}
                </YStack>
            )}
        />
    );
};

const FormattedView = ({ data, copyMode = "rules", format = "actions", boardName = "", type = "", layerOrder = [] }) => {
    const [selectedBoard, setSelectedCategory] = useState(boardName)

    const copy = (val) => {
        if (!val || !val.url) return '';
        const targetBoard = getBoardIdFromActionUrl(val.url);
        let copyVal = val.url;

        if (targetBoard && targetBoard === boardName) {
            copyVal = val.name
        }

        if (copyMode === "rules") {
            return generateActionCode(copyVal, undefined, type)
        }

        if (copyMode === "code" || copyMode === "flows") {
            return generateActionCode(copyVal, val.params ?? {}, type)
        }

        return ''
    }

    return (
        <YStack width={"100%"} >
            {
                format === "boards"
                    ? <BoardsAccordion boards={data} selectedBoard={selectedBoard} onSelectBoard={setSelectedCategory} >
                        <ActionsList
                            data={data?.[selectedBoard] ?? {}}
                            onCopy={copy}
                        />
                    </BoardsAccordion>
                    : <LayeredActionsView data={data} layerOrder={layerOrder} onCopy={copy} />
            }
        </YStack>
    )
}

function getBoardIdFromActionUrl(path: string): string | null {
    const match = path.match(/^\/api\/core\/v1\/boards\/([^\/]+)\/actions\/.+$/);
    return match ? match[1] : null;
}

function filterObjectBySearch(data, search) {
    if (data === null || data === undefined) return undefined;
    const lowerSearch = search.toLowerCase();

    if (typeof data !== "object") {
        const strData = String(data).toLowerCase();
        return strData.includes(lowerSearch) ? data : undefined;
    }

    if (Array.isArray(data)) {
        const filteredArr = [];
        for (const item of data) {
            const filteredItem = filterObjectBySearch(item, search);
            if (filteredItem !== undefined) {
                filteredArr.push(filteredItem);
            }
        }
        return filteredArr.length > 0 ? filteredArr : undefined;
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
        const keyMatches = key.toLowerCase().includes(lowerSearch);
        const filteredValue = filterObjectBySearch(value, search);

        if (keyMatches || filteredValue !== undefined) {
            result[key] = filteredValue === undefined ? value : filteredValue;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

const filterActionsBySearch = (data, search) => {
    if (!search) return data;
    const lower = search.toLowerCase();

    const recurse = (obj) => {
        if (!obj || typeof obj !== 'object') return undefined;

        if (obj.url) {
            const text = [
                obj.name,
                obj.description,
                obj.url,
                JSON.stringify(obj.params ?? {})
            ].filter(Boolean).join(' ').toLowerCase();
            return text.includes(lower) ? obj : undefined;
        }

        const next = {};
        for (const [key, val] of Object.entries(obj)) {
            const keyMatch = key.toLowerCase().includes(lower);
            const child = recurse(val);
            if (keyMatch) {
                next[key] = val;
                continue;
            }
            if (child !== undefined && (typeof child !== 'object' || Object.keys(child).length > 0)) {
                next[key] = child;
            }
        }
        return Object.keys(next).length > 0 ? next : undefined;
    };

    return recurse(data) ?? {};
};

export const ActionsAndStatesPanel = ({ board, type, panels = ["actions", "states"], actions, states, copyMode, showActionsTabs = false, showStatesTabs = false }) => {
    const [inputMode, setInputMode] = useState<"json" | "formatted">("formatted")
    const [search, setSearch] = useState('')
    const [selectedStatesTab, setSelectedStatesTab] = useState(board.name)
    const [stateSearch, setStateSearch] = useState('')
    const [selectedActionsTab, setSelectedActionsTab] = useState(board.name)
    //console.log("ActionsAndStatesPanel:", { actions, states });

    const layerOrder = useMemo(() => getLayerOrder(board), [board?.cards]);
    const layerPriority = useMemo(() => {
        const priority = new Map<string, number>();
        layerOrder.forEach((layer, idx) => priority.set(layer, idx));
        return priority;
    }, [layerOrder]);
    const cardLayerMap = useMemo(() => getCardLayerMap(board), [board?.cards]);

    const sortObjectByLayer = useCallback((obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const fallbackIndex = layerOrder.length;
        const ordered = Object.entries(obj).sort(([a], [b]) => {
            const layerA = cardLayerMap.get(a);
            const layerB = cardLayerMap.get(b);
            const idxA = layerA ? (layerPriority.get(layerA) ?? fallbackIndex) : fallbackIndex;
            const idxB = layerB ? (layerPriority.get(layerB) ?? fallbackIndex) : fallbackIndex;
            if (idxA !== idxB) return idxA - idxB;
            return a.localeCompare(b, undefined, { sensitivity: "base" });
        });
        return Object.fromEntries(ordered);
    }, [cardLayerMap, layerOrder, layerPriority]);

    const cleanedActions = useMemo(() => {
        const cleaned = {};
        if (!actions || typeof actions !== 'object') return cleaned;
        for (const [level1Key, level1Value] of Object.entries(actions)) {
            if (!level1Value || typeof level1Value !== 'object') continue;
            const boardActions = {};
            for (const [level2Key, level2Value] of Object.entries(level1Value)) {
                if (!level2Value || typeof level2Value !== 'object') continue;
                const { name, description, params, url, layer: actionLayer } = level2Value as any;
                boardActions[level2Key] = { name, description, params, url, layer: actionLayer };
            }
            if (level1Key === board?.name) {
                cleaned[level1Key] = groupByLayer(
                    sortObjectByLayer(boardActions),
                    layerOrder,
                    (key) => cardLayerMap.get(key) ?? "base"
                ).data;
            } else {
                cleaned[level1Key] = groupByLayer(boardActions, [],
                    (_key, val) => {
                        const v: any = val;
                        return v?.layer || "base"
                    }
                ).data;
            }
        }
        return cleaned;
    }, [actions, board?.name, sortObjectByLayer, layerOrder, cardLayerMap]);

    const orderedStates = useMemo(() => {
        if (!states || typeof states !== 'object') return {};
        const next = { ...states };
        if (board?.name && states?.[board.name] && typeof states[board.name] === 'object') {
            next[board.name] = groupByLayer(
                sortObjectByLayer(states[board.name]),
                layerOrder,
                (key) => cardLayerMap.get(key) ?? "base"
            ).data;
        }
        return next;
    }, [states, board?.name, sortObjectByLayer, layerOrder, cardLayerMap]);

    const filteredActionData = useMemo(() => {
        const visibleActions = selectedActionsTab === "otherBoards"
            ? Object.entries(cleanedActions ?? {})
                .filter(([boardId]) => boardId !== board?.name)
                .sort(([a], [b]) => a.localeCompare(b))
                .reduce((acc, [id, content]) => ({ ...acc, [id]: content }), {})
            : cleanedActions?.[selectedActionsTab]
        return filterActionsBySearch(visibleActions ?? {}, search)
    }, [cleanedActions, search, selectedActionsTab, board?.name]);

    const filteredStateData = useMemo(() => {
        const visibleStates = selectedStatesTab === "otherBoards"
            ? Object.entries(orderedStates ?? {})
                .filter(([boardId]) => boardId !== board?.name)
                .reduce((acc, [id, content]) => ({ ...acc, [id]: content }), {})
            : orderedStates?.[selectedStatesTab]
        const filtered = filterObjectBySearch(visibleStates ?? {}, stateSearch)
        return filtered
    }, [orderedStates, stateSearch, selectedStatesTab, board?.name]);


    const normalizeNamespace = useCallback((ns: string[] = []) => {
        if (!Array.isArray(ns)) return [];
        if (ns.length && layerOrder.includes(ns[0])) return ns.slice(1);
        return ns;
    }, [layerOrder]);

    const renderActionsContent = useCallback((format: "boards" | "actions" = "actions") => (
        <YStack gap="$2" ai="flex-start" f={1}>
            {inputMode === "formatted" &&
                <FormattedView
                    type={type}
                    data={filteredActionData}
                    format={format}
                    copyMode={copyMode}
                    boardName={board?.name}
                    layerOrder={layerOrder}
                />
            }
            {inputMode === "json" && <JSONView collapsed={3} style={{ backgroundColor: 'transparent' }} src={filteredActionData} />}
        </YStack>
    ), [board?.name, copyMode, filteredActionData, inputMode, layerOrder, type]);

    const statesPanel = useMemo(() => {
        const layers = buildOrderedLayers(filteredStateData, layerOrder);

        if (!filteredStateData || layers.length === 0) {
            return <YStack f={1} w="100%" ai="center" mt="$10">
                <Text fos="$4" col="$gray8">No states found</Text>
            </YStack>
        }

        return (
            <LayerAccordion
                items={layers}
                renderBody={(layerContent) => (
                    <JSONView
                        collapsed={1}
                        style={{ backgroundColor: 'transparent' }}
                        src={layerContent ?? {}}
                        collapseStringsAfterLength={100}
                        enableClipboard={(copy) => {
                            const ns = normalizeNamespace(copy.namespace);
                            const path = generateStateCode(ns, "state");
                            navigator.clipboard.writeText(path);
                            return false;
                        }}
                    />
                )}
            />
        )
    }, [filteredStateData, layerOrder, normalizeNamespace]);

    const actionsPanel = useMemo(() => renderActionsContent("actions"), [renderActionsContent]);

    const otherBoardsPanel = useMemo(() => renderActionsContent("boards"), [renderActionsContent]);

    const statesOtherBoardsPanel = useMemo(() => {
        return <StatesBoardsView data={filteredStateData ?? {}} boardName={board?.name} />
    }, [filteredStateData])


    const actionsTabs = [
        { id: board.name, label: board.name, icon: <LayoutDashboard size={"$1"} />, content: actionsPanel },
        { id: "otherBoards", label: "Other boards", icon: <Globe size={"$1"} />, content: otherBoardsPanel },
    ]

    const statesTabs = [
        { id: board.name, label: board.name, content: statesPanel, icon: <LayoutDashboard size={"$1"} /> },
        { id: "otherBoards", label: "Other boards", content: statesOtherBoardsPanel, icon: <Globe size={"$1"} /> },
    ]

    const selectedAction = useMemo(
        () => actionsTabs.find(t => t.id === selectedActionsTab),
        [actionsTabs, selectedActionsTab]
    );

    const selectedState = useMemo(
        () => statesTabs.find(t => t.id === selectedStatesTab),
        [statesTabs, selectedStatesTab]
    );

    return <Panel defaultSize={30}>
        <PanelGroup direction="vertical">
            {panels && panels?.includes('actions') && <Panel defaultSize={50} minSize={20} maxSize={80} >
                <YStack flex={1} height="100%" px="$3" gap="$2" overflow="hidden">
                    <Tinted>
                        <XStack jc="space-between" width="100%">
                            <Label pl="$3" lineHeight={"$4"} fontSize="$5" color="$gray9" >Actions</Label>
                            <XStack gap="$2">
                                <Button
                                    icon={AlignLeft}
                                    bc={inputMode === "formatted" ? "$bgPanel" : "$bgContent"}
                                    color={inputMode === "formatted" ? "$color8" : "$color"}
                                    scaleIcon={1.6}
                                    size="$2"
                                    onPress={() => setInputMode("formatted")}
                                />
                                <Button
                                    icon={Braces}
                                    color={inputMode === "json" ? "$color8" : "$color"}
                                    bc={inputMode === "json" ? "$bgPanel" : "$bgContent"}
                                    scaleIcon={1.6}
                                    size="$2"
                                    onPress={() => setInputMode("json")}
                                />
                            </XStack>
                        </XStack>
                    </Tinted>
                    <SearchField value={search} onChange={setSearch} />
                    {
                        showActionsTabs
                            ? <>
                                <TabBar
                                    tabs={actionsTabs}
                                    selectedId={selectedActionsTab}
                                    onSelect={setSelectedActionsTab}
                                />
                                <ScrollView flex={1} width="100%" height="100%">
                                    <XStack mt="$1">
                                        {selectedAction?.content ?? null}
                                    </XStack>
                                </ScrollView>
                            </>
                            : <ScrollView flex={1} width="100%" height="100%">
                                <XStack mt="$1">
                                    {selectedAction?.content ?? null}
                                </XStack>
                            </ScrollView>
                    }

                </YStack>
            </Panel>}
            <CustomPanelResizeHandle direction="horizontal" borderLess={false} borderColor="var(--gray4)" />
            <Panel defaultSize={50} minSize={20} maxSize={80}>
                <YStack flex={1} height="100%" borderRadius="$3" p="$3" gap="$2" overflow="hidden" >
                    <Label pl="$3" lineHeight={"$4"} fontSize="$5" color="$gray9">States</Label>
                    <SearchField value={stateSearch} onChange={setStateSearch} />
                    {
                        showStatesTabs
                            ? <>
                                <TabBar
                                    tabs={statesTabs}
                                    selectedId={selectedStatesTab}
                                    onSelect={setSelectedStatesTab}
                                />
                                <ScrollView flex={1} width="100%" height="100%" overflow="auto">
                                    <XStack mt="$1">
                                        {selectedState?.content ?? null}
                                    </XStack>
                                </ScrollView>
                            </>
                            : <ScrollView flex={1} width="100%" height="100%" overflow="auto">
                                <XStack mt="$1">
                                    {selectedState?.content ?? null}
                                </XStack>
                            </ScrollView>
                    }
                </YStack>
            </Panel>
        </PanelGroup>
    </Panel>
}
