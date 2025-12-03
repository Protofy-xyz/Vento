import '@tamagui/core/reset.css'
import '@tamagui/font-inter/css/400.css'
import '@tamagui/font-inter/css/700.css'
import React, { useCallback, useMemo, useEffect, useRef, useState, useContext } from 'react';
import { Panel, useNodesInitialized } from '@xyflow/react';
import { PORT_TYPES, createNode, getId, saveNodes } from './lib/Node';
import { getDiffs } from './lib/diff'
import { NodeTypes } from './nodes';
import Menu from './diagram/Menu';
import CustomEdge from './Edge';
import ActionsBar, { reLayout } from './ActionsBar';
import getCustomComponent from './nodes/custom';
import Diagram from './diagram/Diagram';
import { withTopics, TopicsProvider } from "react-topics";
import { Project, IndentationText, ScriptTarget, ScriptKind, LanguageVariant } from "ts-morph";
import { useFlowsStore, FlowStoreContext } from "./store/FlowsStore"
import { validateCode } from './lib/Node'
import {
    deleteNodes,
    removeDataChildAndReorder,
    deleteAdditionalKeys, dumpContent, findJsxElementByNodeId, findJsxElementDumpedPropValue
} from './lib/FlowsOperations';
import Diff from 'deep-diff';
import GetDynamicCustomComponent from './DynamicCustomComponent';
import { generateId } from './lib/IdGenerator';
import { useProtoEdgesState, useProtoNodesState, addProtoEdge } from './store/DiagramStore'
import layouts from "./diagram/layouts";
import { ContextMenu } from './ContextMenu';

interface customComponentInterface {
    check: Function,
    getComponent: Function
}
interface customSnippetsInterface {
    code: string,
    name: string,
    category?: string,
    keywords?: string[]
}

interface FlowProps {
    disableMiniMap?: boolean,
    disableControls?: boolean,
    disableSideBar?: boolean,
    disableDots?: boolean,
    bgColor?: string,
    sourceCode?: string,
    positions?: any,
    onSave?: Function,
    onShowCode?: Function,
    onPlay?: Function,
    onReload?: Function,
    disableStart?: boolean,
    getFirstNode?: any,
    layout?: Function,
    customComponents?: customComponentInterface[],
    customSnippets?: customSnippetsInterface[],
    hideBaseComponents?: boolean,
    topics?: any,
    flowId?: string,
    display?: boolean
    enableCommunicationInterface?: Function
    dataNotify?: Function,
    children?: any,
    zoomOnDoubleClick?: boolean,
    showActionsBar?: boolean,
    onSelectionChange?: Function,
    onEdit?: Function,
    config?: any,
    themeMode?: 'light' | 'dark',
    theme?: any,
    primaryColor: string,
    bridgeNode: boolean,
    onViewPortChange?: Function,
    defaultViewPort?: { x: number, y: number, zoom: number },
    path?: string,
    mode?: 'js' | 'json',
    nodePreview?: 'preview' | 'flow-preview' | 'flow',
    metadata?: any
    defaultSelected?: Function,
    autoFitView?: boolean,
    nodeMenu?: any,
    onBeforePrepare?: any
    onBeforeSave?: any
}

const FlowsBase = ({
    dataNotify = () => { },
    disableDots = false,
    bgColor = "transparent",
    onShowCode = null,
    sourceCode,
    onSave,
    onPlay,
    onReload,
    disableStart = false,
    getFirstNode = (nodes) => nodes.find(n => n.id && n.id.startsWith('SourceFile')),
    customComponents = [],
    customSnippets = [],
    hideBaseComponents = false,
    positions,
    autoFitView,
    layout,
    topics,
    flowId,
    display = true,
    enableCommunicationInterface = undefined,
    children,
    showActionsBar = false,
    zoomOnDoubleClick = true,
    onSelectionChange = () => { },
    onEdit = () => { },
    config = {},
    themeMode = 'light',
    theme = {},
    primaryColor = '#F7B500',
    disableMiniMap = true,
    bridgeNode = false,
    onViewPortChange = () => { },
    defaultViewPort = { x: 100, y: window.innerHeight / 4, zoom: 0.8 },
    path = "Start",
    mode = 'js',
    nodePreview = 'flow',
    metadata = {},
    defaultSelected = () => undefined,
    nodeMenu = null,
    onBeforePrepare = null,
    onBeforeSave = null
}: FlowProps) => {
    const { data, publish } = topics;
    const useFlowsStore = useContext(FlowStoreContext)
    const diagramRef = useRef(null);
    const flowRef = useRef(null)
    const setError = useFlowsStore(state => state.setError)
    const clearError = useFlowsStore(state => state.clearError)
    const setDataNotify = useFlowsStore(state => state.setDataNotify)
    const initialEdges = useFlowsStore(state => state.initialEdges)
    const setInitialEdges = useFlowsStore(state => state.setInitialEdges)
    const initialNodes = useFlowsStore(state => state.initialNodes)
    const setInitialNodes = useFlowsStore(state => state.setInitialNodes)
    const setSaveStatus = useFlowsStore(state => state.setSaveStatus)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const setNodesData = useFlowsStore(state => state.setNodesData)
    const setMetadata = useFlowsStore(state => state.setMetadata)
    const setCurrentPath = useFlowsStore(state => state.setCurrentPath)
    const setNodesMetaData = useFlowsStore(state => state.setNodesMetaData)
    const clearNodesData = useFlowsStore(state => state.clearNodesData)
    const appendCustomComponents = useFlowsStore(state => state.appendCustomComponents)
    const appendedCustomComponents = useFlowsStore(state => state.customComponents)

    const nodeData = useFlowsStore(state => state.nodeData)
    const menuState = useFlowsStore(state => state.menuState)
    const _customComponents = [...customComponents, ...(config?.masks?.map(m => GetDynamicCustomComponent(m)) ?? [])].filter(x => x)
    const nodeTypes = useMemo(() => (NodeTypes), []);
    const edgeTypes = useMemo(() => {
        return { custom: (props) => CustomEdge(props, bridgeNode) }
    }, []);

    const extraStateData = { nodePreview: nodePreview, flowsHeight: diagramRef.current?.offsetHeight }

    const [nodes, setNodes, onNodesChange] = useProtoNodesState(initialNodes, extraStateData);
    const [edges, setEdges, onEdgesChange] = useProtoEdgesState(initialEdges, extraStateData);
    const [hasChanges, setHasChanges] = useState(false);
    const prevReducedNodesRef = useRef("");
    const [prevNodeData, setPrevNodeData] = useState(deleteAdditionalKeys(nodeData));
    const [menu, setMenu] = useState(null);

    const rendered = useRef(false)
    const isRelayoutingRef = useRef(false)
    const onConnect = useCallback((params) => setEdges((eds) => addProtoEdge(params, eds)), [setEdges]);

    const reload = async () => {
        clearNodesData()
        const { nodes, edges, nodeDataTable } = await readSourceFile()
        setsAll(nodeDataTable, nodes, edges)
    }

    const prepare = (sourceCode) => {
        if (onBeforePrepare) {
            sourceCode = onBeforePrepare(sourceCode, mode)
        }
        if (mode == 'json') {
            return '(' + sourceCode + ')'; //ts-morph does not parse files with an object directly, so we put the object between ( and )
        } else {
            return sourceCode;
        }
    }

    const currentLayout = layout ? layout : (mode == 'json' ? layouts['elk'] : layouts['code'])

    const getEnabledNodesForMode = () => {
        if (mode == 'json') {
            return ['ObjectLiteralExpression', 'ArrayLiteralExpression']
        } else {
            return ['*']
        }
    }

    const _getFirstNode = mode == 'json' ? (nodes) => nodes.find(n => n.id && n.id.startsWith('ObjectLiteralExpression')) : getFirstNode

    const readSourceFile = async (src = sourceCode, isDisableStart = disableStart) => {
        const project = new Project({
            useInMemoryFileSystem: true,
            manipulationSettings: { indentationText: IndentationText.Tab },
            compilerOptions: {
                target: ScriptTarget.Latest,
                scriptKind: ScriptKind.TSX,
                languageVariant: LanguageVariant.JSX
            },
        })
        let source = project.createSourceFile('_temp1.tsx', prepare(src), { overwrite: true })

        if (mode == 'json') {
            //@ts-ignore
            const obj = (source.getStatements()[0])?.getExpression()?.getExpression()
            if (obj) {
                source = obj
            }
        }

        const Visitor = (node, visitCb, exitCb, nodeList) => {
            if (!visitCb(node)) return exitCb(node, nodeList, [])

            let childNodes = []
            node.forEachChild(child => {
                childNodes = childNodes.concat(Visitor(child, visitCb, exitCb, []))
            })

            return exitCb(node, nodeList, childNodes)
        }

        const _data = {} //key=>value of components
        let edges = [] //list of edges
        const nodeDataTable = {}
        let firstElement;

        const data = Visitor(source, (node) => {
            const flowNode = nodeTypes[node.getKindName()]
            //check if the node has a visual node associated to it and has a method to extract its data from the tree
            if (flowNode) {
                const flowNodeType = flowNode.type ?? flowNode
                if ((!flowNodeType.isShadow || !flowNodeType.isShadow(node, _data, mode, edges)) && !firstElement) {
                    firstElement = getId(node)
                }
                if (flowNodeType.skipTraversal) return false
            }
            return true
        }, (node, nodeList, childNodeList) => {
            const flowNode = nodeTypes[node.getKindName()]
            if (node.getParent()?.getKindName() == "CatchClause" && node.getKindName() == "VariableDeclaration") return
            //check if the node has a visual node associated to it and has a method to extract its data from the tree
            var deletable = true
            if (flowNode) {
                const flowNodeType = flowNode.type ?? flowNode
                if (flowNodeType.getData) {
                    nodeDataTable[getId(node)] = {}
                    var nodeData = flowNodeType.getData(node, _data, nodeDataTable, edges, mode)
                    nodeData = { ...nodeDataTable[getId(node)], ...nodeData, _astNode: node }
                    nodeDataTable[getId(node)] = nodeData
                    _data[getId(node)] = nodeData
                    const customComponent = getCustomComponent({ type: node.getKindName() }, nodeDataTable[getId(node)] ?? {}, _customComponents);
                    setNodeData(getId(node), nodeData)
                    if (customComponent?.nonDeletable) deletable = false
                }

                if ((!flowNodeType.isShadow || !flowNodeType.isShadow(node, _data, mode, edges)) && (!flowNodeType.checkCreate || flowNodeType.checkCreate(node, _data)) && (node.getKindName() != 'SourceFile' || !isDisableStart)) {
                    let newNodes = createNode([0, 0], node.getKindName(), getId(node), null, node.getKindName() != 'SourceFile' && deletable, edges, nodeDataTable[getId(node)])
                    // if (flowNodeType.getSize) {
                    //     newNodes = flowNodeType.getSize(newNodes, node, nodeDataTable[getId(node)])
                    // }
                    nodeList = nodeList.concat(newNodes)
                    _data[getId(node)] = { type: 'node', value: newNodes[0] }
                }
            }
            if (!_data[getId(node)]) {
                if (node.getChildren().length == 0) {
                    //store the data in the temporary table, needed for chaining
                    _data[getId(node)] = { type: 'data', value: node.getText(), _astNode: node }
                } else {
                    //if there are childrens, get data from frist children with data.
                    //if more precisse behavior is needed, create a visual node associated to this node type
                    //note: you can create node types and not expose them in index.tsx, allowing to manage data, but not creating visual nodes                    
                    _data[getId(node)] = node.forEachDescendant((node) => _data[getId(node)])
                }
            }

            const customComponent = getCustomComponent(_data[getId(node)]?.value, nodeDataTable[getId(node)] ?? {}, _customComponents)

            const fakeSetNodeData = (id, data) => {
                nodeDataTable[id] = data
            }
            if (customComponent && customComponent.filterChildren) {
                fakeSetNodeData(getId(node), { ...nodeDataTable[getId(node)], _initialNodes: childNodeList, _initialEdges: JSON.parse(JSON.stringify(edges)) })
            }

            const flowNodeType = flowNode && flowNode.type ? flowNode.type : flowNode


            const result = [
                ...nodeList,
                ...(customComponent && customComponent.filterChildren ? customComponent.filterChildren(node, childNodeList, edges, nodeDataTable, fakeSetNodeData) : childNodeList),
            ]


            if (flowNodeType && flowNodeType.filterChildren) {
                return flowNodeType.filterChildren(node, result, edges, nodeDataTable, fakeSetNodeData)
            }

            return result;
        }, []).filter((n) => n)

        let nodes = data

        //add visual layers
        if (config && config.layers && config.layers.length) {
            nodes = [...nodes, ...config.layers.map(l => {
                const layerId = 'Layer_' + generateId()
                nodeDataTable[layerId] = l
                return createNode(l.position ?? [0, 0], 'Layer', layerId, {}, false, [], {})[0]
            })]
        }

        return {
            nodes,
            edges,
            nodeDataTable
        }
    }

    const getTree = (nodeData) => {
        //@ts-ignore
        return nodes.reduce((total, node) => {
            const customComponent = getCustomComponent(node, total.nodeData[node.id] ?? {}, _customComponents);
            if (customComponent && customComponent.restoreChildren) {
                const restored = customComponent.restoreChildren(node, total.nodes, total.nodeData[node.id]._initialNodes, total.edges, initialEdges, total.nodeData)
                if (!restored.nodeData) restored.nodeData = total.nodeData
                return restored
            }
            return total
        }, { nodes: nodes, edges: edges, nodeData: nodeData })
    }

    const onSaveNodes = async (preview?) => {
        const tree = getTree(Object.assign({}, nodeData));
        var content
        clearError()
        try {
            //restore components before dump
            content = saveNodes(tree.nodes, tree.edges, tree.nodeData, _getFirstNode, mode)

            if (onBeforeSave) {
                content = onBeforeSave(content, mode)
            }
            console.log('CONTENT: ', content)
            setInitialEdges(tree.edges)
            setInitialNodes(tree.nodes)
            const positions = nodes.map((node) => ({ id: node.id, position: node.position }))
            if (!preview && onSave && nodes?.length) onSave(content, positions, { nodesData: nodeData, nodes })
        } catch (e) {
            console.log('ERROR SAVING CODE: ', e.codeFrame, e)
            const parts = e.codeFrame.split("\n").find(l => l.startsWith('> ')).split('|')
            parts.shift()
            const linePos = e.loc.start.column
            const line = parts.join('|').substr(1, linePos)
            const markerPosition = line.lastIndexOf('/* JSFLOWID(')
            const id = line.substring(markerPosition + '/* JSFLOWID('.length).split(')')[0]
            setSaveStatus('error')
            setError(id)
        }
        return content
    }

    const onPlayNodes = async () => {
        try {
            const content = await onSaveNodes()
            if (onPlay) onPlay(content)
        } catch (e) { console.error(e) }

    }

    const removeSizes = arr => arr.map(item => {
        // v12: exclude measured and internals which are internal xyflow properties
        const { draggable, height, width, position, selected, positionAbsolute, dragging, data, measured, internals, ...rest } = item;
        // Also exclude height/width from data as they are set during layout
        const { layouted, height: dataHeight, width: dataWidth, ...cleanedData } = data ? data : { layouted: 1 };

        return { ...rest, data: cleanedData };
    });

    const onReloadNodes = async () => {
        await setEdges([])
        await setNodes([])
        if (onReload) onReload()
        else reload()
    }

    const actionPublisher = (action, payload) => {
        if (!enableCommunicationInterface) return
        var parentId
        var nodeId = payload.nodeId
        var param = payload.param
        var topicParams
        var value = payload.value

        try {
            value = JSON.parse(value)
        } catch (e) { }

        switch (action) {
            case 'delete-node':
                const deletedNodes = payload
                const deletedNodesIds = deletedNodes.map(n => n.id);
                const edgeToDelete = edges.find(e => deletedNodesIds.includes(e.source))
                parentId = edgeToDelete?.target
                const nodeType = edgeToDelete
                    ? nodes.find(n => n.id == edgeToDelete.source)?.type
                    : deletedNodes.find(n => n.id == deletedNodesIds[0])?.type

                topicParams = {
                    action: 'delete-node',
                    nodesToDelete: deletedNodesIds,
                    deletedNodeType: nodeType // TODO: only returns type of the first node
                }
                if (nodeType == "JsxElement") {
                    // TODO: we have assumed that we allways delete child XD
                    let childPosToDelete = edgeToDelete ? Number(edgeToDelete.targetHandle.split('child-')[1]) : null
                    if (nodeData[parentId]) {
                        const { data: newParentData } = removeDataChildAndReorder(nodeData[parentId], childPosToDelete)
                        setNodesData({ ...nodeData, [parentId]: newParentData })
                    }

                    // const childNum = Number(edgeToDelete?.targetHandle.split('child-')[1])
                    // FIX only remove edge of the first deleted node
                    // const newEdges = moveEdgeChildAndReorder(edges, deletedNodesIds[0], parentId, childNum)
                    // setEdges(newEdges)
                }
                publish("flow/editor", topicParams)
                break
            case 'delete-data':
                topicParams = {
                    action: 'delete-data',
                    nodeId,
                    param
                }
                publish('flow/editor', topicParams)
                break
            case 'add-node':
                const newEdge = payload.newEdge;
                const initialData = payload.initialData;
                const nodeName = initialData?.name;
                const type = payload.node?.type;

                nodeId = payload.node.id;
                parentId = newEdge.target;
                param = newEdge.targetHandle.split(parentId + '-')[1]

                let newNodesData = {
                    ...nodeData,
                    [nodeId]: { ...initialData }
                }
                topicParams = {
                    ...topicParams,
                    action: 'add-node',
                    nodeId: nodeId,
                    type: type,
                    nodeName: nodeName,
                    parent: parentId,
                }
                const dumpCode = dumpContent(nodes, edges.concat(newEdge), newNodesData, nodeId, type)
                if (type == "JsxElement") {
                    const childPos = param?.startsWith('child') ? Number(param.split('child-')[1]) : undefined
                    topicParams = {
                        ...topicParams,
                        childrenPos: childPos - 1,
                    }
                    newNodesData = { ...newNodesData, [parentId]: { ...newNodesData[parentId], ['child-' + childPos]: dumpCode } }
                    setNodesData(newNodesData)
                } else { // FIX: Assumed that when we add node it belong to JsxElement ancestor
                    let port = newEdge.targetHandle.split(parentId)[1]
                    let portType = port.slice(0, 1);
                    let portName = port.slice(1);
                    const parentNodeData = newNodesData[parentId]
                    let key;
                    let value;
                    if (portType == PORT_TYPES.flow) {
                        const fallbackData = parentNodeData["_fallBack"]?.find(fb => fb.fallbackPort == portName && fb.portType == portType)
                        const prop = fallbackData?.preText + dumpCode + fallbackData?.postText;
                        var index = prop.indexOf("=");
                        if (index === -1) return
                        key = prop.substring(0, index).trim();
                        value = prop.substring(index + 1).trim();
                    }
                    else if (portType == PORT_TYPES.data) {
                        const propData = parentNodeData[portName]
                        key = propData?.key;
                        value = dumpCode;
                    }
                    topicParams = {
                        ...topicParams,
                        data: {
                            isAncestorJsxElement: true,
                            key,
                            value
                        }
                    }
                }
                publish("flow/editor", topicParams)
                break;
            case 'add-data':
                var isProp = Boolean(payload.isProp)
                topicParams = {
                    action: 'add-data',
                    nodeId,
                    param,
                    value,
                    isProp
                }
                publish('flow/editor', topicParams)
                break
            case 'edit-data':
                topicParams = {
                    action: 'edit-data',
                    nodeId,
                    param,
                    value,
                    kind: payload.kind,
                    deleteKey: payload.deleteKey
                }
                publish('flow/editor', topicParams)
                break
            default:
                console.error(`Communication sender error. Invalid action ${action}`)
                break;
        }
    }

    const getPropName = (key) => {
        let propName;
        if (!key) return
        if (key.startsWith('prop-')) {
            propName = key.split('prop-')[1]
        }
        else if (key.startsWith('child-')) {
            propName = 'children'
        }
        else {
            propName = key
        }
        return propName
    }

    const isConnected = (targetHandleId) => {
        const edgeConnected = edges.find(e => e.targetHandle == targetHandleId)
        return edgeConnected
    }
    const onNodeDataChange = () => {
        if (!enableCommunicationInterface) return
        const deletedAdditionalKeysNodeData = deleteAdditionalKeys(nodeData)
        if (!Object.keys(prevNodeData).length) return
        const diffs = Diff.diff(prevNodeData, deletedAdditionalKeysNodeData)
        if (!diffs || diffs.length > 1) return // node data changes are one by one, so more than one means that you load a new code
        if (diffs.find(d => d.kind == 'E')) {
            const diff = diffs.find(d => d.kind == 'E');
            let nodeId = diff.path[0];
            if (!prevNodeData[nodeId]) return // If prevData has node means that the node data has been edited

            const targetHandle = nodeId + PORT_TYPES.data + diff.path[1]
            if (Boolean(isConnected(targetHandle))) return // If its already connected skip modificate
            const type = nodes.find(n => n.id == nodeId)?.type

            let payload: any = { nodeId }

            let value
            let param
            let kind
            if (type == 'JsxElement' || type == 'JsxSelfClosingElement') {
                let isProp
                if (diff.path[2] == 'key') {
                    param = diff.rhs
                    let oldKey = diff.lhs
                    const propName = diff.path[1]
                    value = nodeData[nodeId][propName]?.value
                    isProp = true
                    payload = { ...payload, deleteKey: oldKey }
                } else {
                    param = getPropName(diff.path[1]); // Care with child- props
                    value = diff.rhs
                    if (value == undefined || !param || typeof (value) == 'object' || diff.path[2] == 'kind') return
                    isProp = !param.includes('child');
                    if (isProp) {
                        param = nodeData[nodeId]['prop-' + param]?.key ?? param
                        kind = nodeData[nodeId]['prop-' + param]?.kind
                    }
                }
                payload = {
                    ...payload,
                    param,
                    value,
                    isProp,
                    kind
                }
            }
            else {
                const jsxElementPort = findJsxElementByNodeId(nodeId, edges)
                if (jsxElementPort) {
                    param = jsxElementPort.split('-')[2]
                    nodeId = jsxElementPort.split('-')[0]
                    const nodeType = jsxElementPort.split('_')[0];
                    const value = findJsxElementDumpedPropValue(nodes, edges, nodeData, nodeId, nodeType, param)
                    payload = {
                        ...payload,
                        nodeId,
                        param,
                        value,
                        isProp: true
                    }
                }
            }
            actionPublisher('edit-data', payload)
        } else if (diffs.find(d => d.kind == 'N')) {
            const diff = diffs.find(d => d.kind == 'N');
            let nodeId = diff.path[0];
            if (!prevNodeData[nodeId]) return // If prevData has node means that the node data has been edited
            const nodeType = nodes.find(n => n.id == nodeId)?.type
            let param = diff.path[1]
            let payload;
            if (nodeType == 'JsxElement' || nodeType == 'JsxSelfClosingElement') {
                let val = diff.rhs
                if (typeof val == 'object') {
                    param = param.split("-")[0] + "-" + val.key;
                    val = val.value
                }
                param = getPropName(param); // Care with child- props
                const targetHandle = nodeId + PORT_TYPES.data + diff.path[1]
                if (Boolean(isConnected(targetHandle))) return // If its already connected skip modificate
                if (val == undefined || !param) return
                const isProp = !param.includes('child');
                payload = { nodeId, param, value: val, isProp }
            }
            else {
                const ancestorJsxElementPort = findJsxElementByNodeId(nodeId, edges)
                var index = ancestorJsxElementPort?.indexOf("-");
                if (index === -1 || !ancestorJsxElementPort) return
                const ancestorParam = ancestorJsxElementPort.slice(index + 1)
                let ancestorJsxId = ancestorJsxElementPort.split('-')[0]
                const ancestorNodeType = ancestorJsxElementPort.split('_')[0];
                const ancestorJsxNodeData = nodeData[ancestorJsxId]
                if (!ancestorJsxNodeData) return
                const modifiedPropName = ancestorJsxNodeData[ancestorParam]?.key
                const value = findJsxElementDumpedPropValue(nodes, edges, nodeData, ancestorJsxId, ancestorNodeType, modifiedPropName)
                payload = {
                    nodeId: ancestorJsxId,
                    param: modifiedPropName,
                    value,
                    isProp: true
                }
            }
            actionPublisher('add-data', payload)
        } else if (diffs.find(d => d.kind == 'D')) {
            const diff = diffs.find(d => d.kind == 'D')
            const nodeId = diff.path[0];
            const param = diff.lhs["key"];
            actionPublisher('delete-data', { nodeId, param })
        }
    }

    const dumpSelection = (selectedNodes) => {
        //TODO: First node can't be an "ObjectLiteralExpression"
        const firstNodeType = selectedNodes[0]?.type
        const prittifyError = ["ObjectLiteralExpression", "ArrowFunction", "CallExpression"].includes(firstNodeType) || selectedNodes.length <= 1
        if (!selectedNodes || !selectedNodes.length || prittifyError) {
            return sourceCode
        }
        //get start node
        const startNode = selectedNodes[0]
        if (!startNode) return sourceCode
        let start = NodeTypes[startNode.type]
        if (start.type) start = start.type
        const code = start.dump(startNode, nodes, edges, nodeData)
        return validateCode(code, mode)
    }

    const onAddSnippet = async (snippet, edg, nodeId = undefined) => {
        const { nodes: smNodes, nodeDataTable, edges: smEdges } = await readSourceFile(snippet?.code, true)
        const index = smEdges.findIndex(v => v.target.startsWith('SourceFile'))

        var newEdges = [...edges]
        var newNodes = [...nodes]
        var newNodesData = { ...nodeData }
        var nodesIdsToDelete = []

        if (nodeId) {
            const deleteRecursiveEdges = (currentNodeId) => {
                const edgesToDelete = newEdges.filter(e => e?.target == currentNodeId)
                nodesIdsToDelete.push(currentNodeId)

                if (edgesToDelete?.length) {
                    edgesToDelete.forEach(e => {
                        deleteRecursiveEdges(e.source)
                    })
                    newEdges = [...newEdges].filter(e => e?.target != currentNodeId)
                }

            }
            deleteRecursiveEdges(nodeId)

            nodesIdsToDelete.forEach(nodeId => {
                delete newNodesData[nodeId]
            })

            newNodes = newNodes.filter(n => !nodesIdsToDelete.includes(n.id))
        }

        smEdges[index] = {
            ...smEdges[index],
            target: edg.target,
            targetHandle: edg.targetHandle
        }
        setsAll({ ...nodeDataTable, ...nodeData }, [...smNodes, ...newNodes], [...smEdges, ...newEdges])
    }

    const setsAll = (data, nds, edgs) => {
        setNodesData(data)
        setPrevNodeData(deleteAdditionalKeys(data))
        setNodes(nds)
        setEdges(edgs)
        setInitialEdges(edgs) //save original edges before deleting unconnected edges. 
        setInitialNodes(nds)
    }

    const onGraphChanged = async () => {
        try {
            //restore components before dump
            const content = await onSaveNodes(true);
            if (content !== undefined) {
                onEdit(content, { nodesData: nodeData, nodes })
            } else {
                console.error('There was an error in the code, not emitting')
            }
        } catch (e) {
            // console.log("Error on change: ", e)
        }
    }

    const handleRelayout = async () => {
        // Prevent concurrent relayout calls
        if (isRelayoutingRef.current) return
        
        // v12: Use measured dimensions for detecting size changes
        const getNodeHeight = n => n.measured?.height ?? n.height
        const getNodeWidth = n => n.measured?.width ?? n.width
        
        // Only proceed if all nodes have been measured
        const allNodesMeasured = nodes && nodes.length && 
            nodes.filter(n => getNodeWidth(n) && getNodeHeight(n)).length == nodes.length
        
        if (!allNodesMeasured) {
            // Don't update prevReducedNodesRef when nodes aren't measured yet
            // This allows relayout to run once nodes are measured
            return
        }
        
        const reduceNodes = nds => nds.reduce((total, n) => total += n.id + " " + getNodeHeight(n) + ',', '')
        let currentReducedNodes = reduceNodes(nodes)

        if (prevReducedNodesRef.current != currentReducedNodes) {
            isRelayoutingRef.current = true
            try {
                await reLayout(currentLayout, nodes, edges, setNodes, setEdges, _getFirstNode, setNodesMetaData, nodeData)
            } finally {
                isRelayoutingRef.current = false
            }
            // v12: Save currentReducedNodes (with measured values)
            prevReducedNodesRef.current = currentReducedNodes
        }
    }

    const getDumpedFragment = (nodeId) => {
        if (!nodeId) return null
        const selectedNode = nodes.find(n => n.id === nodeId)
        const firstNodeType = selectedNode?.type
        let start = NodeTypes[firstNodeType]
        const startType = start?.type;
        if (!startType) return null
        const code = startType.dump(selectedNode, nodes, edges, nodeData);
        const prettierCode = validateCode(code, mode)
        return prettierCode;
    }

    const updateFragment = (codeFragment: string, nodeId: string) => {
        const edge = edges.find(e => e.source == nodeId)
        onAddSnippet({ code: codeFragment }, edge, nodeId)
    }

    const onNodeContextMenu = useCallback(
        (event, node) => {
            // Prevent native context menu from showing
            event.preventDefault();

            const pane = diagramRef.current?.getBoundingClientRect();
            const absoluteCY = event.clientY - pane.top
            const absoluteCX = event.clientX - pane.left

            const hasSpaceOnTop = absoluteCY > 450
            const hasSpaceFromBottom = (absoluteCY - 450) > 0
            const hasSpaceOnLeft = absoluteCX > 360
            const hasSpaceFromRight = (absoluteCY - 360) > 0

            setMenu({
                id: node.id,
                top: absoluteCY < pane.height - 450 ? absoluteCY : hasSpaceOnTop && !hasSpaceFromBottom && 20,
                left: absoluteCX < pane.width - 360 ? absoluteCX : hasSpaceOnLeft && !hasSpaceFromRight && 20,
                right: absoluteCX >= pane.width - 360 && hasSpaceFromRight && pane.width - absoluteCX,
                bottom: absoluteCY >= pane.height - 450 && hasSpaceFromBottom && pane.height - absoluteCY,
            });

        },
        [setMenu],
    );

    // Close the context menu if it's open whenever the window is clicked.
    const onPaneClick = useCallback(() => setMenu(null), [setMenu]);


    useEffect(() => {
        const edgesDiffs = getDiffs(removeSizes(initialEdges), removeSizes(edges))
        const nodesDiffs = getDiffs(removeSizes(initialNodes), removeSizes(nodes))

        if (nodesDiffs && nodesDiffs.length || edgesDiffs && edgesDiffs.length) {
            if (!showActionsBar) {
                onGraphChanged()
            }
            setHasChanges(true)
        } else {
            setHasChanges(false)
        }
        setSaveStatus(null)

        handleRelayout()
    }, [nodes, edges])

    useEffect(() => {
        setDataNotify(dataNotify)
    }, [dataNotify])

    useEffect(() => {
        if (data[flowId + '/play']?.ts) {
            onPlayNodes()
        }
    }, [data[flowId + '/play']])

    useEffect(() => {
        setCurrentPath(path)
    }, [path])

    if (enableCommunicationInterface) {
        const context = {
            edges,
            nodeData,
            nodes,
            setEdges,
            createNode,
            setNodeData,
            setNodes,
            setNodesData,
            deleteNodes,
            onSaveNodes,
            _customComponents,
            flowId,
            data
        }
        enableCommunicationInterface(context)
    }

    useEffect(() => {
        if (_customComponents.length != appendedCustomComponents.length) {
            appendCustomComponents(_customComponents)
        }
        setMetadata(metadata)
    }, [_customComponents.length])

    useEffect(() => {
        if (sourceCode !== undefined && sourceCode !== null) {
            reload()
        }
    }, [sourceCode])

    useEffect(() => {
        const diffableNodeData = deleteAdditionalKeys(nodeData)
        const diffs = getDiffs(prevNodeData, diffableNodeData)
        if (diffs?.length) {
            setHasChanges(true)
            onNodeDataChange()
            setPrevNodeData(diffableNodeData)
            if (nodes.length && !showActionsBar) {
                onGraphChanged()
            }
        }
    }, [nodeData])

    if (typeof window !== undefined) window['reLayout'] = () => {
        reLayout(currentLayout, nodes, edges, setNodes, setEdges, _getFirstNode, setNodesMetaData, nodeData)
    }

    return (
        <div ref={diagramRef} style={{ height: '100%', width: '100%' }}>
            {display ? <Diagram
                autoFitView={autoFitView}
                primaryColor={primaryColor}
                defaultSelected={defaultSelected}
                onViewPortChange={onViewPortChange}
                defaultViewPort={defaultViewPort}
                themeMode={themeMode}
                onSelectionChange={(nodes) => onSelectionChange(dumpSelection(nodes), nodes)}
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                zoomOnDoubleClick={zoomOnDoubleClick}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={(nodesToDelete) => actionPublisher('delete-node', nodesToDelete)}
                onConnect={onConnect}
                edgeTypes={edgeTypes}
                onInit={(instance) => {
                    flowRef.current = instance
                }}
                style={{ backgroundColor: bgColor }}
                nodePreview={nodePreview}
                onNodeInitializationStatusChange={(status) => {
                    if (status && rendered.current) {
                        reLayout(currentLayout, nodes, edges, setNodes, setEdges, _getFirstNode, setNodesMetaData, nodeData)
                    }
                }}
                componentsMenu={
                    menuState != 'closed' ?
                        <Menu
                            enabledNodes={getEnabledNodesForMode()}
                            onEditDiagram={async (nodes, edges, focusElement) => {
                                setNodes(nodes)
                                setEdges(edges)
                            }}
                            edges={edges}
                            diagramNodes={nodes}
                            setNodes={setNodes}
                            setEdges={setEdges}
                            setNodeData={setNodeData}
                            nodeData={nodeData}
                            onAddSnippet={onAddSnippet}
                            style={{
                                position: 'absolute',
                                top: '0px',
                                left: '0px'
                            }}
                            config={config?.menu}
                            hideBaseComponents={hideBaseComponents}
                            customComponents={_customComponents}
                            customSnippets={customSnippets}
                            onAddNode={(node, newEdge, initialData) => actionPublisher('add-node', { node, newEdge, initialData })}
                        /> : <></>
                }

                disableDots={disableDots}
                disableMiniMap={disableMiniMap}
                theme={theme}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
            >
                {children}
                {
                    showActionsBar ?
                        <Panel position="top-center">
                            <ActionsBar
                                onSave={onSaveNodes}
                                onReload={onReload ? onReloadNodes : null}
                                onShowCode={onShowCode ? onShowCode : null}
                                hasChanges={hasChanges}
                            />
                        </Panel>
                        : null
                }
                {(menu && nodeMenu) && <ContextMenu menuContent={nodeMenu} onClick={onPaneClick} {...menu}>
                    {React.createElement(nodeMenu, {
                        nodeId: menu.id,
                        dumpFragment: () => getDumpedFragment(menu?.id),
                        closeMenu: () => setMenu(false),
                        updateFragment: (code: string) => updateFragment(code, menu.id)
                    })}
                </ContextMenu>
                }
            </Diagram> : <></>}
        </div>

    );
}

// create a component that wraps the topics HOC
const FlowsWrapper = (props) => {
    const store = useMemo(useFlowsStore, []);

    return (
        <FlowStoreContext.Provider value={store}>
            <FlowsBase {...props} />
        </FlowStoreContext.Provider>
    );
}

export default (props) => {
    const FlowsWithTopics = withTopics(FlowsWrapper, { topics: [props.flowId + '/play', props.flowId + '/ui', 'savenodes'] })
    let extraProps = {}

    if (props.path) {
        if (props.path.endsWith('.json')) {
            extraProps["mode"] = 'json'
        } else if (props.path.endsWith('yml') || props.path.endsWith('yaml')) {
            // extraProps["mode"] = 'yaml'
        }
    }

    return <TopicsProvider>
        <FlowsWithTopics {...props} {...extraProps} />
    </TopicsProvider>
}

export const FlowConstructor = (flowId) => withTopics(FlowsWrapper, { topics: [flowId + '/play', flowId + '/ui', 'savenodes'] })