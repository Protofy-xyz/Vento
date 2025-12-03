import React, { useState, useRef, useContext, useEffect, useCallback, forwardRef } from 'react';
import { Panel } from '@xyflow/react';
import nodes from '../nodes'
import { FlowStoreContext } from "../store/FlowsStore";
import { generateId } from '../lib/IdGenerator';
import { PORT_TYPES, createNode } from '../lib/Node';
import { withTopics } from "react-topics";
import Text from './NodeText';
import useTheme, { usePrimaryColor } from './Theme';
import { splitOpenerEdge } from '../lib/Edge';
import { Search, Code } from '@tamagui/lucide-icons'
import { useProtoflow } from '../store/DiagramStore';
import { generateBoxShadow } from '../lib/shadow';
import { Separator, SizableText, Tabs, TabsContentProps, Button } from '@my/ui';
import { Monaco } from 'protolib/components/Monaco'

const menuWidth = 300
const defMenuHeight = 500
const menuMargin = 100
const inputHeight = 38
const inputRadius = 8

const TabsContent = (props: TabsContentProps) => {
    return (
        <Tabs.Content
            padding="$2"
            flex={1}
            borderRadius="$2"
            borderTopLeftRadius={0}
            borderTopRightRadius={0}
            {...props}
        >
            {props.children}
        </Tabs.Content>
    )
}

const SelectedBorder = (props) => {
    const borderWidthSelected = useTheme("borderWidthSelected")
    const primaryColor = useTheme("borderColorSelected")
    const borderRadius = useTheme("borderRadiusSelected")
    const boxShadow = useTheme("boxShadowSelected")

    return (
        <div style={{
            display: 'flex',
            border: props.isSelected ? `${borderWidthSelected}px solid ${primaryColor}` : '0px solid transparent',
            borderRadius: (borderRadius) + "px",
            alignItems: 'stretch',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            boxSizing: 'border-box',
            flexBasis: 'auto',
            flexDirection: 'column',
            flexShrink: '0',
            listStyle: 'none',
            margin: '0px',
            minHeight: '0px',
            minWidth: '0px',
            padding: '0px',
            position: 'relative',
            textDecoration: 'none',
            boxShadow: props.isSelected ? boxShadow : "none",
            zIndex: '0'
        }}>
            {props.children}
        </div>
    )
}

const SearchBar = forwardRef(({ inputBorder, bgColor, textColor, interactiveColor, value, onChange, display = 'flex', ...props }: any, ref) => {
    return <div style={{ height: inputHeight, display: display, flexDirection: 'row', gap: '5px', marginBottom: '10px', position: 'relative', padding: '7px' }}>
        <input
            ref={ref}
            style={{
                fontFamily: 'Jost-Regular',
                padding: '8px',
                height: inputHeight,
                border: inputBorder,
                display: 'flex',
                flex: 1,
                width: '100%',
                boxSizing: 'border-box',
                fontSize: '14px',
                backgroundColor: bgColor,
                borderRadius: inputRadius,
                borderWidth: '0px',
                outline: 'none',
                paddingLeft: '32px',
                color: textColor
            }}
            onFocus={e => e.currentTarget.style.border = '2px solid ' + interactiveColor}
            onBlur={e => e.currentTarget.style.border = inputBorder}
            value={value}
            onChange={t => onChange(t.target.value)}
            {...props}
        />
        {/*@ts-ignore*/}
        <Search color='#57534e' size={20} style={{ marginRight: '-5px', marginLeft: '8px', position: 'absolute', top: 16 }} />
    </div>
})

const List = forwardRef(({ ...props }: any, ref) => {
    return <div
        ref={ref}
        className={".list-protoflow"}
        style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            paddingRight: ref?.current?.scrollHeight > ref?.current?.clientHeight ? '10px' : '0px'
        }}>
        {props.children}
    </div>
})

const RenderCustomComponent = ({ index, node, addElement, isSelected, realIndex }) => {
    return <div
        key={index}
        onClick={() => addElement(node.type, node)}
        //@ts-ignore
        style={{ display: realIndex == -1 ? 'none' : undefined, marginBottom: '10px', borderRadius: "12px" }}>
        <SelectedBorder isSelected={isSelected}>
            {node.getComponent({ type: node.type }, {}, null, node)}
        </SelectedBorder>
    </div>
}

const Menu = withTopics(({
    enabledNodes = ['*'],
    config = {},
    hideBaseComponents,
    customComponents = [],
    customSnippets = [],
    diagramNodes,
    setNodeData,
    nodeData,
    edges,
    onAddSnippet,
    takeSnapshot = () => null,
    reactFlowWrapper = null,
    topics,
    onAddNode = (node: any, newEdge: any, initialData: any) => null,
    onEditDiagram = (nodes, edges, focus) => { }
}) => {
    const panelRef = useRef()
    const inputRef = useRef()
    const scrollRef: any = useRef()

    const visibleTabs = config?.visibleTabs ?? ["*"]
    const allTabsVisible = visibleTabs.includes("*")

    const defaultTab = allTabsVisible ? 'nodes' : visibleTabs[0]
    const [selectedTab, setSelectedTab] = useState(defaultTab)
    const [searchValue, setSearchValue] = useState('')
    const [fragmentText, setFragmentText] = useState('')
    const [selectedNode, setSelectedNode] = useState(0)

    const useFlowsStore = useContext(FlowStoreContext)
    const menuState = useFlowsStore(state => state.menuState)
    const menuPosition = useFlowsStore(state => state.menuPosition)
    const menuOpener = useFlowsStore(state => state.menuOpener)
    const setMenu = useFlowsStore(state => state.setMenu)
    const { project, setViewport, getViewport } = useProtoflow();
    const { publish } = topics;

    const offsetHeight = reactFlowWrapper?.current?.offsetHeight
    const menuHeight = offsetHeight < (defMenuHeight + menuMargin * 2) ? offsetHeight - (menuMargin * 1.5) : defMenuHeight

    const getMenuTop = () => {
        var defaultTop = (menuPosition[1] - 30)
        if (defaultTop < 70) {
            return 70
        } else if (defaultTop + menuHeight + menuMargin < reactFlowWrapper?.current.offsetHeight) {
            return defaultTop
        } else {
            return reactFlowWrapper?.current.offsetHeight - menuHeight - menuMargin
        }
    }

    const getMenuLeft = () => {
        var defaultLeft = (menuPosition[0] - 110)
        if (!reactFlowWrapper?.current) return 100
        if (defaultLeft < 100 || (reactFlowWrapper?.current.offsetWidth - menuWidth - menuMargin) < 100) {
            return 100
        } else if (defaultLeft + menuWidth + menuMargin < reactFlowWrapper?.current.offsetWidth) {
            return defaultLeft
        } else {
            return reactFlowWrapper?.current.offsetWidth - menuWidth - menuMargin
        }
    }

    const isRelatedKeyWord = (keywords) => keywords?.some(k => k?.toLowerCase()?.includes(searchValue.toLowerCase()) || searchValue?.toLowerCase()?.includes(k?.toLowerCase()))

    const _nodes: any = Object.fromEntries(Object.entries(nodes).filter(([key, value]) => enabledNodes.includes(key) || enabledNodes.includes('*')))
    const _customComponents = customComponents.filter((c) => enabledNodes.includes(c.type) || enabledNodes.includes('*'))

    const handleTypeOpener = menuOpener.targetHandle ? menuOpener.targetHandle.replace(menuOpener.target, '').slice(1) : null


    let nodeList = Object.keys(_nodes).map((key) => {
        let node = _nodes[key].type ?? _nodes[key]
        return { node: node, key: key }
    })

    if (searchValue) {
        nodeList = nodeList.filter(current => {
            const nodeKeyWords = [...(current.node?.keywords ?? []), current.node.name]
            //@ts-ignore
            return isRelatedKeyWord(nodeKeyWords)
        })
    }
    let customNodeList = _customComponents
    let customSnippetsList = customSnippets
    if (searchValue) {
        customNodeList = _customComponents.filter(customN => {
            const customNodeKeyWords = [...(customN?.keywords ?? []), customN.id]
            return isRelatedKeyWord(customNodeKeyWords)
        })
        customSnippetsList = customSnippets.filter(customM => {
            const customNodeKeyWords = [...(customM?.keywords ?? []), customM.name]
            return isRelatedKeyWord(customNodeKeyWords)
        })
    }

    const list = [
        ...customNodeList.map((node: any, index) => {
            return {
                type: node.type,
                category: node.category ?? "custom",
                addElement: () => addElement(node.type, node),
                render: () => {
                    const realIndex = customNodeList.findIndex(n => n.id.toLowerCase().trim() == node.id.toLowerCase().trim())
                    const isSelected = realIndex == selectedNode
                    return !node.hidden ? <RenderCustomComponent key={index + node.id} index={index} addElement={addElement} isSelected={isSelected} node={node} realIndex={realIndex} /> : null
                }
            }
        }),
        ...(!hideBaseComponents ? nodeList.map((current: any, index) => {
            return {
                type: current.node,
                category: current.node.category ?? "javascript",
                addElement: () => addElement(current.key),
                render: () => {
                    return <div onClick={() => addElement(current.key)} key={index} style={{ marginBottom: '10px' }}>
                        <SelectedBorder isSelected={customNodeList.length + index == selectedNode}>
                            {React.createElement(current.node, { type: current.key })}
                        </SelectedBorder>
                    </div>
                }
            }
        }) : [])
    ]

    const groupByCategory = list.reduce((total, current) => {
        if (!total[current.category]) total[current.category] = []
        total[current.category].push(current)
        return total
    }, {})
    const snippetsByCategory = customSnippetsList.reduce((total, current) => {
        const moleculeCategory = current.category ?? 'customSnippets'
        if (!total[moleculeCategory]) total[moleculeCategory] = []
        total[moleculeCategory].push(current)
        return total
    }, {})

    const extraStyle = menuState != 'open' ? { top: '-5000px' } : { top: getMenuTop() + 'px', left: getMenuLeft() + 'px' }

    const isTabVisible = (tab) => {
        if (allTabsVisible || visibleTabs.includes(tab)) return true
        else return false
    }

    const addElement = async (type, customNode?) => {
        takeSnapshot()
        setSearchValue('')

        const id = type + PORT_TYPES.flow + generateId()
        const pos = project({ x: getMenuLeft(), y: menuPosition[1] })
        var newNode = createNode([pos.x, pos.y - 70], type, id, {}, true, {}, {})
        var newEdges = []
        var initialData = {}
        var edgesToDelete = []

        if (customNode) {
            initialData = customNode.getInitialData()
            setNodeData(id, initialData)
        }
        if (menuOpener.type == 'edge') {
            const node = _nodes[type].type ?? _nodes[type]
            const defaultHandle = node.defaultHandle
            newEdges.push(...splitOpenerEdge(menuOpener, id, defaultHandle))
            edgesToDelete.push(menuOpener.edgeId)
        } else {
            const target = menuOpener.target

            const newEdge = {
                animated: false,
                id: generateId(),
                source: id,
                sourceHandle: id + '-output',
                target: target,
                targetHandle: menuOpener.targetHandle,
                type: 'custom'
            }
            newEdges.push(newEdge)
            if (!nodeData[target].hasOwnProperty(handleTypeOpener)) {
                setNodeData(target, { [handleTypeOpener]: undefined })
            }
            onAddNode(newNode[0], newEdge, initialData) // createNode returns array, get frist position
        }

        const finalEdges = edges.filter((e) => !edgesToDelete.includes(e.id)).concat(newEdges)
        const finalNodes = diagramNodes.concat(newNode);
        setMenu('closed')

        const focusElement = (newNodes, diagramRef) => {
            if (!diagramRef) return
            // const diagramRect = diagramRef.getBoundingClientRect();
            const viewport = getViewport()
            const myNode = newNodes.find(n => n.id == newNode[0].id)
            const elem = document.getElementById(id)
            const posX = -myNode.position.x //+ (diagramRect.width / 2)
            const posY = -myNode.position.y //+ (diagramRect.height / 2)

            if (!elem) return
            const firstInput = elem.querySelector('input:first-of-type')
            if (firstInput) {
                //@ts-ignore
                firstInput.focus()
                handleTransform(posX, posY, viewport.zoom)
            }
            const firstButton = elem.querySelector("div > [role='button']:first-of-type")
            if (firstButton) {
                //@ts-ignore
                firstButton.focus()
                handleTransform(posX, posY, viewport.zoom)
            }
        }
        onEditDiagram(finalNodes, finalEdges, focusElement)
    }

    const addSnippet = (snippets) => {
        onAddSnippet(snippets, menuOpener)
        setMenu('closed')
    }

    const handleTransform = useCallback((posX, posY, zoom) => {
        //setViewport({ x: posX, y: posY, zoom: zoom}, { duration: 500 });
    }, [setViewport]);

    const onSubmit = () => {
        if (list[selectedNode]) {
            list[selectedNode].addElement()
        }
    }

    const onKeyDown = (e) => {
        const heightToScroll = 44
        if (e.key == "Enter") {
            onSubmit()
        } else if (e.key == "ArrowDown" && selectedNode < (customNodeList.length + nodeList.length) - 1) {
            setSelectedNode(selectedNode + 1)
            //@ts-ignore
            scrollRef.current.scrollBy({ top: heightToScroll, behavior: 'smooth' });
        } else if (e.key == "ArrowUp" && selectedNode > 0) {
            setSelectedNode(selectedNode - 1)
            //@ts-ignore
            scrollRef.current.scrollBy({ top: -heightToScroll, behavior: 'smooth' });
        } else {
            setSelectedNode(0)
        }
    }

    useEffect(() => {
        if (menuState != 'closed') {
            try {
                //@ts-ignore
                inputRef?.current.focus()
            } catch (e) {
                console.error('error focusing element. ', e)
            }
        }
        publish("menuState", { state: menuState })
    }, [menuState])

    const textColor = useTheme("textColor")
    const bgColor = useTheme("menuBackground")
    const inputBorder = useTheme('inputBorder')
    const highlightInputBackgroundColor = useTheme("highlightInputBackgroundColor")
    const tColor = useTheme('titleColor')
    const interactiveColor = useTheme('interactiveColor')
    const disableTextColor = useTheme('disableTextColor')
    const primaryColor = usePrimaryColor()

    return (
        <Panel position='top-left'>
            <div
                onClick={() => setMenu('closed')}
                style={{ display: menuState == 'closed' ? 'none' : 'flex', height: '100vh', width: '100vw', position: 'absolute' }}>
            </div>
            <div style={{ position: 'absolute', ...extraStyle }}>
                <Tabs
                    ref={panelRef}
                    defaultValue={selectedTab}
                    orientation="horizontal"
                    flexDirection="column"
                    width={menuWidth}
                    height={menuHeight}
                    borderRadius="14px"
                    overflow="hidden"
                    backgroundColor={bgColor}
                    onValueChange={(v) => {
                        try {
                            if (["nodes", "snippets"].includes(v)) {
                                //@ts-ignore
                                setTimeout(() => inputRef?.current.focus(), 20)
                            }
                        } catch (e) { console.error('error focusing element. ', e) }
                        setSelectedTab(v)
                    }}
                    style={{ boxShadow: generateBoxShadow(8), backdropFilter: 'blur(20px)' }}
                >
                    <Tabs.List
                        display={!allTabsVisible && visibleTabs.length == 1 ? 'none' : 'flex'}
                        disablePassBorderRadius="bottom"
                    >
                        {isTabVisible('nodes') && <Tabs.Tab flex={1} value="nodes" backgroundColor={"transparent"}>
                            <SizableText fontWeight={selectedTab == "nodes" ? "500" : ""} color={selectedTab == "nodes" ? interactiveColor : ""}>Nodes</SizableText>
                        </Tabs.Tab>}
                        {isTabVisible('snippets') && <Tabs.Tab flex={1} value="snippets" backgroundColor={"transparent"}>
                            <SizableText fontWeight={selectedTab == "snippets" ? "500" : ""} color={selectedTab == "snippets" ? interactiveColor : ""}>Snippets</SizableText>
                        </Tabs.Tab>}
                        {isTabVisible('code') && <Tabs.Tab flex={1} value="code" backgroundColor={"transparent"}>
                            <SizableText fontWeight={selectedTab == "code" ? "500" : ""} color={selectedTab == "code" ? interactiveColor : ""}>Code</SizableText>
                        </Tabs.Tab>}
                    </Tabs.List>
                    <Separator />
                    <SearchBar
                        ref={inputRef}
                        display={["nodes", "snippets"].includes(selectedTab) ? 'flex' : 'none'}
                        onChange={setSearchValue}
                        value={searchValue}
                        inputBorder={inputBorder}
                        textColor={textColor}
                        bgColor={highlightInputBackgroundColor}
                        interactiveColor={interactiveColor}
                        placeholder={selectedTab == "snippets" ? "search snippets" : "search nodes"}
                    />
                    {isTabVisible('nodes') && <TabsContent value="nodes">
                        <List>
                            {Object.keys(groupByCategory).map((category, index) => {
                                return <div key={index}>
                                    <Text
                                        style={{
                                            fontSize: '16px',
                                            fontFamily: 'Jost-Medium',
                                            marginLeft: '10px'
                                        }}
                                    >
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                    </Text>
                                    <div style={{ marginTop: '12px' }}>
                                        {groupByCategory[category].map((node, index) => {
                                            return node.render()
                                        })}
                                    </div>
                                </div>
                            })}
                        </List>
                    </TabsContent>}

                    {isTabVisible('snippets') && <TabsContent value="snippets">
                        <List>
                            {Object.keys(snippetsByCategory).map((category, index) => {
                                return <div key={category}>
                                    <Text
                                        style={{
                                            fontSize: '16px',
                                            fontFamily: 'Jost-Medium',
                                            marginLeft: '10px'
                                        }}
                                    >
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                    </Text>
                                    <div style={{ marginTop: '12px' }}>
                                        {snippetsByCategory[category].map((molecule, index) => {
                                            return <div
                                                key={molecule.name}
                                                onClick={() => addSnippet(molecule)}
                                                style={{ display: 'flex', backgroundColor: primaryColor, boxShadow: generateBoxShadow(3), borderRadius: inputRadius, borderBottom: '0px', padding: '10px', marginBottom: '10px', flexDirection: 'column' }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.boxShadow = generateBoxShadow(10)
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.boxShadow = generateBoxShadow(3)
                                                }}
                                            >
                                                <Text style={{
                                                    fontSize: '18px', padding: '0px 10px 0px 10px', color: tColor,
                                                    flex: 1, top: '4px', fontFamily: 'Jost-Medium', maxWidth: '22ch',
                                                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                                                }}
                                                >
                                                    {molecule.name}
                                                </Text>
                                                <Text style={{
                                                    fontSize: '14px', padding: '0px 10px 0px 10px', color: tColor,
                                                    opacity: 0.5, flex: 1, top: '4px', fontFamily: 'Jost-Regular',
                                                    whiteSpace: 'pre-line', WebkitLineClamp: 6, overflow: 'hidden',
                                                    textOverflow: 'ellipsis', display: '-webkit-box',
                                                    WebkitBoxOrient: 'vertical',
                                                }}
                                                >
                                                    {molecule.code}
                                                </Text>
                                            </div>
                                        })}
                                    </div>
                                </div>
                            })}
                        </List>
                    </TabsContent>}
                    {
                        isTabVisible('code') &&
                        <TabsContent value="code" gap="$2">
                            <Monaco
                                sourceCode={fragmentText}
                                options={{
                                    folding: false,
                                    lineDecorationsWidth: 0,
                                    lineNumbersMinChars: 0,
                                    lineNumbers: false,
                                    minimap: { enabled: false }
                                }}
                                onChange={(code) => { setFragmentText(code); }}
                            />

                            <Button
                                alignSelf='flex-end'
                                size={"$3"}
                                disabled={!fragmentText}
                                hoverStyle={{
                                    backgroundColor: !fragmentText ? disableTextColor : interactiveColor,
                                    opacity: 0.8
                                }}
                                color={"white"}
                                backgroundColor={!fragmentText ? disableTextColor : interactiveColor}
                                onPress={() => addSnippet({ code: fragmentText })}
                            >
                                Add Code
                            </Button>

                        </TabsContent>
                    }
                </Tabs>
            </div>
        </Panel>
    );
});

export default Menu