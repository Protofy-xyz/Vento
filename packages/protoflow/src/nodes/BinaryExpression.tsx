import React, { memo, useContext } from 'react';
import { connectItem, dumpConnection, getId, PORT_TYPES, DumpType, getTrivia, getValueTrivia } from '../lib/Node';
import Node, { Field, isDataPortConnected } from '../Node';
import { FlowStoreContext } from "../store/FlowsStore";
import { useEdges } from '@xyflow/react';
import { Calculator, Equal } from '@tamagui/lucide-icons';
import { useNodeColor } from '../diagram/Theme';

export const BinaryExpressionFactory = (_operator: string) => {
    const getFielNameLeft = (operator) => operator == '=' ? 'setLeft' : 'left'
    const BinaryExpression = (node) => {
        const { id, type } = node
        const color = useNodeColor(type)
        const operatorModeTable = {
            '+': 'operator',
            '-': 'operator',
            '*': 'operator',
            '/': 'operator',
            '%': 'operator',
            '<=': 'operator',
            '==': 'operator',
            '===': 'operator',
            '!=': 'operator',
            '!==': 'operator',
            '>=': 'operator',
            '||': 'operator',
            '&&': 'operator',
            '|': 'operator',
            '&': 'operator',
            '>': 'operator',
            '<': 'operator',
            '**': 'operator',
            '**=': 'operator',
            '-=': 'operator',
            '+=': 'operator',
            '/=': 'operator',
            '*=': 'operator',
            '=': 'set',
            '.': 'property',
            'instanceof': 'operator',
            '??': 'operator'
        }
        const modeLabelTable = {
            'operator': 'Value',
            'set': 'Value',
            'property': 'Property'
        }
        const useFlowsStore = useContext(FlowStoreContext)
        const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
        const edges = useEdges();
        
        const mode = operatorModeTable[nodeData.operator ?? _operator]
        const operator = nodeData.operator ?? _operator

        const nodeParams: Field[] = [
            { label: mode == 'operator' ? 'Value' : 'Variable', field: getFielNameLeft(operator), type: 'input', fieldType: nodeData.leftType },
        ]

        if (mode == 'operator') {
            nodeParams.push({ field: 'operator', type: 'select', data: ['+', '-', '*', '/', '>', '<', '<=', '==', '!=', '===', '!==', '>=', '||', '&&', '|', '&', 'instanceof', ''], static: true })
        }
        nodeParams.push({ label: modeLabelTable[mode], field: 'right', type: 'input', fieldType: nodeData.rightType })
        return (
            <Node 
                icon={(mode == 'operator')?Calculator:Equal} 
                node={node} 
                isPreview={!id} 
                title={mode == 'operator'?(!isDataPortConnected(id, getFielNameLeft(operator), edges) && nodeData[getFielNameLeft(operator)]?nodeData[getFielNameLeft(operator)]:'...')+(nodeData.operator ? ' ' + nodeData.operator + ' ': ' + ')+(!isDataPortConnected(id, 'right', edges) && nodeData.right?nodeData.right:'...'):mode} 
                id={id} 
                params={nodeParams} 
                color={color} 
            />
        );
    }
    BinaryExpression.keywords = ['+', '-', '*', '/', '>', '<', '<=', '==', '!=', '===', '!==', '>=', '||', '&&', '|', '&', 'set', 'operator', 'set', 'property', 'instanceof']
    BinaryExpression.category = 'operators'
    BinaryExpression.defaultHandle = PORT_TYPES.data + getFielNameLeft(_operator)
    BinaryExpression.getData = (node, data, nodesData, edges) => {
        const operator = node.getOperatorToken().getText()
        return {
            operator: operator,
            [getFielNameLeft(operator)]: connectItem(node.getLeft(), 'output', node, getFielNameLeft(operator), data, nodesData, edges, getFielNameLeft(operator)),
            right: connectItem(node.getRight(), 'output', node, 'right', data, nodesData, edges, 'right'),
            leftType: node.getLeft().getKindName(),
            rightType: node.getRight().getKindName(),
            operatorTrivia: getTrivia(node.getOperatorToken())
        }
    }

    BinaryExpression.dump = (node, nodes, edges, nodesData, metadata = null, enableMarkers = false, dumpType: DumpType = "partial", level=0) => {
        const data = nodesData[node.id];
        const operator = data.operator??_operator
        let left = dumpConnection(node, "target", getFielNameLeft(operator), PORT_TYPES.data, data[getFielNameLeft(operator)], edges, nodes, nodesData, metadata, enableMarkers, dumpType, level, {}, true)
        let right = dumpConnection(node, "target", "right", PORT_TYPES.data, getValueTrivia(data, 'right'), edges, nodes, nodesData, metadata, enableMarkers, dumpType, level)
        return left  + (data.operatorTrivia !== undefined && dumpType == 'full'? data.operatorTrivia: '') + (operator) + right  + dumpConnection(node, "source", "output", PORT_TYPES.flow, '', edges, nodes, nodesData, metadata, enableMarkers, dumpType, level)
    }
    return BinaryExpression
}


export default memo(BinaryExpressionFactory('+'))