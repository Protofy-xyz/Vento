import { useContext } from "react";
import { PORT_TYPES, Node, FlowStoreContext } from 'protoflow';
import { Handle, Position, useEdges } from "@xyflow/react";
import { getColor } from ".";

const isHandleConnected = (edges, handleId) => edges.find(e => (e.targetHandle == handleId || e.sourceHandle == handleId))

const Seeed_xiao_esp32s3 = ({ node = {}, nodeData = {}, topics = {}, color }: any) => {
    const { id, type } = node
    const useFlowsStore = useContext(FlowStoreContext)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const offsetY = 81 //This value is for setting the initial point where the available pins start to draw
    const spacing = 30.4
    const edges = useEdges();
    const metadata = useFlowsStore(state => state.metadata)
    const ports = metadata.board.ports
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
        <Node output={false} skipCustom={true} node={node} color={color} isPreview={!id} title='XIAO ESP32S3' id={id} margin='200px' >
            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <img src={"/public/images/device/seeed_xiao_esp32s3.png"} style={{ width: "100%" }} />
            </div>
            {/* //TODO Get ports from device definition */}
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
                        //get name, type, description, maxVoltage, rtc from port
                        title={JSON.stringify(portsDescriptions[i], null, 2)}
                        style={{
                            position: 'absolute',
                            top: i > ports.length/2-1 ? (spacing * (i - ports.length/2)) + (offsetY) + 'px' : (spacing * i) + offsetY + 'px',
                            width: "17px",
                            height: "17px",
                            backgroundColor: isHandleConnected(edges, idString) ? "#BA68C8" : "white",
                            marginLeft: i > ports.length/2-1 ? '0px' : '15px',
                            marginRight: i > ports.length/2-1 ? '15px' : '0px',
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
    id: 'seeed_xiao_esp32s3',
    type: 'ArrayLiteralExpression',
    check: (node, nodeData) => node.type == "ArrayLiteralExpression" && nodeData['element-1'] == '"Seeed Studio XIAO ESP32S3"',
    getComponent: (node, nodeData, children) => <Seeed_xiao_esp32s3 color={getColor('seeed_xiao_esp32s3')} node={node} nodeData={nodeData} children={children} />,
    getInitialData: () => { return { to: '"seeed_xiao_esp32s3"' } },
    hidden: true,
    nonDeletable: true
}
