import React, { memo, useContext } from 'react';
import { connectItem, dumpConnection, PORT_TYPES, DumpType, getValueTrivia, getTrivia } from '../lib/Node';
import Node, { Field, isDataPortConnected } from '../Node';
import { FlowStoreContext } from "../store/FlowsStore";
import { Equal } from '@tamagui/lucide-icons';
import { useEdges } from '@xyflow/react';
import { useNodeColor } from '../diagram/Theme';

export const VariableDeclarationListNodeFactory = (declarationType) => {
    const component = (node) => {
        const { id, type } = node
        const color = useNodeColor(type)
        const useFlowsStore = useContext(FlowStoreContext)
        const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
        const nodeType = nodeData['type'] ?? declarationType
        const edges = useEdges();
        const declarations = Object.keys(nodeData).filter(key => key.startsWith('declarationName'))
        const declarationArr = declarations.length ? declarations : ['declarationName1']

        //@ts-ignore
        const nodeParams: Field[] = [
            { label: 'Type', field: 'type', type: 'select', data: ['let', 'const', 'var'], static: true }
        ].concat(
            //@ts-ignore
            declarationArr.reduce((params, param, i) => {
                params = params.concat({ label: 'Variable ' + (i > 0 ? `(${i + 1})` : ''), field: param, type: 'input', static: nodeType != 'const' } as Field)
                params = params.concat({ label: `Value ` + (i > 0 ? `(${i + 1})` : ''), field: `value${i + 1}`, fieldType: 'input' } as Field)
                return params
            }, []),
            { label: 'Export', field: 'export', type: 'boolean', static: true }
        )

        return (
            <Node icon={Equal} node={node} isPreview={!id} title={(nodeData?.export ? 'export ' : '') + (nodeType) + ' ' + declarationArr.map(d => nodeData[d]).join(',')} id={id} params={nodeParams} color={color} />
        );
    }
    component.category = "identifiers"
    component.keywords = ["const", "let", "var"]
    component.getData = (node, data, nodesData, edges) => {
        const type = node.getChildren()[0].getText(); // const, let, var
        const declarations = node.getDeclarations().reduce((total, dec, i) => {
            let val = dec.getInitializer()
            let name = dec.getName()
            let tsType = dec.getTypeNode()
            const children = dec.getChildren()
            let operatorTrivia = children.length > 2 ? getTrivia(children[1]) : ' '
            let valkey = `value${i + 1}`
            let namekey = `declarationName${i + 1}`
            let typeKey = `type${i+1}`
            let opTriviaKey = `opTrivia${i+1}`

            let declaration = { [namekey]: name, [opTriviaKey]: operatorTrivia }
            if (val) {
                declaration = {
                    ...declaration,
                    [valkey]: connectItem(val, 'output', node, valkey, data, nodesData, edges, valkey)
                }
            }
            if(tsType) {
                declaration = {
                    ...declaration,
                    [typeKey]: tsType.getText()
                }
            }
            return {
                ...total,
                ...declaration
            }
        }, {})
        return {
            type: type,
            ...declarations,
            export: node.getParent().getModifiers ? (node.getParent().getModifiers().find(m => m.getText() == 'export') ? true : false) : false
        }
    }

    const getTsType = (data) => {
        if(data) return ':'+data.trim()
        return ''
    }

    component.dump = (node, nodes, edges, nodesData, metadata = null, enableMarkers = false, dumpType: DumpType = "partial", level=0) => {
        const data = nodesData[node.id];
        var declarationsNames = Object.keys(data).filter(key => key.startsWith('declarationName'))
        if (!declarationsNames.length) return ''
        const declarations = declarationsNames.reduce((total, param, i) => {
            let valkey = `value${i + 1}`
            let typeKey = `type${i + 1}`
            let opTriviaKey = `opTrivia${i+1}`
            let value = dumpConnection(node, "target", valkey, PORT_TYPES.data, getValueTrivia(data, valkey), edges, nodes, nodesData, metadata, enableMarkers, dumpType, level)
            return total + 
                    data[param] + 
                    getTsType(data[typeKey]) + 
                    (value === '' || value === undefined || value == ' ' ? 
                        "" 
                        : (data[opTriviaKey] !== undefined ? data[opTriviaKey] : ' ') + '=' + value + '') + (declarationsNames.length == i + 1 ? '' : ', ')
        }, '')
        return (data.export ? 'export ' : '') + (data.type ?? declarationType) + ' ' + declarations
    }

    return component
}

const VariableDeclarationNode = VariableDeclarationListNodeFactory('const')
export default memo(VariableDeclarationNode)
