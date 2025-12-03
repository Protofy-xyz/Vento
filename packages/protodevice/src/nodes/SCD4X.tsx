import React from "react";
import { Node, Field, HandleOutput, NodeParams } from 'protoflow';
import { getColor } from ".";
// import { Position } from "@xyflow/react";


const SCD4X = ({node = {}, nodeData = {}, children, color}: any) => {
    const [name, setName] = React.useState(nodeData['param-1'])
    const nameErrorMsg = 'Reserved name'
    const intervalErrorMsg = 'Add units h/m/s/ms'
    const nodeParams: Field[] = [
        {
            label: 'Name', static: true, field: 'param-1', type: 'input', onBlur: () => { setName(nodeData['param-1']) },
            error: nodeData['param-1']?.value?.replace(/['"]+/g, '') == 'nfcreader' ? nameErrorMsg : null
        },
        {
            label: 'i2cBus', static: true, field: 'param-2', type: 'input',
        },
        {
            label: 'Update Interval', static: true, field: 'param-3', type: 'input',
            error: !/^\d+[hms]$/.test(nodeData['param-3']?.value) ? intervalErrorMsg : null
        }
    ]
    return (
        <Node node={node} isPreview={!node.id} title='SCD4X' color={color} id={node.id} skipCustom={true} >
            <NodeParams id={node.id} params={nodeParams} />
        </Node>
    )
}

export default{
  id: 'SCD4X',
  type: 'CallExpression',
  category: "sensors",
  keywords: ["co2", "temperature", "sensor", "humidity"],
  check: (node, nodeData) => node.type == "CallExpression" && nodeData.to?.startsWith('scd4x'),
  getComponent: (node, nodeData, children) => <SCD4X color={getColor('SCD4X')} node={node} nodeData={nodeData} children={children} />,
  getInitialData: () => { return { to: 'scd4x', "param-1": { value: "", kind: "StringLiteral" }, "param-2": { value: "", kind: "StringLiteral" }, "param-3": { value: "60s", kind: "StringLiteral" } } }
};

