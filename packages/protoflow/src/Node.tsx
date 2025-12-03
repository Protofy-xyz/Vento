import React, { useContext, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import Input from './diagram/NodeInput'
import Text from './diagram/NodeText'
import { } from './nodes'; //error when removed
import { PORT_TYPES } from './lib/Node';
import getCustomComponent from './nodes/custom';
import Select, { components } from 'react-select';
import DiagramNode, { NodePort, NodePortProps, isHandleConnected, isNodeConnected } from './diagram/Node'
import { withTopics } from "react-topics";
import { FlowStoreContext } from "./store/FlowsStore";
import { DEVMODE, flowDirection } from './toggles';
import { SketchPicker } from "react-color";
import useTheme, { usePrimaryColor } from './diagram/Theme';
import { DataOutput } from './lib/types';
import { read } from './lib/memory';
import NodeSelect from './diagram/NodeSelect';
import { X, ChevronUp, AlertCircle } from '@tamagui/lucide-icons';
import { useProtoflow, useProtoEdges } from './store/DiagramStore';
import { getFieldValue, getDataFromField } from './utils';
import { getKindIcon, getNextKind, getTypeByKind } from './utils/typesAndKinds';

export interface Field {
    field: string,
    type: 'input' | 'output' | 'select' | 'error' | 'boolean' | 'range' | 'color' | 'colorPicker',
    description?: string,
    label?: string,
    staticLabel?: boolean,
    data?: any
    static?: boolean,
    fieldType?: string | 'parameter' | 'child' | 'prop' | 'clause',
    additionalHandlePort?: string,
    deleteable?: boolean,
    pre?: any,
    post?: any,
    keyPre?: any,
    keyPost?: any,
    error?: string,
    isDisabled?: boolean,
    onBlur?: Function,
    lowercase?: boolean,
    separator?: string | ':' | '='
}


export const isDataPortConnected = (id, port, edges) => edges.find(e => e.targetHandle == `${id}${PORT_TYPES.data}${port}`)

export const headerSize = 55;

export const DeleteButton = ({ id, left = false, field, onDelete, size = 20, color = "#EF4444" }) => {
    return <div id={'deleteButton-' + id + field} style={{ display: 'flex', alignSelf: 'center', cursor: 'pointer' }} onClick={onDelete}>
        {/* @ts-ignore */}
        <X size={size} color={color} style={{ marginRight: left ? '7px' : '2px', marginLeft: '7px' }} />
    </div>
}


export const NodeInput = ({ placeholder="default", id, disabled, post = (t) => t, pre = (t) => t, onBlur, field, children, style = {}, editing = false, options = [] }: any) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const { setNodes } = useProtoflow()
    const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
    const notify = useFlowsStore(state => state.dataNotify)
    var initialInputValue = pre(nodeData[field]);
    const [tmpInputValue, setTmpInputValue] = React.useState(initialInputValue)
    const nodeFontSize = useTheme('nodeFontSize')
    const ref = React.useRef();
    React.useEffect(() => {
        // console.log('editing: ', editing,)
        if (ref.current && editing) {
            //@ts-ignore
            ref.current?.focus()
        }
    }, [editing])

    const dataNotify = (data) => {
        notify({ ...data, notifyId: nodeData._dataNotifyId })
    }

    useEffect(() => {
        setTmpInputValue(initialInputValue)
    }, [nodeData[field]])

    const selecNodeOnFocus = () => {
        setNodes(nds => {
            return nds.map(n => ({ ...n, selected: n.id === id }));
        })
    }

    const _onBlur = () => {
        if (!disabled) {
            const val = post(tmpInputValue)
            setNodeData(id, { ...nodeData, [field]: val })
            dataNotify({ id: id, paramField: field, newValue: tmpInputValue })
        }
        if (onBlur) onBlur(tmpInputValue);
    }

    return (<div className={'nodrag'} style={{ flex: 1 }}>
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }} >
            <Input
                ref={ref}
                onFocus={selecNodeOnFocus}
                onBlur={_onBlur}
                readOnly={disabled}
                style={{
                    fontSize: nodeFontSize + 'px',
                    height: '20px',
                    padding: '2px 6px',
                    lineHeight: '1.2',
                    borderRadius: '4px',
                    ...style
                }}
                value={tmpInputValue}
                placeholder={placeholder}
                onChange={t => setTmpInputValue(t.target.value)}
                options={options}
            />
            {children}
        </div>
    </div>)
}

const HandleField = ({ id, param, index = 0, portId = null, editing = false, onRequestEdit = (param) => { }, onCancelEdit = () => { }, placeholder=undefined }) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const setNodeData = useFlowsStore(state => state.setNodeData)
    const notify = useFlowsStore(state => state.dataNotify)
    const deletePropNodeData = useFlowsStore(state => state.deletePropNodeData)
    const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
    const edges = useProtoEdges();
    const isConnected = edges.find(e => e.targetHandle == `${id}${PORT_TYPES.data}${param.field}`)
    const isDeletedLeft = param.fieldType == 'child'
    const isParameter = param.fieldType == 'parameter'
    const isProp = param.fieldType == 'prop'

    const checkRef: any = React.useRef()
    const textBoxRef: any = React.useRef()

    const pre = param.pre ? param.pre : (str) => str
    const post = param.post ? param.post : (str) => str
    const keyPre = param.keyPre ? param.keyPre : (str) => str
    const keyPost = param.keyPost ? param.keyPost : (str) => str

    const inputBorderMulti = useTheme("inputBorder");
    const textColorMulti = useTheme("textColor")
    const inputBg = useTheme("inputBackgroundColor")
    const interactiveColor = useTheme('interactiveColor')
    const nodeFontSize = useTheme('nodeFontSize')

    const dataNotify = (data) => {
        notify({ ...data, notifyId: nodeData._dataNotifyId })
    }

    //color
    const [colorPickerVisible, setColorPickerVisible] = React.useState(false);
    //end of color

    //boolean
    const stringToBolean = (myVar) => {
        if (typeof myVar === 'string' || myVar instanceof String)
            return myVar == "true" ? true : false;
        else
            return myVar;
    }

    const [checked, setChecked] = React.useState(stringToBolean(getFieldValue(param.field, nodeData)));
    //end of boolean

    //range
    const min = param.data?.min != undefined ? param.data.min : 0
    const defaultValue = param.data?.defaultValue
    const initialRangeValue = nodeData[param.field]?.value ?? nodeData[param.field] ?? (defaultValue ?? min)
    const [tmpRangeValue, setTmpRangeValue] = React.useState(pre(initialRangeValue));
    // end of range

    const getInput = (disabled?) => {
        switch (param.type) {
            case 'select':
                const onChangeSelect = (data) => {
                    setNodeData(id, { ...nodeData, [param.field]: getDataFromField(data?.value, param.field, nodeData) })
                    dataNotify({ id: id, paramField: param.field, newValue: data?.value })
                }
                const options = param.data?.map((item, index) => {
                    var extraProps = item?.color ? { color: item.color } : {}
                    return { label: item.label ?? item ?? "default", value: item.value ?? item, ...extraProps }
                })

                return <div style={{ flex: 1, zIndex: 1000 }}>
                    <NodeSelect
                        value={getFieldValue(param.field, nodeData)}
                        onChange={onChangeSelect}
                        defaultValue={{
                            value: getFieldValue(param.field, nodeData),
                            label: getFieldValue(param.field, nodeData)
                        }}
                        options={options} />
                </div>
            case 'select-multi':
                const onChangeSelectMulti = (data) => {
                    const dataValues = data.map(obj => obj.value.replace(/"/g, ''));
                    setNodeData(id, { ...nodeData, dataValues })
                    dataNotify({ id: id, paramField: param.field, newValue: dataValues })
                }

                const colourStylesMulti = {
                    control: (styles, state) => ({
                        ...styles,
                        backgroundColor: inputBg,
                        borderColor: state.isSelected ? inputBorderMulti : "transparent",
                        textColor: textColorMulti,
                        width: 'fit-content'
                    }),
                    singleValue: (styles, { data }) => {
                        return ({
                            ...styles, fontSize: '12px', minWidth: '95px', textAlign: 'left', color: textColorMulti
                        })
                    },
                    menu: (styles) => {
                        return {
                            ...styles, color: textColorMulti,
                            backgroundColor: inputBg,
                        }
                    },
                };
                const optionsMulti = param.data?.map((item, index) => {
                    var extraProps = item.color ? { color: item.color } : {}
                    return { label: item, value: item, ...extraProps }
                })
                const DropdownIndicatorMulti = props => {
                    return (
                        components.DropdownIndicator && (
                            <components.DropdownIndicator {...props}> <ChevronUp size={'15px'} /> </components.DropdownIndicator>
                        )
                    );
                };
                return <div style={{ zIndex: 1000 }}>
                    <Select
                        //@ts-ignore
                        components={{ DropdownIndicatorMulti }}
                        menuPlacement="top"
                        onChange={onChangeSelectMulti}
                        className={'nodrag'} options={optionsMulti} styles={colourStylesMulti}
                        isMulti={true} />
                </div>

            case 'colorPicker':
                const initColor = nodeData[param.field] ? pre(nodeData[param.field]) : "#404040"

                return (<div style={{ cursor: "pointer" }}>
                    <div style={{ width: "22px", height: "22px", backgroundColor: initColor.value, border: colorPickerVisible ? borderWidth + " solid " + borderColor : "1px #cccccc solid", borderRadius: 5 }} onClick={() => { setColorPickerVisible(!colorPickerVisible) }}></div>
                    <div style={{ cursor: "pointer", position: "absolute", zIndex: 1100 }}>
                        {colorPickerVisible
                            ? <SketchPicker
                                className="nodrag"
                                color={initColor.value}
                                onChangeComplete={(newColor) => {
                                    dataNotify({ id: id, paramField: param.field, newValue: { r: newColor.rgb.r, g: newColor.rgb.g, b: newColor.rgb.b, a: newColor.rgb.a } })
                                    setNodeData(id, { ...nodeData, [param.field]: getDataFromField(newColor.hex, param.field, nodeData) })
                                }}
                            />
                            : null
                        }
                    </div>
                </div>)
            case 'range':
                const max = param.data?.max != undefined ? param.data.max : 100
                const step = param.data?.step != undefined ? param.data?.step : 1

                return <>
                    {!param.hideLabel ? <div style={{ fontSize: '14px', position: 'relative', top: '3px', width: max.toString().length * 18, textAlign: 'left' }}>{post(tmpRangeValue)}</div> : null}
                    <input type="range" style={{ width: '100%', marginTop: '6px', accentColor: interactiveColor, height: '5px', borderWidth: '4px solid blue', backgroundColor: inputBg, borderRadius: '10px' }}
                        step={step}
                        onChange={(event: any) => setTmpRangeValue(event.target.value)}
                        onMouseUp={() => {
                            dataNotify({ id: id, paramField: param.field, newValue: tmpRangeValue });
                            setNodeData(id, { ...nodeData, [param.field]: getDataFromField(post(tmpRangeValue), param.field, nodeData) })
                        }}
                        value={tmpRangeValue} min={min} max={max} />
                </>
            case 'boolean':
                return <span ref={checkRef}>
                    <input
                        type='checkbox'
                        onChange={() => {
                            dataNotify({ id: id, paramField: param.field, newValue: !checked });
                            setNodeData(id, {
                                ...nodeData,
                                [param.field]: getDataFromField(!checked, param.field, nodeData, {}, 'FalseKeyword')
                            });
                            setChecked(!checked);
                        }}
                        checked={!!checked}
                        style={{
                            all: 'revert',
                            accentColor: interactiveColor,
                            transform: `scale(${nodeFontSize / 15})`,
                            margin: 0,
                            verticalAlign: 'middle',
                            position: 'relative',
                            top: '-1px',
                        }}
                    />
                </span>
            default:
                const fieldKind = nodeData[param.field]?.kind
                return <>
                    {getTypeByKind(fieldKind)
                        ? <div
                            style={{ padding: '8px', justifyContent: 'center', position: 'absolute', zIndex: 100, cursor: 'pointer' }}
                            onClick={() => {
                                setNodeData(id, {
                                    ...nodeData, [param.field]: {
                                        ...nodeData[param.field],
                                        // TODO: Changes kind names from helper instead of icon list
                                        kind: getNextKind(fieldKind)
                                    }
                                })
                            }}
                        >
                            {React.createElement(getKindIcon(fieldKind), { size: 16, color: interactiveColor })}
                        </div>
                        : <></>}
                    <NodeInput
                        id={id}
                        post={(v) => getDataFromField(post(v), param.field, nodeData)}
                        pre={(v) => pre(v?.value ?? v ?? '')}
                        placeHolder={placeholder}
                        options={param.data?.options}
                        placeholder={param.placeholder ?? ''}
                        field={param.field}
                        onBlur={param.onBlur}
                        disabled={disabled || param.isDisabled}
                        style={{
                            marginRight: ["case", "child"].includes(param.fieldType) ? "20px" : "0px",
                            paddingLeft: getTypeByKind(fieldKind) ? "30px" : undefined
                        }}>
                        {param.error ? <div style={{ alignItems: 'center', marginTop: '5px', display: 'flex' }}>
                            {/* @ts-ignore */}
                            <AlertCircle size={"14px"} color='red' style={{ alignSelf: 'center', marginRight: '5px' }} />
                            <Text style={{ color: 'red', fontSize: '12px' }}>
                                {param.error}
                            </Text> </div> : null}
                    </NodeInput>
                </>
        }
    }
    const getValue = () => {
        let label = param?.label ?? param.field
        if ((isParameter || isProp) && !param.static && !param.staticLabel) {
            label = keyPre(nodeData[param.field]?.key ?? '')

            if (editing) {
                return (<>
                    <NodeInput
                        editing={editing}
                        id={id}
                        post={(v) => {
                            return { ...nodeData[param.field], key: keyPost(v), value: nodeData[param.field]?.value ?? "" }
                        }}
                        pre={() => keyPre(nodeData[param.field]?.key ?? '')}
                        field={param.field}
                        onBlur={(val) => {
                            if (val) {
                                onCancelEdit()
                            }
                        }}
                        style={{
                            marginRight: '16px'
                        }} />
                </>)
            }
        }
        return (
            <Text adaptiveSize={true} onClick={() => {
                if (isParameter || isProp) onRequestEdit(param)
            }} style={{ marginRight: '12px', textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer' }}>{label ?? ' '}</Text>
        )
    }
    const isDefaultCase = (param.field == 'default')
    const isFlowParam = param.fieldType == 'call' || param.fieldType == 'clause'
    const borderColor = useTheme("borderColor");
    const borderWidth = useTheme("borderWidth");
    const handleBorderColor = useTheme("handleBorderColor");
    const dataOutputColor = useTheme('dataOutputColor');
    const dataPort = useTheme("dataPort");
    const colorError = useTheme("colorError");

    const ref = React.useRef()

    const onDeleteParam = () => {
        deletePropNodeData(id, param.field);
    }

    return (
        <div style={{ alignItems: 'stretch', flexBasis: 'auto', flexShrink: 0, listStyle: 'none', position: 'relative', display: 'flex', zIndex: param.type == 'select' || param.type == 'colorPicker' ? 1100 : 0, flexDirection: "column" }}>
            {
                !isDefaultCase ?
                    <div ref={ref} style={{ flex: 1, fontSize: nodeFontSize + 'px', padding: '2px 6px', gap: '4px', display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
                        <div className={"handleKey"} ref={textBoxRef} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 2 }}>
                            {(param?.deleteable && isDeletedLeft) ? <DeleteButton color={colorError} size={nodeFontSize} onDelete={onDeleteParam} id={id} left={true} field={param.field} /> : null}
                            {getValue()}
                        </div>
                        <div className={"handleValue"} title={param.description} style={{ minWidth: '0px', marginRight: '10px', display: 'flex', flexDirection: 'row', justifyContent: param.type == 'boolean' ? 'flex-end' : '', alignItems: 'center', flex: 3 }}>
                            {getInput(isConnected)}
                            {(param?.deleteable && !isDeletedLeft) ? <DeleteButton color={colorError} size={nodeFontSize} onDelete={onDeleteParam} id={id} field={param.field} /> : null}
                        </div>
                    </div>
                    : null
            }
            {
                param.additionalHandlePort ?
                    <NodePort
                        type={"target"}
                        style={{ top: '16px' }}
                        position={flowDirection == 'RIGHT' ? Position.Left : Position.Right}
                        id={`${(portId ?? id)}${PORT_TYPES.data}${param.field}${PORT_TYPES.data}${param.additionalHandlePort}`}
                        allowedTypes={["data"]}
                    />
                    : null
            }
            {!param.static && !isFlowParam ? <>
                <NodePort
                    position={flowDirection == 'RIGHT' ? Position.Left : Position.Right}
                    id={`${(portId ?? id)}${PORT_TYPES.data}${param.field}`}
                    label={""}
                    nodeId={id}
                    type={'target'}
                    style={{ marginTop: param.additionalHandlePort ? '14px' : "" }}
                    allowedTypes={["data"]}
                />
            </> : null}
            {param.type == 'error' ? <Handle
                type={"source"}
                title={DEVMODE ? `${(portId ?? id)}${PORT_TYPES.data}${param.field}` : undefined}
                style={{ width: "15px", height: "15px", backgroundColor: dataPort, marginRight: '-4px', border: borderWidth + "solid " + handleBorderColor }}
                position={flowDirection == 'RIGHT' ? Position.Left : Position.Right}
                id={`${(portId ?? id)}${PORT_TYPES.data}${param.field}`}
            /> : null}
            {param.fieldType == 'clause' ? <FlowPort
                id={`${(portId ?? id)}${PORT_TYPES.flow}${param.field}`}
                type='output'
                style={{ top: '26px' }}
                label={isDefaultCase ? 'Default' : undefined}
                isConnected={!!isConnected}
            />
                : null
            }
            {param.fieldType == 'call' ? <FlowPort
                id={id}
                handleId={'call'}
                type='input'
                style={{ top: '26px' }}
                isConnected={!!edges.find(e => e.targetHandle == `${id}${PORT_TYPES.flow}${param.field}`)}
            />
                : null
            }
        </div>
    )
}

export const HandleOutput = ({ id, param, position = null, style = {}, isConnected = false, dataOutput = DataOutput.data }) => {
    const { getEdges } = useProtoflow();
    const connected = isHandleConnected(getEdges(), `${id}${PORT_TYPES.data}output`)
    const dataPortColor = useTheme('dataPort')
    const blockPortColor = useTheme('blockPort')
    const flowPortColor = useTheme('flowPort')
    const backgroundColor = (dataOutput == DataOutput.data) ? dataPortColor : (dataOutput == DataOutput.block) ? blockPortColor : flowPortColor
    const useFlowsStore = useContext(FlowStoreContext)
    const instanceId = useFlowsStore(state => state.flowInstance)
    const portSize = useTheme('portSize')
    const borderColor = useTheme('nodeBorderColor')
    const borderWidth = useTheme('nodeBorderWidth')
    return (
        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 222 }}>
            {param.label ? <div style={{ padding: '2px 6px', gap: '4px', display: 'flex', flexDirection: 'row' }}>
                <Text
                    style={{
                        marginRight: '12px',
                        color: param.labelColor,
                        ...(param.labelStyle ?? {}),
                    }}
                >
                    {param.label}
                </Text>
            </div> : null}
            <Handle
                type={"source"}
                style={{ marginLeft: -portSize / 4, width: portSize + "px", height: portSize + "px", backgroundColor: backgroundColor, top: (portSize / 2) + 10, border: borderWidth + " solid " + borderColor, ...style }}
                position={position ?? (flowDirection == 'LEFT' ? Position.Left : Position.Right)}
                title={DEVMODE ? `${id}${PORT_TYPES.data}output` : undefined}
                id={`${id}${PORT_TYPES.data}output`}
                isConnectable={!connected}
                isValidConnection={(c) => {
                    const allowedTypes = read(instanceId, c.targetHandle, [])
                    if (allowedTypes.indexOf(dataOutput) == -1) return false
                    const sourceConnected = isHandleConnected(getEdges(), c.targetHandle)
                    return !sourceConnected
                }}
            />
        </div>
    )
}

export const NodeParams = ({ placeholder=undefined, mode = 'column', id, params, boxStyle = {}, children = null, portId = null }) => {
    const [editing, setEditing] = React.useState('')
    const [currentParams, setCurrentParams] = React.useState(null)
    useEffect(() => {
        if (editing && !params || !params.length || !params.find((p) => p.field == editing)) setEditing('')
        if (currentParams !== null) {
            const newParam = params.find(p => !currentParams.includes(p.field))
            if (newParam) {
                setEditing(newParam.field)
            }
        }
        setCurrentParams(params.map(p => p.field))
    }, [params])
    //@ts-ignore
    return <div style={{ flex: 1, display: 'flex', flexDirection: mode, ...boxStyle }}>
        {params.map((param: Field, i) => {
            return <HandleField placeholder={placeholder} onCancelEdit={() => setEditing('')} editing={param.field == editing} onRequestEdit={(param) => !editing ? setEditing(param.field) : null} key={i} id={id} param={param} index={i} portId={portId} />
        })}
        {children}
    </div>
}

export const NodeOutput = ({ vars, ...props }: NodePortProps & { vars?: string[] }) => {
    const sublabel = vars && vars.length ? vars.reduce((total, current, i) => total + (i > 0 ? ', ' : '') + current, '[') + ']' : ''
    return <div style={{ height: '20px', alignItems: 'stretch', flexBasis: 'auto', flexShrink: 0, listStyle: 'none', position: 'relative', display: 'flex', flexDirection: "column" }}>
        <FlowPort {...props} sublabel={sublabel} />
    </div>
}

export const FlowPort = ({ id, type, style, handleId, label, sublabel, isConnected = false, position = null, allowedTypes = ["block", "data", "flow"], portSize=undefined, borderColor=undefined, borderWidth=undefined, color=undefined }: NodePortProps) => {
    const _position = position ?? (flowDirection == 'RIGHT' ? Position.Left : Position.Right)
    return (<NodePort
        position={_position}
        id={`${id}${PORT_TYPES.flow}${handleId ?? type}`}
        type={type}
        style={{ ...style, marginLeft: _position == Position.Left ? -4 : 0 }}
        label={label}
        sublabel={sublabel}
        isConnected={isConnected}
        nodeId={id}
        allowedTypes={allowedTypes}
        portSize={portSize}
        borderColor={borderColor}
        borderWidth={borderWidth}
        color={color}
    />)
}

type OutputNodeType = DataOutput
interface NodeProps {
    title: string,
    isPreview: boolean,
    id: string,
    params?: Field[],
    output?: Field,
    children?: any,
    color?: string
    node?: any,
    skipCustom?: boolean,
    topics?: any,
    style?: any,
    container?: boolean,
    icon?: any,
    dataOutput?: OutputNodeType
    contentStyle?: any
    draggable?: boolean,
    mode?: 'column' | 'row',
    modeParams?: 'column' | 'row',
    adaptiveTitleSize?: boolean
}

const Node = ({ adaptiveTitleSize = true, modeParams = 'column', mode = 'column', draggable, icon = null, container = false, title = '', children, isPreview = false, id, params = [], output = { label: '', field: 'value', type: 'output' }, color = undefined, node, skipCustom = false, topics, style = {}, dataOutput = DataOutput.data, contentStyle = {} }: NodeProps) => {
    const useFlowsStore = useContext(FlowStoreContext)
    const nodeData = useFlowsStore(state => state.nodeData[id] ?? {})
    const customComponents = useFlowsStore(state => state.customComponents)
    const edges = useProtoEdges();
    const isConnected = isNodeConnected(edges, id)
    const content = React.useRef()

    const computeLayout = () => {
        if (content.current) {
            //@ts-ignore
            const elements = content.current.querySelectorAll('.handleKey')
            let maxWidth = 0
            elements.forEach(key => {
                let width = key.firstElementChild?.offsetWidth
                if (width > maxWidth) {
                    maxWidth = width
                }
            });
            elements.forEach(key => {
                key.style.width = maxWidth + 15 + 'px'
            });
        }
    }

    useEffect(() => computeLayout(), [])

    if (!skipCustom) {
        const mask = getCustomComponent(node, nodeData, customComponents)
        const customComponent = mask?.getComponent(node, nodeData, topics, mask)
        //const customComponent = React.createElement(mask?.getComponent, { node, nodeData, topics, mask })
        if (customComponent) {
            return customComponent
        }
    }

    let disableOutput = false
    for (let child in children) {
        if (children[child]?.type?.name == 'HandleOutput') {
            disableOutput = true
        }
    }


    const extraStyle: any = {}
    if (!id) {
        extraStyle.minWidth = '200px';
    }
    if (node && node.data && node.data.width) extraStyle.minWidth = node.data.width + 'px'
    if (node && node.data && node.data.height) extraStyle.minHeight = node.data.height + 'px'

    const isRendered = nodeData?._metadata?.layouted
    if (node.id && !isRendered) extraStyle.opacity = '0'

    //console.log('meta data: ', nodeData?._metadata)
    let wantLeftInput= true
    if(nodeData?._metadata?.outputPos != undefined && nodeData?._metadata?.outputPos == 'right'){
        wantLeftInput = false
    }
    const renderHandle = (position: Position) =>
        (!disableOutput && !isPreview && output)
            ? <HandleOutput position={position} id={id} param={output} dataOutput={dataOutput} />
            : null

    const headerProps = wantLeftInput
        ? { headerContent: null, headerLeftContent: renderHandle(Position.Left) }
        : { headerContent: renderHandle(Position.Right), headerLeftContent: null }

    return (
        <DiagramNode
            key={isRendered ? 'rendered' : 'loading'}
            adaptiveTitleSize={adaptiveTitleSize}
            mode={mode}
            contentStyle={contentStyle}
            draggable={draggable}
            icon={icon}
            container={container}
            title={title}
            isPreview={isPreview}
            id={id}
            color={color}
            node={node}
            style={{
                ...style,
                ...extraStyle
            }}
            {...headerProps}
        >
            <div ref={content}>
                {DEVMODE ? <div>{id}</div> : null}
                {!isPreview && params ? <NodeParams mode={modeParams} id={id} params={params} /> : null}
                {!isPreview ? children : null}
            </div>

        </DiagramNode>
    )
}

export default withTopics(Node)