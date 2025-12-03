import React, { useCallback, useEffect, useState, useContext } from 'react';
import { Edge, Node } from '@xyflow/react';
import { FlowStoreContext } from '../store/FlowsStore'
import { useProtoflow } from '../store/DiagramStore';

type UseUndoRedoOptions = {
    maxHistorySize: number;
    enableShortcuts: boolean;
};

type UseUndoRedo = (options?: UseUndoRedoOptions) => {
    undo: () => void;
    redo: () => void;
    clearNodes: (mode) => void;
    takeSnapshot: (data?) => void;
    canUndo: boolean;
    canRedo: boolean;
};

type HistoryItem = {
    nodes: Node[];
    edges: Edge[];
    nodeData: Object;
};

const defaultOptions: UseUndoRedoOptions = {
    maxHistorySize: 100,
    enableShortcuts: false,
};

// https://redux.js.org/usage/implementing-undo-history
export const useUndoRedo: UseUndoRedo = ({
    maxHistorySize = defaultOptions.maxHistorySize,
    enableShortcuts = defaultOptions.enableShortcuts,
} = defaultOptions) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const nodeData = useFlowsStore(state => state.nodeData)
    const setNodesData = useFlowsStore(state => state.setNodesData)
    // the past and future arrays store the states that we can jump to
    const [past, setPast] = useState<HistoryItem[]>([]);
    const [future, setFuture] = useState<HistoryItem[]>([]);

    const { setNodes, setEdges, getNodes, getEdges, deleteElements } = useProtoflow();

    const takeSnapshot = useCallback((data) => {
        // push the current graph to the past state
        setPast((past) => [
            ...past.slice(past.length - maxHistorySize + 1, past.length),
            { nodes: getNodes(), edges: getEdges(), nodeData: data ? data : nodeData },
        ]);
        // whenever we take a new snapshot, the redo operations need to be cleared to avoid state mismatches
        setFuture([]);
    }, [getNodes, getEdges, maxHistorySize]);

    const clearNodes = async (mode: 'undo' | 'redo') => {
        var pastNodesData = past[past.length - 1]?.nodeData ?? {}
        var futureState = future[future.length - 1]?.nodeData ?? {}
        if (!Object.keys(pastNodesData).length && mode == 'undo') return
        if (!Object.keys(futureState).length && mode == 'redo') return
        return await setNodes([])
    }

    const undo = useCallback(() => {
        // get the last state that we want to go back to
        const pastState = past[past.length - 1];
        if (pastState) {
            // deleteElements({ nodes: pastState.nodes, edges: pastState.edges })
            // first we remove the state from the history
            setPast((past) => past.slice(0, past.length - 1));
            // we store the current graph for the redo operation
            setFuture((future) => [...future, { nodes: getNodes(), edges: getEdges(), nodeData: nodeData }]);
            // now we can set the graph to the past state
            setNodes(pastState.nodes);
            setEdges(pastState.edges);
            if (Object.keys(pastState.nodeData).length) {
                setNodesData(pastState.nodeData)
            }
        }
    }, [setNodes, setEdges, getNodes, getEdges, past, setNodesData]);

    const redo = useCallback(() => {
        const futureState = future[future.length - 1];

        if (futureState) {
            setFuture((future) => future.slice(0, future.length - 1));
            setPast((past) => [...past, { nodes: getNodes(), edges: getEdges(), nodeData: nodeData }]);
            setNodes(futureState.nodes);
            setEdges(futureState.edges);
            if (Object.keys(futureState.nodeData).length) {
                setNodesData(futureState.nodeData)
            }
        }
    }, [setNodes, setEdges, getNodes, getEdges, future, setNodesData]);

    // useEffect(() => {
    //     // this effect is used to attach the global event handlers
    //     if (!enableShortcuts) {
    //         return;
    //     }

    //     const keyDownHandler = (event: KeyboardEvent) => {
    //         if (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    //             redo();
    //         } else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
    //             undo();
    //         }
    //     };

    //     document.addEventListener('keydown', keyDownHandler);

    //     return () => {
    //         document.removeEventListener('keydown', keyDownHandler);
    //     };
    // }, [undo, redo, enableShortcuts]);

    return {
        undo,
        redo,
        takeSnapshot,
        canUndo: !past.length,
        canRedo: !future.length,
        clearNodes
    };
};

export default useUndoRedo;
