
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ModifiersNames, ObjectModel } from '../objectsSchemas'
import { Monaco } from 'protolib/components/Monaco';
import { Code, List, LayoutList, ChevronUp, ChevronDown, Check, Lock, Unlock, Trash2 } from '@tamagui/lucide-icons';
import { XStack, Text, YStack, ToggleGroup, Label, Paragraph, Spinner, Input, Button, Checkbox, TooltipSimple, Popover } from "@my/ui";
import { API } from 'protobase'
import { Tinted } from 'protolib/components/Tinted';
import { InputMultiple } from 'protolib/components/InputMultiple';

type KeysSchemaFieldProps = { path: string[], value: any, setValue: (value: any) => void, mode: string, formData: any }

const getKeysSource = (data: any, keys: any) => {
    const name = data?.name ?? 'Object';
    const payload = {
        id: data?.id ?? `${name.replace(/\s/g, '')}Model`,
        name,
        features: data?.features ?? {},
        keys: keys ?? {}
    };

    try {
        return ObjectModel.load(payload).getSourceCode();
    } catch (err) {
        return '{}'
    }
};


const TableText = ({ children, ...props }) => (
    <XStack paddingLeft="$4" overflow="visible" {...props}>
        <Text
            fontSize="$3"
            color="$gray11"
            numberOfLines={1}
            style={{
                whiteSpace: 'nowrap',
                overflow: 'visible',
            }}
        >
            {children}
        </Text>
    </XStack>
)

const FriendlyKeysEditor = ({ data, setData, mode }) => {
    const buttonWidth = 40
    const [showModifiers, setShowModifiers] = useState("")
    const modifiersOptions = ["search", "static", "secret", "display", "textArea"]
    const allModifiers = ModifiersNames.options.map((o: any) => o.value) ?? []
    const types = ["string", "number", "boolean", "array", "union"]

    const hasModifier = (k: string, v: string) => data?.[k]?.modifiers?.some((m: any) => m.name === v) ?? false

    const setType = useCallback(
        (k: string, v: typeof types[number]) => {
            const next = { ...data }
            const prev = next[k]
            const updated: any = { ...prev, type: v }
            switch (v) {
                case 'array': {
                    updated.params = ["z.any()"]
                    break
                } case 'union': {
                    const hasUnionParams = Array.isArray(prev.params) && /z\.literal\(/.test((prev.params || []).join(','))
                    updated.params = hasUnionParams ? prev.params : []
                    break
                } default: {
                    if (updated.params !== undefined) delete updated.params
                    break
                }
            }
            next[k] = updated
            setData(next)
        },
        [data, setData]
    )

    const onDeleteKey = (keyName) => {
        const next = { ...data }
        delete next[keyName]
        setData(next)
    }

    const toggleModifier = (k: string, mod: "optional" | "id") => {
        let next = { ...data }
        const mods = next[k]?.modifiers ?? []
        const exists = mods.some((m: any) => m.name === mod)

        // regla de unicidad del ID solo en "add"
        if (mod === "id" && mode === "add" && !exists) {
            for (const kk of Object.keys(next)) {
                if (kk !== k && next[kk]?.modifiers?.some((m: any) => m.name === "id")) {
                    next[kk] = {
                        ...next[kk],
                        modifiers: (next[kk].modifiers || []).filter((m: any) => m.name !== "id"),
                    }
                }
            }
        }

        next[k] = {
            ...next[k],
            modifiers: exists ? mods.filter((m: any) => m.name !== mod) : [...mods, { name: mod }],
        }
        setData(next)
    }

    const renameKey = (oldKey: string, newKey: string) => {
        const nk = newKey.trim()
        if (!nk || nk === oldKey) return
        if (data[nk]) return // ya existe

        const next = Object.fromEntries(
            Object.entries(data).map(([k, v]) => (k === oldKey ? [nk, v] : [k, v]))
        )

        setData(next)
    }

    const keys = useMemo(() => Object.keys(data || {}), [data])


    const KeyRow = ({ k }: { k: string }) => {
        const [draftName, setDraftName] = useState(k)
        const isId = hasModifier(k, "id")
        const isOptional = hasModifier(k, "optional")
        const [isHovered, setIsHovered] = useState(false)
        const isEditableType = types.includes(data[k]?.type)

        const commitName = () => {
            if (draftName.trim() && draftName !== k) renameKey(k, draftName)
            else setDraftName(k)
        }

        const onChangeText = (text: string) => {
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) || text === "") {
                setDraftName(text)
            }
        }

        return (
            <YStack key={k} gap="$2" borderWidth={1} borderColor="$gray4" bc="$gray3" p="$2" br="$4" onHoverIn={() => setIsHovered(true)} onHoverOut={() => setIsHovered(false)}>
                <XStack flexDirection="row" alignItems="center" gap="$4" width="100%">
                    <XStack flex={1} gap="$2">
                        <TooltipSimple
                            label="modifiers"
                            delay={{ open: 500, close: 0 }}
                        >
                            <Button
                                circular
                                animation={"bouncy"}
                                size={"$3"}
                                animateOnly={["rotate"]}
                                rotateX={showModifiers == k ? '0deg' : '180deg'}
                                icon={ChevronUp}
                                backgroundColor="transparent"
                                alignSelf='center'
                                onPress={() => setShowModifiers(showModifiers == k ? "" : k)}
                            />
                        </TooltipSimple>
                        <Input
                            value={draftName}
                            placeholder='key name'
                            disabled={mode !== "add"}
                            onChangeText={onChangeText}
                            onBlur={commitName}
                            backgroundColor={mode == "add" ? "$gray1" : "transparent"}
                            onSubmitEditing={commitName}
                            borderColor={"$gray5"}
                            flex={1}
                            borderWidth={mode == "add" ? 1 : 0}
                            hoverStyle={{ backgroundColor: "$gray3" }}
                        />
                    </XStack>
                    <XStack width={120} jc="center">
                        <Popover>
                            <Popover.Trigger disabled={!isEditableType}>
                                <Button
                                    variant="outline"
                                    width={120}
                                    opacity={isEditableType ? 1 : 0.5}
                                    disabled={!isEditableType}
                                    borderWidth={1}
                                    borderColor={"$gray5"}
                                    hoverStyle={{ backgroundColor: "$gray2" }}
                                    backgroundColor={isEditableType ? "$gray1" : "transparent"}
                                    justifyContent="space-between"
                                    iconAfter={isEditableType ? ChevronDown : Code}
                                >
                                    {data[k]?.type || "string"}
                                </Button>
                            </Popover.Trigger>
                            <Popover.Content maxHeight={240} padding="$2" gap="$1" bc="$gray1" borderColor="$gray5" borderWidth={1}>
                                {types.map((typeOption) => (
                                    <Button
                                        key={typeOption}
                                        onPress={() => {
                                            setType(k, typeOption)
                                            setShowModifiers("")
                                        }}
                                        backgroundColor={data[k]?.type === typeOption ? "$color2" : "transparent"}
                                        width="100%"
                                        justifyContent="flex-start"
                                        iconAfter={data[k]?.type === typeOption ? <Tinted><Check size={14} color="$color10" /></Tinted> : null}
                                    >
                                        {typeOption}
                                    </Button>
                                ))}
                            </Popover.Content>
                        </Popover>
                    </XStack>
                    <Tinted>
                        <Button
                            circular
                            icon={isId || !isOptional ? Lock : Unlock}
                            disabled={isId}
                            color={isOptional ? "$gray7" : "$color10"}
                            scaleIcon={1.2}
                            backgroundColor="transparent"
                            onPress={() => toggleModifier(k, "optional")}
                        />
                        <Button
                            circular
                            backgroundColor={mode !== "add" ? "transparent" : isId ? "$color6" : "$gray2"}
                            disabled={mode !== "add"}
                            opacity={isId ? 1 : 0.5}
                            onPress={() => toggleModifier(k, "id")}
                        >
                            {isId || mode === "add" ? "ID" : ""}
                        </Button>

                    </Tinted>
                    <Button
                        size="$3"
                        backgroundColor={"transparent"}
                        circular
                        icon={<Trash2 size={16} color="$red10" />}
                        opacity={isHovered ? 1 : 0}
                        onPress={() => onDeleteKey(k)}
                    />
                </XStack>

                {showModifiers == k && (
                    <YStack p="$4" borderTopColor={"$gray6"} borderTopWidth={1} gap="$4">
                        {data[k]?.type === 'union' && (
                            <YStack gap="$3">
                                <Text ml="$2" color="$gray11" fontSize="$3">union options</Text>
                                <UnionValuesEditor k={k} data={data} setData={setData} mode={mode} />
                            </YStack>
                        )}
                        <YStack>
                            <Text ml="$2" color="$gray11" fontSize="$3">modifiers</Text>
                            <XStack flexWrap="wrap" gap="$2" width="100%">
                                {modifiersOptions.map((mod) => {
                                    const isSelected = data[k]?.modifiers?.some((m: any) => m.name === mod)
                                    return (
                                        <Tinted key={mod}>
                                            <XStack
                                                width="130px"
                                                alignItems="center"
                                                gap="$2"
                                                flexDirection="row"
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleModifier(k, mod)}
                                                    backgroundColor="$gray1"
                                                    borderColor="$gray6"
                                                >
                                                    <Checkbox.Indicator>
                                                        <Check color="$color9" />
                                                    </Checkbox.Indicator>
                                                </Checkbox>
                                                <Label>{mod}</Label>
                                            </XStack>
                                        </Tinted>
                                    )
                                })}
                                {(data[k]?.modifiers ?? [])
                                    .filter((m: any) =>
                                        !modifiersOptions.includes(m.name) &&
                                        (allModifiers?.some((opt: any) => opt === m.name)) &&
                                        !["optional", "id"].includes(m.name)
                                    )
                                    .map((m: any) => (
                                        <TooltipSimple key={m.name} placement='bottom-start' label={"Only editable in code view"} delay={{ open: 500, close: 0 }} restMs={0}>
                                            <XStack
                                                key={m.name}
                                                width="130px"
                                                alignItems="center"
                                                gap="$2"
                                                flexDirection="row"
                                            >
                                                <Checkbox
                                                    checked={true}
                                                    disabled={true}
                                                    backgroundColor="$gray1"
                                                    borderColor="transparent"
                                                >
                                                    <Checkbox.Indicator>
                                                        <Code color="$color10" />
                                                    </Checkbox.Indicator>
                                                </Checkbox>
                                                <Label>{m.name}</Label>
                                            </XStack>
                                        </TooltipSimple>
                                    ))
                                }
                            </XStack>
                        </YStack>
                    </YStack>
                )}

            </YStack>
        )
    }


    const UnionValuesEditor = ({ k, data, setData, mode }: { k: string, data: any, setData: (v: any) => void, mode: string }) => {

        const extractUnionLiterals = (params?: string[]) => {
            if (!params || !params.length) return [] as string[]
            const joined = params.join(',')
            const re = /z\.literal\((['"])(.*?)\1\)/g
            const values: string[] = []
            let m: RegExpExecArray | null
            while ((m = re.exec(joined)) !== null) {
                values.push(m[2])
            }
            return values
        }

        const buildUnionParams = (values: string[]) => {
            const body = values.map(v => `z.literal(${JSON.stringify(v)})`).join(', ')
            return [`[${body}]`]
        }
        const values = useMemo(() => extractUnionLiterals(data?.[k]?.params), [data?.[k]?.params, data])

        const commit = (nextValues: string[]) => {
            const next = { ...data }
            const prev = next[k] || {}
            next[k] = { ...prev, params: buildUnionParams(nextValues) }
            setData(next)
        }

        const handleSet = (arr: string[]) => {
            if (!(mode === 'add' || mode === 'edit')) return
            commit(arr)
        }

        const invalid = values.length < 2
        return <YStack gap="$2">
            <Tinted>
                <InputMultiple values={values} setValues={handleSet} placeholder="Add options (comma, enter or newline)" />
            </Tinted>
            {invalid && (
                <Text ml="$2" color="$red9" fontSize="$2">At least 2 options are required for a union type key.</Text>
            )}
        </YStack>
    }

    const AddKeyForm = () => {
        const [name, setName] = useState("")
        const [type, setTypeLocal] = useState<"string" | "number" | "boolean">("string")
        const [optional, setOptional] = useState(false)
        const [asId, setAsId] = useState(false)

        const addKey = useCallback(() => {
            const n = name.trim()
            if (!n) return
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return
            if (data[n]) return

            let next: any = { ...data }

            if (asId && mode === "add") {
                for (const kk of Object.keys(next)) {
                    const mods = next[kk]?.modifiers || []
                    if (mods.some((m: any) => m.name === "id")) {
                        next[kk] = { ...next[kk], modifiers: mods.filter((m: any) => m.name !== "id") }
                    }
                }
            }

            const modifiers = [
                ...(optional ? [{ name: "optional" }] : []),
                ...(asId ? [{ name: "id" }] : []),
            ]

            next[n] = { type, params: [], ...(modifiers.length ? { modifiers } : {}) }
            setData(next)

            // reset local
            setName("")
            setTypeLocal("string")
            setOptional(false)
            setAsId(false)
        }, [name, type, optional, asId, data, mode, setData])

        return (
            <XStack alignItems="center" gap="$4" width={"100%"}>
                <Input
                    flex={1}
                    placeholder="key name"
                    value={name}
                    onChangeText={setName}           // sin setData aquí
                    onSubmitEditing={addKey}         // commit al enter
                />
                <Tinted>
                    <Button disabled={!name} backgroundColor={name ? "$color6" : "$gray6"} onPress={addKey}>Add</Button>
                </Tinted>
            </XStack>
        )
    }

    return (
        <YStack gap="$4" flex={1}>
            {keys.length > 0 && <XStack flexDirection="row" gap="$4" paddingHorizontal="$2" alignItems="center" justifyContent="space-between">
                <XStack flex={1}>
                    <TableText paddingLeft="$10">field name</TableText>
                </XStack>
                <XStack width={120}>
                    <TableText paddingLeft="$5">type</TableText>
                </XStack>
                <TableText width={buttonWidth} mr="$3" paddingLeft="$0">required</TableText>
                <TableText width={buttonWidth} paddingLeft="$3">ID</TableText>
                <TableText width={buttonWidth}> </TableText>
            </XStack>}
            <YStack gap="$4">
                {keys.map((k) => (
                    <KeyRow key={k} k={k} />
                ))}
            </YStack>
            <AddKeyForm />
        </YStack>
    )
}

export const KeysEditor = ({ path, value, setValue, mode, formData }: KeysSchemaFieldProps) => {
    const dataObject = formData ?? {};
    const codeRef = useRef(getKeysSource(dataObject, value));
    const [loading, setLoading] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const dataRef = useRef<any>({ ...dataObject, keys: value ?? {} });
    const readOnly = mode === 'view' || mode === 'preview';
    const [codeView, setCodeView] = useState(false);

    const applyCodeToForm = async () => {
        const currentCode = codeRef.current;
        if (readOnly) return;
        setLoading(true);
        const parsedCode = currentCode?.trim();
        if (!parsedCode) {
            setParseError(null);
            dataRef.current = { ...dataObject, keys: {} };
            setValue({});
            setLoading(false);
            return;
        }
        const { isError, data } = await API.post('/api/core/v1/objects/parseKeys', { code: parsedCode, name: dataObject?.name ?? 'Temp' });
        if (isError) setParseError('Could not parse the schema.');
        else {
            setParseError(null);
            const nextKeys = data?.keys ?? {};
            dataRef.current = { ...dataObject, keys: nextKeys };
            setValue(nextKeys);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!codeView) {
            codeRef.current = getKeysSource(dataObject, value);
        }
    }, [value, codeView]);

    return (
        <YStack flex={1} gap="$4">
            <XStack flexDirection="row" alignItems="center" justifyContent="space-between">
                <Tinted>
                    <Label fontWeight="bold">
                        <List mr="$2" color="var(--color9)" size="$1" strokeWidth={1} />
                        keys
                        <Paragraph ml="$1" color="$color8">*</Paragraph>
                    </Label>
                </Tinted>
                <ToggleGroup size="$3" type="single"
                    value={codeView ? "code" : "form"}
                    onValueChange={async (val) => {
                        if (val === "form") await applyCodeToForm()
                        setCodeView(val === "code")
                    }}>
                    <ToggleGroup.Item value="form" aria-label="Form View" > <LayoutList /> </ToggleGroup.Item>
                    <ToggleGroup.Item value="code" aria-label="Code View" > <Code /></ToggleGroup.Item>
                </ToggleGroup>
            </XStack>
            <YStack minHeight="220px" gap="$2" display={(codeView && !loading) ? 'flex' : 'none'}>
                <Monaco
                    language='typescript'
                    sourceCode={codeRef.current}
                    onChange={(val) => {
                        const nextCode = val ?? '';
                        codeRef.current = nextCode;
                    }}
                    onSave={applyCodeToForm}
                    onBlur={applyCodeToForm}
                    options={{
                        minimap: { enabled: false },
                        formatOnPaste: true,
                        readOnly: readOnly
                    }}
                />
                {parseError ? <Text color="$red9" fontSize="$3">{parseError}</Text> : null}
            </YStack>
            <YStack minHeight="220px" gap="$2" display={(!codeView && !loading) ? 'flex' : 'none'}>
                <FriendlyKeysEditor data={value} setData={setValue} mode={mode} />
            </YStack>
            <YStack alignItems="center" jc="center" display={loading ? 'flex' : 'none'} minHeight="220px">
                <Tinted><Spinner size='large' color="$color8" alignSelf="center" /></Tinted>
            </YStack>
        </YStack>
    );
};
