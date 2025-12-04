import { Dispatch, SetStateAction, createContext, useContext } from 'react';
import {
    useReactFlow, Node, Edge, useNodesState,
    useEdgesState, EdgeChange, NodeChange,
    addEdge as addReactFlowEdge, Connection,
    useEdges,
    useNodes
} from '@xyflow/react';

type OnChange<ChangesType> = (changes: ChangesType[]) => void;

type DiagramState = {
    nodePreview: string,
    flowsHeight: number | undefined
}

export const DiagramContext = createContext<DiagramState>({
    nodePreview: '',
    flowsHeight: undefined
});

const getExtraData = () => {
    const { nodePreview, flowsHeight } = useContext(DiagramContext);

    const isViewModePreview = nodePreview === 'preview'
    const preview = isViewModePreview ? 'node' : 'default'

    return {
        preview,
        flowsHeight: flowsHeight
    }
}

const wrapDiagramItem = (payload, dataToAdd) => { // wrapper for diagram edges and nodes
    // v12: exclude internal frozen properties when cloning
    const clone = (e) => {
        const { measured, internals, width, height, ...rest } = e;
        return { 
            width: measured?.width ?? e.width,
            height: measured?.height ?? e.height,
            ...rest, 
            data: { ...e.data, ...dataToAdd } 
        };
    };
    
    if (typeof payload === 'function') {
        return ele => payload(ele.map(clone))
    }
    return payload.map(clone)
}

export const useProtoflow = () => {
    const {
        setNodes: reactFlowSetNodes,
        setEdges: reactFlowSetEdges,
        screenToFlowPosition,
        setViewport,
        getNodes,
        getViewport,
        setCenter,
        getEdges,
        deleteElements,
        fitView
    } = useReactFlow()

    const extraData = getExtraData()

    const setNodes: (payload: Node[] | ((nodes: Node[]) => Node[])) => void = (payload) => {
        reactFlowSetNodes(wrapDiagramItem(payload, extraData));
    };
    const setEdges: (payload: Edge[] | ((edges: Edge[]) => Edge[])) => void = (payload) => {
        reactFlowSetEdges(wrapDiagramItem(payload, extraData))
    }

    return {
        setNodes,
        project: screenToFlowPosition, // v12: project renamed to screenToFlowPosition
        setViewport,
        getNodes,
        getViewport,
        setCenter,
        setEdges,
        getEdges,
        deleteElements,
        fitView
    }
};

export const useProtoNodesState = (initialItems: Node[], extraData: DiagramState | {} = {}): [Node[], Dispatch<SetStateAction<Node[]>>, OnChange<NodeChange>] => {

    const [nodes, reactFlowSetNodes, onNodesChange] = useNodesState(wrapDiagramItem(initialItems, extraData))

    const setNodes: Dispatch<SetStateAction<Node[]>> = (payload: any) => reactFlowSetNodes(wrapDiagramItem(payload, extraData))

    return [nodes, setNodes, onNodesChange]
}

export const useProtoEdgesState = (initialItems: Edge[], extraData: DiagramState | {} = {}): [Edge[], Dispatch<SetStateAction<Edge[]>>, OnChange<EdgeChange>] => {

    const [edges, reactFlowSetEdges, onEdgesChange] = useEdgesState(wrapDiagramItem(initialItems, extraData))

    const setEdges: Dispatch<SetStateAction<Edge[]>> = (payload: any) => reactFlowSetEdges(wrapDiagramItem(payload, extraData))

    return [edges, setEdges, onEdgesChange]
}

export const useProtoEdges = (): Edge[] => {
    const nodes = useNodes()
    const edges = useEdges()

    return edges.filter(e => nodes.find(n => n.id === e.source) && nodes.find(n => n.id === e.target))
}

export const addProtoEdge = (edgeParams: Edge | Connection, edges: Edge[]) => {
    return addReactFlowEdge({ ...edgeParams, type: 'custom', animated: false }, edges)
}