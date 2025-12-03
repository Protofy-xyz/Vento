import React, { useContext } from 'react';
import { connectItem, dumpConnection, getId, PORT_TYPES, DumpType, createNode } from '../lib/Node';
import Node, { FlowPort, headerSize } from '../Node';
import { Background, useEdges } from '@xyflow/react';
import { FlowStoreContext } from "../store/FlowsStore";
import { NODE_TREE } from '../toggles';
import { DataOutput } from '../lib/types';
import useTheme, { usePrimaryColor } from '../diagram/Theme';
import { ListOrdered, Square, ArrowDownUp, Plus, Workflow } from '@tamagui/lucide-icons';
import { generateBoxShadow } from '../lib/shadow';
import { useThemeSetting } from '@tamagui/next-theme'
import { useProtoflow } from '../store/DiagramStore';
import { Button, CardFrame } from '@my/ui';

const blockOffset = 200
const _marginTop = 222
const minBlockHeight = 120
const singleNodeOffset = 45
const alignBlockWithChildrens = true
const borderWidth = 3
const borderColor = '#ccc'

const ENABLE_CONTAINER = false
const portSpacing = 100
const nodeMarginVerticalPort = 110

const nodeOffset = 120
const childOffset = nodeOffset - 15

const Block = (node) => {
    const { id, type } = node
    const useFlowsStore = useContext(FlowStoreContext)
    const primaryColor = usePrimaryColor()
    const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
    const metaData = useFlowsStore(state => state.nodeData[id] && state.nodeData[id]['_metadata'] ? state.nodeData[id]['_metadata'] : { childWidth: 0, childHeight: 0, childHeights: [] })
    // console.log('metadata: ', metaData)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const currentPath = useFlowsStore(state => state.currentPath)

    const nodeFontSize = useTheme('nodeFontSize')
    const nodeBackgroundColor = useTheme('nodeBackgroundColor')

    const { resolvedTheme } = useThemeSetting()
    const { setEdges, getEdges } = useProtoflow()




    const isEmpty = !metaData.childHeight
    const marginTop = _marginTop + (useTheme('nodeFontSize') / 2)
    //console.log('metadata in', node.id, metaData)
    const getBlockHeight = () => {
        if (!metaData.childHeight) return minBlockHeight
        return Math.max(250, metaData.childHeight + 120)
    }

    const height = id ? getBlockHeight() : 0
    const edges = useEdges();

    const addConnection = () => {
        setNodeData(id, {
            ...nodeData,
            connections: nodeData.connections ? nodeData.connections.concat([1]) : [1]
        })
    }

    const onSwitchConnection = (index) => {
        const prevIndex = index - 1
        const prevBlock = 'block' + prevIndex
        const currBlock = 'block' + index

        const switchEdge = (targetHandle: string) => {
            if (targetHandle.endsWith(prevBlock)) return targetHandle.replace(prevBlock, currBlock)
            else if (targetHandle.endsWith(currBlock)) return targetHandle.replace(currBlock, prevBlock)
            else return targetHandle
        }

        setEdges(edgs => edgs.map(e => ({ ...e, targetHandle: e.target == id ? switchEdge(e.targetHandle) : e.targetHandle })))
    }

    let extraStyle: any = {}
    extraStyle.minHeight = height + 'px'
    extraStyle.border = 0

    extraStyle.minWidth = type == 'CaseClause' || type == 'DefaultClause' ? '400px' : '120px'

    const containerColor = useTheme('containerColor')
    const typeConf = {
        SourceFile: {
            icon: Workflow,
            output: false,
            color: primaryColor,
            title: currentPath.split(/[/\\]/).pop()
        },
        Block: {
            icon: Workflow,
            color: primaryColor,
            title: 'Block'
        },
        CaseClause: {
            icon: Workflow,
            color: primaryColor,
            title: 'Case Clause'
        },
        DefaultClause: {
            icon: Workflow,
            color: primaryColor,
            title: 'Case Clause'
        }
    }

    // extraStyle.backgroundColor = typeConf[type].color

    const buttonStyle = {
        opacity: 0.1,
        borderRadius: '4px',
        borderColor: typeConf[type].color,
        borderWidth: 5,
        position: 'absolute',
        backgroundColor: 'transparent',
        hoverStyle: {
            borderColor: typeConf[type].color,
            opacity: 1
        },
        scaleIcon: 1.5,
        padding: "$2",
        left: 3
    }
    const connectedEdges = id ? edges.filter(e => e.target == id) : []

    if (id) {
        React.useEffect(() => {
            if (nodeData.mode != 'json' && (connectedEdges.length == nodeData?.connections?.length || !nodeData?.connections?.length)) {
                addConnection()
            } else {
                //remove connections
                const lastConnected = connectedEdges.reduce((last, current) => {
                    const x = parseInt(current.targetHandle.slice(id.length + 6), 10)
                    return x > last ? x : last
                }, -1)

                // console.log(id, 'prev: ', nodeData?.connections, 'edges: ', connectedEdges, lastConnected, 'should be: ', lastConnected)
                setNodeData(id, {
                    ...nodeData,
                    connections: nodeData.connections.slice(0, lastConnected + 2)
                })
            }

        }, [edges, nodeData?.connections?.length])
    }

    const blockEdgesPos = connectedEdges.map(e => Number(e.targetHandle.split('block')[1]))

    const onAddConnection = (index) => {
        let prevIndex = 0

        const spaceOnTop = blockEdgesPos.filter((pos, i) => pos > i).includes(index)
        const realIndex = spaceOnTop ? index - 1 : index
        blockEdgesPos.splice(realIndex, 0, -1).filter(i => i == 0 || i);
        const newPosArr = blockEdgesPos.map((i, a) => (i >= 0 ? a : undefined)).filter(i => i == 0 || i)


        setEdges(edgs => [
            // sort edges by targetHandle to avoid conflicts
            ...edgs.sort((a, b) => ((Number(a?.targetHandle.split('block')[1])) - Number(b.targetHandle.split('block')[1]))).map(e => {
                if (e.target == id) {
                    e['targetHandle'] = id + '_block' + newPosArr[prevIndex]
                    prevIndex = prevIndex + 1
                }
                return {
                    ...e,
                }
            })
        ]
        )
    }

    const thick = 8;                 // borde izquierdo
    const thin = borderWidth;        // borde fino
    const color = typeConf[type].color;
    const left = isEmpty ? undefined : -thick
    const right = isEmpty ? -thick + -5 : undefined
    const bg = "rgba(0,0,0," + (resolvedTheme == 'dark' ? '0.2' : '0.04') + ")"; // fondo semitransparente
    return (
        <Node
            draggable={false}
            container={!isEmpty}
            style={extraStyle}
            icon={typeConf[type].icon ?? null}
            node={node}
            output={typeConf[type]['output'] == false ? null : { field: 'value', type: 'output' }}
            isPreview={!id}
            title={typeConf[type].title}
            id={id}
            params={[]}
            color={typeConf[type].color}
            dataOutput={DataOutput.block}>
            <div>
                {!isEmpty && <div
                    style={{
                        position: "absolute",
                        top: 23,
                        left: 0,
                        width: metaData.childWidth + thin,
                        height: height - 23,
                        backgroundColor: bg,

                        // exterior: recto arriba izq
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: thin,
                        borderBottomRightRadius: thin,
                        borderBottomLeftRadius: thick,

                        overflow: "hidden",
                        pointerEvents: "none",
                    }}
                >
                    {/* lateral izquierdo */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: thick,
                            background: color,
                        }}
                    />
                </div>
                }
                {/* {nodeData.connections?.map((ele, i) => <FlowPort id={id} type='input' label='' style={{ top: 60 + (i * 60) + 'px' }} handleId={'block' + i} />)} */}
                {nodeData.connections?.map((ele, i) => {
                    const prevPos = metaData?.childHeights?.[i - 1]?.height
                    let pos = prevPos ? prevPos + nodeOffset : (i == 0 ? isEmpty ? 70 : 120 : i * portSpacing + (nodeMarginVerticalPort / 1.4))
                    const isFirst = i == 0
                    const isLast = i == nodeData.connections.length - 1
                    const nextPos = isLast ? pos + 80 : metaData?.childHeights?.[i]?.height ? metaData?.childHeights?.[i]?.height + nodeOffset : portSpacing
                    const halfPos = (pos + nextPos) / 2
                    const isSwitchVisible = !isLast && blockEdgesPos.includes(i) && blockEdgesPos.includes(i + 1)
                    const isAddVisible = isLast && blockEdgesPos.includes(i) || blockEdgesPos.includes(i) && blockEdgesPos.includes(i + 1)

                    return <>
                        <FlowPort portSize={25} borderColor={resolvedTheme == 'dark' ? '#222' : primaryColor} borderWidth={"5px"} key={i} id={id} type='input' label='' style={{ top: pos + 'px', left, right }} handleId={'block' + i} allowedTypes={["data", "flow"]} />
                        {/*@ts-ignore*/}
                        {isFirst && blockEdgesPos.includes(i) ? <Button
                            animation={"quick"}
                            {...buttonStyle}
                            onPress={() => onAddConnection(i)}
                            top={singleNodeOffset}
                            icon={<Plus color={typeConf[type].color} />}
                        /> : null}
                        {/*@ts-ignore*/}
                        {!isSwitchVisible && isAddVisible ? <Button
                            animation={"quick"}
                            {...buttonStyle}
                            onPress={() => onAddConnection(i + 1)}
                            top={pos + 40}
                            icon={<Plus color={typeConf[type].color} />}
                        /> : null}
                        {/*@ts-ignore*/}
                        {isSwitchVisible && isAddVisible ? <Button
                            animation={"quick"}
                            {...buttonStyle}
                            onPress={() => onSwitchConnection(i + 1)}
                            top={halfPos}
                            icon={<ArrowDownUp color={typeConf[type].color} />}
                        /> : null}
                    </>
                })}
            </div>
        </Node>
    );
}

Block.keywords = ["block", "{}", "CaseClause", 'group']
Block.category = "common"
Block.defaultHandle = PORT_TYPES.flow + 'block0'
Block.getData = (node, data, nodesData, edges, mode) => {
    //connect all children in a line
    const statements = node.getStatements ? node.getStatements() : node.getDeclarations()
    statements.forEach((statement, i) => {
        const item = data[getId(statement)]
        if (!item?.type) console.error('item has no type: ', item)
        if (item?.type == 'node') {
            const targetId = item.value.id
            if (targetId) {
                connectItem(targetId, 'output', node, 'block' + i, data, nodesData, edges, null, [PORT_TYPES.data, PORT_TYPES.flow])
            }
        }
    })

    const connections = node.getStatements()
    return { connections: mode == 'json' && connections.length ? connections : connections.concat([1]), mode: mode }
}
Block.dataOutput = DataOutput.block

Block.dump = (node, nodes, edges, nodesData, metadata = null, enableMarkers = false, dumpType: DumpType = "partial", level = 0, trivia = '') => {
    const data = nodesData[node.id] ?? { connections: [] };
    const connections = data.connections ?? []
    const astNode = data._astNode
    var originalText: string;
    if (astNode) {
        originalText = astNode.getText()
    }
    const spacing = node.type == 'Block' ? "\t" : ""

    let body = connections.map((statement, i) => {
        const valueEdge = edges.find(e => e.targetHandle == node.id + PORT_TYPES.flow + "block" + i && e.source)
        var prefix = ''
        //  if(valueEdge) {
        //     const valueNode = nodes.find(n => n.id == valueEdge.source)

        //  if(valueNode) {
        //      const childAstNode = nodesData[valueNode.id]._astNode
        //      if(childAstNode) {
        //             const childFullText = childAstNode.getFullText()
        //             console.log('childFullText: ', childFullText)
        //             const pos = originalText.indexOf(childFullText)
        //             console.log('childFullText pos: ', pos)
        //             if(pos) {
        //                 prefix = originalText.substring(0, pos)
        //             }
        //             console.log('childFullText prev originalText: ', originalText)
        //             originalText = originalText.substring(pos + childFullText.length)
        //             console.log('childFullText post originalText: ', originalText)
        //      }
        //  }
        // }
        const triviaInfo = {}
        let line = dumpConnection(node, "target", "block" + i, PORT_TYPES.flow, '', edges, nodes, nodesData, metadata, enableMarkers, dumpType, level + 1, triviaInfo)
        //console.log('line is: ', line, 'and trivia is: [', triviaInfo['content']+']')
        prefix = triviaInfo['content'] && triviaInfo['content'].includes("\n") || !i ? '' : "\n" + (line ? spacing.repeat(level > 0 ? level : 0) : '')
        line = line ? prefix + line : null
        return { code: line, trivia: triviaInfo['content'] ?? '' }
    }).filter(l => l.code)


    const blockStartSeparator = body.length && body[0].trivia.includes("\n") ? "" : "\n"
    const value = (node.type == 'Block' ? "{" + blockStartSeparator : '') + body.map(b => b.code + ";").join("") + (node.type == 'Block' ? "\n" + spacing.repeat(Math.max(level - 1, 0)) + "}" : '')
    return value
}

// Block.onCreate = (nodeData, edges, nodeStore) => {
//     //const myEdges = edges.filter(edge => edge.target == nodeData.id)

//     return [nodeData].concat(nodeStore?.connections?.filter(c => !isNaN(c)).reduce((total, current, i) => {
//         const phantomId = 'Phantom_'+generateId()
//         connectItem(phantomId, 'output', nodeData.id, 'block'+i, {}, edges, null, [PORT_TYPES.data, PORT_TYPES.flow])
//         return total.concat(createNode([0, 0], 'PhantomBox', phantomId, null, false, edges, {}))
//     },[]))
// }

Block.getPosition = (pos, type) => {
    pos.y = pos.y + childOffset
    // pos.x = pos.x + 40000
    return pos
}

Block.filterChildren = (node, childNodeList, edges, nodeDataTable, setNodeData) => {
    if (!NODE_TREE) return childNodeList
    //if(!childNodeList.length || !childNodeList[0].id.startsWith('SourceFile_')) return childNodeList
    const vContainer = createNode([0, 0], "VisualGroup", 'VisualGroup_' + childNodeList[0].id, { visible: false }, false, edges)
    vContainer[0].children = childNodeList

    return vContainer;
}

Block.getWidth = (node) => {
    return 0
}

export default Block
