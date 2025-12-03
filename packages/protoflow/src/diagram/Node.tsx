import React, { memo, useContext, useRef } from 'react';
import Text from "./NodeText"
import { Handle, Position } from '@xyflow/react';
import chroma from "chroma-js";
import { FlowStoreContext } from '../store/FlowsStore'
import { DEVMODE, flowDirection } from '../toggles'
import { useProtoEdges } from '../store/DiagramStore';
import useTheme, { useNodeColor } from './Theme';
import { NodeTypes } from './../nodes';
import { write } from '../lib/memory';
import { generateBoxShadow } from '../lib/shadow';
import { useHover } from 'usehooks-ts'

const Node = ({
  adaptiveTitleSize = true,
  mode = 'column',
  draggable = true,
  icon = null,
  container = false,
  title = '',
  children,
  isPreview = false,
  id,
  color,
  node,
  headerContent = null,
  headerLeftContent = null,
  style = {},
  contentStyle = {}
}) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const errorData = useFlowsStore(state => state.errorData)
    const flexRef = useRef()
    const boxRef = useRef()
    const isNodePreviewMode = node?.data?.preview == 'node'
    const nodeStyle = contentStyle
    // const scale = chroma.scale([(chroma.scale([color, 'white']))(0.5).hex(), 'white']).mode('lab');

    const isError = id && id == errorData.id
    const isFloating = !id || id.indexOf('_') == -1
    const colorError = useTheme('colorError')
    color = color ?? useNodeColor(node.type)
    color = isError ? colorError : (!isPreview && isFloating ? (chroma.scale([color, 'white']))(0.5).hex() : color)
    const hColor = (chroma.scale([color, 'black']))(0.6).hex()
    const tColor = useTheme('titleColor')
    const themeBorderColor = useTheme('borderColor')
    const borderColor = isError ? colorError : themeBorderColor
    const borderWidth = useTheme('borderWidth')
    const themeBackgroundColor = useTheme('nodeBackgroundColor')
    const isHover = useHover(flexRef)
    const titleSize = useTheme('nodeFontSize') * 1.2
    const selectedColor = useTheme('selectedColor')
    const fontSize = useTheme('nodeFontSize')

    const innerRadius = '12px '
    const innerBorderRadius = (mode == 'column' ? innerRadius + innerRadius + ' 0px 0px' : innerRadius + '0px 0px ' + innerRadius)

    if (node && node.data && node.data.flowsHeight && isNodePreviewMode) {
        const maxHeight = node.data.flowsHeight - 20
        nodeStyle['height'] = maxHeight + 'px'
        nodeStyle['maxHeight'] = maxHeight + 'px'
        nodeStyle['overflow'] = 'scroll'
        nodeStyle['overflowX'] = 'hidden'
    }

    const getNodeShadow = () => {
        if (isNodePreviewMode || container) return 'none'
        else if (!isPreview && node?.selected) return 'none'
        else return generateBoxShadow(isHover ? 10 : 3)
      }

    return (
        <div
            id={id}
            ref={flexRef}
            style={{
                display: 'flex',
                minHeight: !isPreview ? '80px' : '30px',
                flexDirection: mode,
                borderRadius: 5,
                textAlign: 'center',
                fontSize: fontSize,
                boxShadow: getNodeShadow(),
                outline: !isPreview && node?.selected ? `1px solid ${selectedColor}` : 'none',
                outlineOffset: '0px',
                cursor: isNodePreviewMode ? 'default' : undefined,
                ...style,
            }}
            className={draggable ? '' : 'nodrag'}
            >
          {(title || headerContent || headerLeftContent) && !isNodePreviewMode ? (
            <div
                ref={boxRef}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: color,
                    borderRadius: isPreview ? '6px' : '5px 5px 0 0',
                    // borderBottom: mode === 'column' && !isPreview ? `${borderWidth} solid ${borderColor}` : '0px',
                    height: isPreview ? '30px':'24px',
                    padding: '0 12px',
                    gap: '6px',
                    position: 'relative',
                }}
            >
                {icon && flowDirection === 'LEFT' && (
                    <div style={{ display: 'flex' }}>
                    
                    {typeof icon !== "string" && React.createElement(icon, {
                        size: titleSize,
                        color: hColor,
                    })}

                    {typeof icon === "string" && <img src={"/public/icons/"+icon+".svg"} style={{ opacity: 0.7, width: titleSize, height: titleSize, color: hColor }} alt="icon" />}
            </div>)}
            {headerLeftContent}
            {title && (
                <Text
                style={{
                    fontSize: titleSize - 1,
                    color: tColor,
                    flex: 1,
                    textAlign: 'left',
                    fontFamily: 'Jost-Medium',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1',
                    paddingTop: '1px',
                }}
                >
                {title}
                </Text>
            )}
            {icon && flowDirection === 'RIGHT' && (
                <div style={{ display: 'flex' }}>
                {React.createElement(icon, {
                    size: titleSize,
                    color: hColor,
                })}
                </div>
            )}
            {headerContent}
            </div>

          ) : null}
      
          {!isPreview && (
            <div
              className={isNodePreviewMode ? 'nowheel' : ''}
              style={{
                borderRadius: '0 0 5px 5px',
                backgroundColor: container ? 'transparent' : themeBackgroundColor,
                flex: 1,
                paddingTop: '0.5ch',
                paddingBottom: '0.5ch',
                ...nodeStyle,
              }}
            >
              {children}
            </div>
          )}
        </div>
    ) 
}

export interface NodePortProps {
    type: "input" | "output" | "target" | "source",
    id: string,
    style?: any,
    handleId?: string,
    label?: string,
    sublabel?: string,
    isConnected?: boolean,
    nodeId?: string,
    position?: any,
    allowedTypes?: string[],
    portSize?: number,
    borderWidth?: string,
    borderColor?: string,
    color?: string
}

//{`${id}${PORT_TYPES.flow}${handleId ?? type}`}
export const NodePort = ({ id, color=undefined, borderWidth=undefined, borderColor=undefined, portSize=undefined, type, style, label, sublabel, isConnected = false, nodeId, position = Position.Right, allowedTypes }: NodePortProps) => {
    const textRef: any = useRef()
    const handleRef: any = useRef()
    const useFlowsStore = useContext(FlowStoreContext)
    const setMenu = useFlowsStore(state => state.setMenu)
    const instanceId = useFlowsStore(state => state.flowInstance)
    const labelWidth = 160
    const ml = position == Position.Right ? `-${labelWidth}px` : '25px'

    const edges = useProtoEdges();
    const connected = isHandleConnected(edges, id)

    const themePortSize = useTheme('portSize')
    portSize = portSize ?? themePortSize
    const plusColor = useTheme('plusColor')
    const themeBorderColor = useTheme('nodeBorderColor')
    const themeBorderWidth = useTheme('nodeBorderWidth')
    borderWidth = borderWidth ?? themeBorderWidth
    borderColor = borderColor ?? themeBorderColor
    const blockPortColor = useTheme('blockPort')
    const flowPortColor = useTheme('flowPort')
    const dataPorColor = useTheme('dataPort')
    const isNodePreviewMode = edges[0]?.data && edges[0]?.data['preview'] == 'node'
    const onOpenMenu = () => {
        setMenu("open", [handleRef?.current.getBoundingClientRect().right + 200, handleRef?.current.getBoundingClientRect().top - 30], {
            targetHandle: id,
            target: nodeId
        })
    }
    let backgroundColor = color ?? allowedTypes ? allowedTypes.includes("block") ? blockPortColor : flowPortColor : null
    if (allowedTypes.length == 1 && allowedTypes.includes("data")) backgroundColor = dataPorColor

    React.useEffect(() => {
        write(instanceId, id, allowedTypes)
    }, [allowedTypes])

    const marginRight = Math.floor(((portSize / 3.5) * -1))
    return (
        <>
            <Handle
                ref={handleRef}
                tabIndex={connected ? -1 : 0}
                title={DEVMODE ? id : undefined}
                onClick={() => onOpenMenu()}
                onKeyDown={(e) => e.code == 'Enter' ? onOpenMenu() : null}
                type={"target"}
                position={position}
                style={{
                    backgroundColor: backgroundColor,
                    display: isNodePreviewMode ? 'none' : 'flex', flexDirection: 'row',
                    alignItems: 'center',
                    border: borderWidth + " solid " + borderColor, 
                    width: portSize + "px", 
                    height: portSize + "px", 
                    marginLeft: position === Position.Right ? '-4px' : undefined,
                    marginRight: position === Position.Left ? '-4px' : undefined,
                    cursor: 'pointer', 
                    ...style
                }}
                id={id}
                isConnectable={!connected}
                isValidConnection={(c) => {
                    const sourceId = c.source.split('_')[0]
                    const flowNode = NodeTypes[sourceId]
                    if (flowNode) {
                        const flowNodeType = flowNode.type ?? flowNode
                        const dataOutput = flowNodeType && flowNodeType.dataOutput ? flowNodeType.dataOutput : 'data'
                        if (allowedTypes.indexOf(dataOutput) == -1) return false
                    }
                    const sourceConnected = isHandleConnected(edges, c.sourceHandle)
                    return !sourceConnected
                }}
            >
                {label || sublabel ? <div style={{ display: 'flex', width: `${labelWidth}px`, marginLeft: ml, zIndex: -1, justifyContent: 'flex-end' }}>
                    {sublabel && <Text style={{ opacity: 0.7, textAlign: position == Position.Right ? 'right' : 'left' }}>{sublabel}</Text>}
                    {label && <Text ref={textRef} style={{ marginRight: '5px', textAlign: position == Position.Right ? 'right' : 'left' }}>{label}</Text>}

                </div> : null}
            </Handle>
        </>
    )
}

export const isHandleConnected = (edges, handleId) => edges.find(e => (e.targetHandle == handleId || e.sourceHandle == handleId))
export const isNodeConnected = (edges, nodeId) => edges.find(e => (e.target == nodeId || e.source == nodeId))

export default memo(Node)