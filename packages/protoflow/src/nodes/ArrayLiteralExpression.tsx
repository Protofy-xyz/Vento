import React, { memo, useContext } from 'react';
import { connectItem, dumpConnection, PORT_TYPES, DumpType, getTrivia } from '../lib/Node';
import AddPropButton from '../AddPropButton';
import Node, { Field, NodeParams } from '../Node';
import { FlowStoreContext } from "../store/FlowsStore";
import { SquareStack } from '@tamagui/lucide-icons';
import { useNodeColor } from '../diagram/Theme';

const ArrayLiteralExpression = (node) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const { id, type } = node
    const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const params = Object.keys(nodeData).filter(key => key.startsWith('element-'))
    const paramLength = params.length
    const color = useNodeColor(type)

    const nodeParams: Field[] = params.map((param, i) => {
        return { label: '[' + i + ']', field: param, type: 'input', deleteable: true } as Field
    })

    if (id) {
        React.useEffect(() => {
            const keyNameArr = Object.keys(nodeData).filter(d => d.startsWith('element'))
            if (keyNameArr.length) return
            if (!nodeData.error) {
                setNodeData(id, { ...nodeData, [`element-1`]: '' })
            }
        }, [])
    }

    return (
        <Node icon={SquareStack} node={{ ...node, data: { ...node.data, width: 1 } }} isPreview={!id} title={'array' + (paramLength ? ' ['+paramLength+']':'')} id={id} color={color} >
            <NodeParams id={id} params={nodeParams} />
            <AddPropButton id={id} nodeData={nodeData} type={"Element"} />
        </Node>
    );
}
ArrayLiteralExpression.keywords = ['Array', 'data', 'structure', 'list', 'collection', 'vector', 'dictionary']
ArrayLiteralExpression.category = "data structures"
ArrayLiteralExpression.defaultHandle = PORT_TYPES.data + 'element-1'
ArrayLiteralExpression.getData = (node, data, nodesData, edges) => {
    const elements = node.getElements();
    // Generate default values for clauses
    const error = node.getFlags() // 0 no error, !0 error
    return elements.reduce((obj, ele, i) => {
        const key = `element-${i}`
        const triviaKey = `trivia-element-${i}`
        return {
            ...obj,
            [key]: connectItem(ele, 'output', node, key, data, nodesData, edges, key),
            [triviaKey]: getTrivia(ele)
        }
    }, { error })
}

function getTriviaBeforeCloseBracket(arrayNode, dumpType: DumpType) {
    if (!arrayNode || dumpType == 'partial') return ''
    const fullText = arrayNode.getSourceFile().getFullText();
    const lastChild = arrayNode.getLastChild();

    if (lastChild && lastChild.getKindName() === 'CloseBracketToken') {
        const leadingTriviaWidth = lastChild.getLeadingTriviaWidth();
        const triviaBeforeCloseBrace = fullText.substring(lastChild.getPos(), lastChild.getPos() + leadingTriviaWidth);

        return triviaBeforeCloseBrace;
    }
    return '';
}

ArrayLiteralExpression.dump = (node, nodes, edges, nodesData, metadata = null, enableMarkers = false, dumpType: DumpType = "partial", level = 0) => {
    const data = nodesData[node.id] ?? {};
    const elements = Object.keys(data).filter(key => key.startsWith('element-')).map((element) => {
        return (data['trivia-' + element] !== undefined && dumpType == 'full' ? data['trivia-' + element] : '') + dumpConnection(node, "target", element, PORT_TYPES.data, data[element] ?? "", edges, nodes, nodesData, metadata, enableMarkers, dumpType, level)
    })
    return '[' + elements.join(',') + getTriviaBeforeCloseBracket(data._astNode, dumpType) + ']' + dumpConnection(node, "source", "output", PORT_TYPES.flow, '', edges, nodes, nodesData, metadata, enableMarkers, dumpType, level)
}

ArrayLiteralExpression.getSize = (nodes, node, data) => {
    const paramLength = Object.keys(data).filter(key => key.startsWith('element-')).length
    // v12: nodes are immutable, return new array with cloned node
    return [{ ...nodes[0], height: 140 + paramLength * 49 }, ...nodes.slice(1)];
}

export default memo(ArrayLiteralExpression)