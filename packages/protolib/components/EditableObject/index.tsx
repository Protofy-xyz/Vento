import { Button, Fieldset, Label, Stack, XStack, H3, YStack, Paragraph, Spinner, StackProps, Accordion, Square, Spacer } from "@my/ui";
import { Pencil, Tag, ChevronDown, X } from '@tamagui/lucide-icons';
import { Center } from '../Center';
import { Grid } from '../Grid';
import { AsyncView } from '../AsyncView';
import { usePendingEffect } from '../../lib/usePendingEffect';
import { API, ProtoSchema, getPendingResult } from 'protobase';
import { Tinted } from '../Tinted';
import { Notice } from '../Notice';
import { AlertDialog } from '../AlertDialog';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "@my/ui";
import { Schema } from "protobase";
import { useUpdateEffect } from "usehooks-ts";
import {useTint} from '../../lib/Tints'
import { ItemMenu } from "../ItemMenu";
import { getElement } from "./Element";
import { EditableObjectProps } from "./types";
export * from "./types";

export const OpenedSectionsContext = createContext<[string[], Function]>([[], (openedSections) => { }]);

export const iconStyle = { color: "var(--color9)", size: "$1", strokeWidth: 1 }

const capitalize = s => s && s[0].toUpperCase() + s.slice(1)

const defaultValueTable = {
    ZodString: "",
    ZodNumber: "0",
    ZodBoolean: true,
    default: ""
}

export const getDefaultValue = (type) => {
    if (defaultValueTable.hasOwnProperty(type)) {
        return defaultValueTable[type]
    }

    //dynamic values. Do not put them in defaultValueTable, since they will be references
    //all values in valuetable are variables passed as values, not passed as reference
    if (type == 'ZodArray') return []
    else if (type == 'ZodObject') return {}

    return defaultValueTable.default
}


export const FormElement = ({ ele, i, icon, children, inArray = false }) => {
    const isOptional = (ele.isOptional ? ele.isOptional() : false)
    return <Fieldset ml={!i ? "$0" : "$5"} key={i} gap="$2" f={1}>
        {!inArray && <Label fontWeight={"bold"}>
            <Tinted>
                <Stack mr="$2">{React.createElement(icon, iconStyle)}</Stack>
            </Tinted>
            {ele._def.label ?? ele.name}
            <Tinted>
                {!isOptional && <Paragraph ml="$1" color="$color8">*</Paragraph>}
            </Tinted>
        </Label>}
        {inArray && <Spacer size="$1" />}
        <XStack>
            {children}
        </XStack>
    </Fieldset>
}

export const FormGroup = ({ ele, title, children, icon, simple = false, path }) => {
    const [opened, setOpened] = useContext(OpenedSectionsContext);
    const name = [...path, ele.name].join("/")
    // console.log("PATH: ", [...path, ele.name].join("/"))
    const content = <XStack mb={'$2'} id="eo-formgroup" br="$5" f={1} elevation={opened.includes(name) ? 10 : 0} hoverStyle={{ elevation: 10 }}>
        <Accordion value={opened} onValueChange={(localOpened) => setOpened(localOpened)} onPress={(e) => e.stopPropagation()} type="multiple" boc={"$gray6"} f={1}>
            <Accordion.Item br="$5" bw={1} boc={"$gray6"} value={name}>
                <Accordion.Trigger p={0} px={8} height={43} bc="$transparent" focusStyle={{ bc: "$transparent" }} br={opened.includes(name) ? "$0" : '$5'} btlr="$5" btrr="$5" bw="$0" flexDirection="row" ai="center">
                    {({ open }) => (
                        <>
                            { /* @ts-ignore */}
                            <Square o={0.8} animation="quick" rotate={open ? '180deg' : '0deg'} mr={"$1.5"}>
                                <ChevronDown size="$1" />
                            </Square>
                            <Tinted>{simple ? React.createElement(icon, iconStyle) : <></>}</Tinted>

                            <Paragraph ml={"$2"}>{title}</Paragraph>
                            <Spacer flex={1} />

                        </>
                    )}
                </Accordion.Trigger>
                <Accordion.Content br="$5">
                    {children}
                </Accordion.Content>
            </Accordion.Item>
        </Accordion></XStack>
    return simple ? content : <FormElement ele={ele} icon={icon} i={0}>
        {content}
    </FormElement>
}

export const GridElement = ({ index, data, width, columns }) => {
    const numColumns = data.ele._def.size <= columns ? data.ele._def.size : 1

    return <XStack f={1} width={(width * numColumns) + (numColumns === 1 ? data.columnMargin / 2 : ((numColumns - 1) * data.columnMargin))} key={data.x}>{getElement({
        ele: data.ele,
        icon: data.icon,
        i: data.i,
        x: data.x,
        data: data.data || data.defaultData,
        setData: data.setData,
        mode: data.mode,
        customFields: data.customFields,
        URLTransform: data.URLTransform
    })}
    </XStack>
}

export const DeleteButton = ({ mode, onPress }) => (
    <>
        {(mode == 'edit' || mode == 'add') && <Stack mr={"$2"}
            top={6} br={"$5"} p={"$2"}
            als="flex-start" cursor='pointer'
            position="absolute"
            right='0'
            pressStyle={{ o: 0.7 }} hoverStyle={{ bc: "$red4" }}
            onPress={onPress}>
            <X color={'var(--red7)'} strokeWidth={2} size={20} />
        </Stack>
        }
    </>
)

export const EditableObject = ({ externalErrorHandling, error, setError, data, setData, autoWidth = false, columnMargin = 30, columnWidth = 350, extraMenuActions, disableToggleMode, name, initialData, loadingTop, spinnerSize, loadingText, title, sourceUrl = null, onSave = (x, y) =>{}, mode = 'view', model, icons = {}, extraFields = {}, numColumns = 1, objectId, onDelete = () => { }, deleteable = () => { return true }, customFields = {}, URLTransform = (url) => url, disableAutoChangeMode = false, ...props }: EditableObjectProps & StackProps) => {
    const initialPendingData = initialData ?? (mode === 'add' ? { data: {} } : getPendingResult('pending'))
    const [originalData, setOriginalData] = useState(initialPendingData)
    const [currentMode, setCurrentMode] = useState(mode)
    const [prevCurrentMode, setPrevCurrentMode] = useState('')
    const [_data, _setData] = useState(initialPendingData)
    let hideButton = data && setData
    if (!data || !setData) {
        data = _data
        setData = _setData
    }
    // console.log('using data: ', data)
    const [loading, setLoading] = useState(false)
    const [_error, _setError] = useState<any>()
    if ((!error || !setError) && !externalErrorHandling) {
        error = _error
        setError = _setError
    }

    const [dialogOpen, setDialogOpen] = useState(false)
    const [edited, setEdited] = useState(false)
    const [ready, setReady] = useState(false)
    const containerRef = useRef()
    const [openedSections, setOpenedSections] = useState([])

    usePendingEffect((s) => { mode != 'add' && API.get(sourceUrl, s) }, setOriginalData, initialData)

    useEffect(() => {
        if (originalData.data) {
            setData(originalData)
        }
    }, [originalData])

    useUpdateEffect(() => setCurrentMode(mode), [mode])

    useUpdateEffect(() => {
        if (ready) {
            setEdited(true)
        } else {
            setReady(true)
        }
    }, [data])

    const getGroups = () => {
        var elementObj = model.load(data.data)
        var extraFieldsObject = ProtoSchema.load(Schema.object(extraFields)).isVisible(currentMode, elementObj)
        var formFields = elementObj.getObjectSchema().isVisible(currentMode, elementObj).merge(extraFieldsObject).getLayout(1)

        const defaultData = {}
        formFields.forEach((row, x) => row.forEach((ele, i) => {
            if (ele._def.hasOwnProperty('defaultValue')) {
                defaultData[ele.name] = ele._def.defaultValue
            }
        }))

        elementObj = model.load({ ...defaultData, ...data.data })
        extraFieldsObject = ProtoSchema.load(Schema.object(extraFields)).isVisible(currentMode, elementObj)
        formFields = elementObj.getObjectSchema().isVisible(currentMode, elementObj).merge(extraFieldsObject).getLayout(1)

        const groups = {}

        formFields.forEach((row, x) => row.forEach((ele, i) => {
            const icon = icons[ele.name] ? icons[ele.name] : (currentMode == 'edit' || currentMode == 'add' ? Pencil : Tag)
            const groupId = ele._def.group ?? 0
            if (!groups.hasOwnProperty(groupId)) {
                groups[groupId] = []
            }
            if (ele._def.hasOwnProperty('defaultValue')) {
                defaultData[ele.name] = ele._def.defaultValue
            }

            groups[groupId].push({
                id: x + '_' + i,
                icon: icon,
                i: i,
                x: x,
                ele: ele,
                data: data.data,
                setData,
                mode: currentMode,
                size: ele._def.size ?? 1,
                numColumns: numColumns,
                customFields,
                columnMargin: columnMargin,
                defaultData,
                URLTransform
            })
        }))
        return groups
    }

    const groups = useMemo(getGroups, [extraFields, data, model, columnMargin, numColumns, currentMode, mode, originalData])
    const gridView = useMemo(() => Object.keys(groups).map((k, i) => <XStack ref={containerRef} width={autoWidth ? '100%' : columnWidth * numColumns + (numColumns > 1 ? numColumns : 1) * columnMargin} f={1}>

        <YStack f={1} >
            <Grid masonry={false} containerRef={containerRef} spacing={columnMargin / 2} data={groups[k]} card={GridElement} itemMinWidth={columnWidth} columns={numColumns} />
        </YStack>
        {currentMode == 'preview' && <Stack t={"$-7"}>
            <ItemMenu type="item" sourceUrl={sourceUrl} onDelete={onDelete} deleteable={deleteable} element={model.load(data.data)} extraMenuActions={extraMenuActions} />
        </Stack>}
    </XStack>), [columnMargin, groups, columnWidth, numColumns])

    const { tint } = useTint()

    return <OpenedSectionsContext.Provider value={[openedSections, setOpenedSections]}>
        <Stack width="100%" {...props}>
            <AlertDialog
                showCancel={true}
                acceptCaption="Discard"
                cancelCaption="Keep editing"
                onAccept={async () => {
                    const data = await API.get(sourceUrl)
                    setOriginalData(data)
                    setCurrentMode('view')
                }}
                cancelTint={tint}
                acceptTint="red"
                open={dialogOpen}
                setOpen={setDialogOpen}
                title="Are you sure you want to leave?"
                description=""
            >
                <Center mt="$5">All unsaved changes will be lost</Center>
            </AlertDialog>
            <AsyncView forceLoad={currentMode == 'add' || data.data} waitForLoading={1000} spinnerSize={spinnerSize} loadingText={loadingText ?? "Loading " + objectId} top={loadingTop ?? -30} atom={data}>
                <YStack width="100%">
                    <XStack ai="center">
                        <XStack id="eo-dlg-title">{title ?? <H3><Tinted><H3 color="$color9">{capitalize(mode)}</H3></Tinted>{` ${capitalize(name)}`}</H3>}</XStack>
                        {(!disableToggleMode && (currentMode == 'view' || currentMode == 'edit')) && <XStack pressStyle={{ o: 0.8 }} onPress={async () => {
                            if (currentMode == 'edit' && edited) {
                                setDialogOpen(true)
                            } else {
                                setPrevCurrentMode(currentMode)
                                setCurrentMode(currentMode == 'view' ? 'edit' : 'view')
                            }
                        }} cursor="pointer">
                            <Tinted>
                                <Stack>{currentMode == 'view' ? <Pencil color="var(--color8)" /> : (prevCurrentMode == 'view' ? <X color="var(--color8)" /> : null)}</Stack>
                            </Tinted>
                        </XStack>}
                    </XStack>
                    <YStack width="100%" f={1} mt={title ? "$2" : "$0"} ai="center" jc="center">
                        {error && (
                            <Notice>
                                <Paragraph>{getErrorMessage(error.error)}</Paragraph>
                            </Notice>
                        )}

                        {gridView}

                        {currentMode != 'preview' && <YStack mt="$4" p="$2" pb="$5" width="100%" f={1} alignSelf="center">
                            {(currentMode == 'add' || currentMode == 'edit') && !hideButton && <Tinted>
                                <Button f={1} onPress={async () => {
                                    setLoading(true)
                                    try {
                                        await onSave(originalData.data, data.data)
                                        if (prevCurrentMode != currentMode && !disableAutoChangeMode) {
                                            setCurrentMode(prevCurrentMode as any)
                                        }
                                    } catch (e) {
                                        setError(e)
                                        console.log('e: ', e)
                                    }
                                    setLoading(false)
                                }}>
                                    {loading ? <Spinner /> : currentMode == 'add' ? 'Create' : 'Save'}
                                </Button>
                            </Tinted>}
                        </YStack>}
                    </YStack>
                </YStack>
            </AsyncView>
        </Stack>
    </OpenedSectionsContext.Provider>
}
