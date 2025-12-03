import React from "react";
import { Node, Field, HandleOutput, NodeParams } from 'protoflow';
import { getColor } from ".";
// import { Position } from "@xyflow/react";


const NFCReader = ({node = {}, nodeData = {}, children, color}: any) => {
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
            label: 'updateInterval', static: true, field: 'param-3', type: 'input',
        },]
    return (
        <Node node={node} isPreview={!node.id} title='NFCReader' color={color} id={node.id} skipCustom={true} >
            <NodeParams id={node.id} params={nodeParams} />
        </Node>
    )
}

export default{
  id: 'NFCReader',
  type: 'CallExpression',
  category: "sensors",
  keywords: ["nfc", "nfcreader", "reader", "pn532"],
  check: (node, nodeData) => node.type == "CallExpression" && nodeData.to?.startsWith('nfcreader'),
  getComponent: (node, nodeData, children) => <NFCReader color={getColor('NFCReader')} node={node} nodeData={nodeData} children={children} />,
  getInitialData: () => { return { to: 'nfcreader', "param-1": { value: "", kind: "StringLiteral" }, "param-2": { value: "", kind: "StringLiteral" }, "param-3": { value: "1s", kind: "StringLiteral" } } }
};



// import { useDeviceStore } from "../../../store/DeviceStore";
// import { useAppStore } from "../../../../../context/appStore";
// import { HStack, Text, Icon } from "native-base";
// import { MaterialCommunityIcons } from '@expo/vector-icons';

// const NFCReader = (node:any={}, nodeData={}, children) => {
    
//     const nodeParams: Field[] = [
//         { label: 'Name', static: true, field: 'param-1', type: 'input', post: (str) => str.toLowerCase()},
//         { label: 'SclPin', static: true, field: 'param-2', type: 'input'}
//     ] as Field[]
//     const nodeOutput: Field = {label: 'Input (sda)', field: 'value', type: 'output' }
//     const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME
//     const currentDevice = useDeviceStore(state => state.electronicDevice);
//     const mqttTopic = `${projectName}/${currentDevice}/pn532_i2c/${nodeData['param-1']?.replace(/['"]+/g, '')}/state`
//     const addChannel = useAppStore(state => state.addChannel)
//     const lastMessages = useAppStore(state => state.lastMessagesByTopic[mqttTopic]) ?? []
//     addChannel(mqttTopic);
//     const [detected, setDetected] = React.useState();
//     const detectedRef = React.useRef('');
//     const timerFunction = ()=>{
//         if(detectedRef.current){
//             if(detectedRef.current.includes("removed")){
//                 setDetected('');
//             }
//         }
//     }
    
//     React.useEffect(() => {
//         detectedRef.current = detected;
//       }, [detected]);

//     React.useEffect(() => {
//         const message = lastMessages.map(m => m.message).reverse()[0]
//         var id;
//         if(message){
//             if(message.includes("not:")){
//                 setDetected("removed: "+message.split("not:")[1]);
//                 id = setTimeout(timerFunction,2000);
//             }else{
//                 setDetected(message)
//             }
//         }
//         return () => clearTimeout(id)
//     }, [lastMessages])
//     return (
//         <Node node={node} isPreview={!node.id} title='NFCReader' color="#F06292" id={node.id} skipCustom={true} disableInput disableOutput>
//             <NodeParams id={node.id} params={nodeParams} />
//             <HandleOutput position={Position.Right} id={node.id} param={nodeOutput} />
//             <HStack mt="20px" mb="5px" alignItems={'center'}>
//                 <Text ml={4} textAlign={"left"} color="warmGray.300">TagId detected: </Text>
//                 <Icon as={MaterialCommunityIcons} color={!detected ? 'error.600' : 'green.600'} name={'circle-medium'} />
//             </HStack>
//             <HStack mt="5px" mb="10px" alignItems={'center'}>
//                 <Text ml={4} textAlign={"left"} color={!detected || detected == 'none' ? "warmGray.300" : 'blue.600'}>{detected}</Text>
//             </HStack>
//         </Node>
//     )
// }

