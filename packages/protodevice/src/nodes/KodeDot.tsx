import { useContext } from "react";
import { PORT_TYPES, Node, FlowStoreContext } from 'protoflow';
import { Handle, Position, useEdges } from "@xyflow/react";
import { getColor } from ".";

const isHandleConnected = (edges, handleId) => edges.find(e => (e.targetHandle == handleId || e.sourceHandle == handleId))

const KodeDot = ({ node = {}, nodeData = {}, topics = {}, color }: any) => {
    const { id } = node
    const useFlowsStore = useContext(FlowStoreContext)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const offsetY = 131.1 //This value is for setting the initial point where the available pins start to draw
    const spacing = 26.6
    const edges = useEdges();
    const metadata = useFlowsStore(state => state.metadata)
    const ports = metadata.board.ports
    const boardImage = "/public/images/device/esp32s3-devkitc.png";
    const portsDescriptions = ports.map(port => {
        return {
            name: port.name,
            type: port.type,
            description: port.description,
            maxVoltage: port.maxVoltage,
            rtc: port.rtc
        }
    })

    const devicePositioning = Array(ports.length).fill(1).map((x, i) => {
        if (true) {
            return `${i + 2}-${i > ports.length/2-1 ? 'l' : 'r'}-${i}`
        }
    })
    if (!nodeData._devicePositioning) {
        setNodeData(node.id, { ...nodeData, _devicePositioning: devicePositioning })
    }
    return (
        <Node output={false} skipCustom={true} node={node} color={color} isPreview={!id} title='ESP32' id={id} margin='200px' >
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <img src={boardImage} style={{ width: "268px" }} />
            </div>
            {Array(ports.length).fill(1).map((x, i) => {
                if (["I", "O", "IO"].includes(ports[i].type)) {                    
                    const idString = `${id}${PORT_TYPES.data}element-${i + 2}`;//${i>14?'l':'r'}
                    return <Handle
                        key={i}
                        isConnectable={!isHandleConnected(edges, idString)}
                        isValidConnection={(c) => {
                            const sourceConnected = isHandleConnected(edges, c.sourceHandle)
                            return !sourceConnected
                        }}
                        type={"target"}
                        title={JSON.stringify(portsDescriptions[i], null, 2)}
                        style={{
                            position: 'absolute',
                            top: i > ports.length/2-1 ? (spacing * (i - ports.length/2)) + (offsetY) + 'px' : (spacing * i) + offsetY + 'px',
                            width: "15px",
                            height: "15px",
                            backgroundColor: isHandleConnected(edges, idString) ? "#BA68C8" : "white",
                            marginLeft: i > ports.length/2-1 ? '0px' : '11px',
                            marginRight: i > ports.length/2-1 ? '11px' : '0px',
                            border: isHandleConnected(edges, idString) ? "2px solid #BA68C8" : "2px solid white"
                        }}
                        position={i > ports.length/2-1 ? Position.Right : Position.Left}
                        id={idString}
                    />
                }
            })}
        </Node>
    );
}

export default {
    id: 'kodeDot',
    type: 'ArrayLiteralExpression',
    check: (node, nodeData) => node.type == "ArrayLiteralExpression" && nodeData['element-1'] == '"Kode dot"',
    getComponent: (node, nodeData, children) => <KodeDot color={getColor('kodeDot')} node={node} nodeData={nodeData} children={children} />,
    getInitialData: () => { return { to: '"kodeDot"' } },
    hidden: true,
    nonDeletable: true
}
