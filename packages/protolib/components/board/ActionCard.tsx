import { useState, useCallback } from "react";
import { XStack, YStack, Text, Switch, Input, TextArea, Button, TooltipSimple, Stack } from "@my/ui";
import { useThemeSetting } from '@tamagui/next-theme'
import { Monaco } from "../Monaco";
import { TextEditDialog } from "../TextEditDialog";
import { FilePicker } from "../FilePicker";
import { SelectList } from "../SelectList";
import { Pin } from "@tamagui/lucide-icons";
import { useTheme, getVariableValue } from 'tamagui';
import { CardPicker } from "./CardPicker";
import { Toggle } from "../Toggle";
import { AgentsSelector } from "../AgentSelector";

export const Icon = ({ name, size = 24, color, style }) => {
    const theme = useTheme();

    const resolveColor = (c) => {
        if (typeof c === 'string' && c.startsWith('$')) {
            const key = c.slice(1);           // "$color10" -> "color10"
            const v = theme[key];             // tamagui variable
            return v ? getVariableValue(v) : c;
        }
        return c; // already a hex/rgb/etc.
    };

    const bg = resolveColor(color);

    return (
        <div
            style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: `${bg}`,
                maskImage: `url(/public/icons/${name}.svg)`,
                WebkitMaskImage: `url(/public/icons/${name}.svg)`,
                maskRepeat: `no-repeat`,
                WebkitMaskRepeat: `no-repeat`,
                maskSize: `contain`,
                WebkitMaskSize: `contain`,
                maskPosition: `center`,
                WebkitMaskPosition: `center`,
                ...style,
            }}
        />
    );
};

function setIn<T>(obj: T, path: any, value: unknown): T {
    if (!Array.isArray(path) || path.length === 0) return obj;

    const [k, ...rest] = path;
    const key = String(k);

    const base: any =
        obj == null
            ? (typeof rest[0] === 'number' ? [] : {})
            : Array.isArray(obj)
                ? obj.slice()
                : { ...(obj as any) };

    if (rest.length === 0) {
        (base as any)[k] = value;
        return base;
    }

    const next = (base as any)[k];
    (base as any)[k] = setIn(next, rest, value);
    return base;
}

export const ParamsForm = ({ data, children }) => {
    const allKeys = Object.keys(data.params || {});
    const [loading, setLoading] = useState(false);
    const { resolvedTheme } = useThemeSetting();

    const [paramsState, setParamsState] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        for (const key of Object.keys(data.params || {})) {
            const defaultValue = data.configParams?.[key]?.defaultValue;
            if (defaultValue !== undefined) initial[key] = defaultValue;
        }
        return initial;
    });

    const setParam = useCallback((key: string, val: any) => {
        setParamsState(prev => ({ ...prev, [key]: val }));
    }, []);

    const isButtonFull = data.buttonMode === "full";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const cleanedParams: Record<string, any> = {};
            for (const key of allKeys) {
                const param = data.configParams?.[key] || {};
                const defaultValue = param.defaultValue;
                const visible = param.visible ?? true;
                const state = paramsState[key];
                if (state !== undefined && state !== "" && visible) {
                    cleanedParams[key] = state;
                } else if ((defaultValue !== undefined && defaultValue !== "") || !visible) {
                    cleanedParams[key] = defaultValue;
                }
            }
            await (window as any)['executeAction'](data.name, cleanedParams);
        } finally {
            setLoading(false);
        }
    };

    const editCardField = async (path, value) => {
        const newData = setIn(data, path, value);
        try {
            await (window as any)['onChangeCardData'][data.name](newData);
        } catch (error) {
            console.error("Error editing card:", error);
        }
    };

    // -------------------- NUEVO: estado local para inputs de tipo array --------------------
    const [arrayText, setArrayText] = useState<Record<string, string>>({});
    // --------------------------------------------------------------------------------------

    return (
        <YStack h="100%" w={"100%"} ai="center" p="15px">
            {children}
            <YStack w={"100%"} ai="center" jc="center">
                {allKeys.map((key) => {
                    const cfg = data.configParams?.[key] || {};
                    let { visible = true, defaultValue = "", type = "string" } = cfg;
                    const value = paramsState[key] ?? defaultValue ?? "";
                    const placeholder = data.params[key] ?? "";
                    const isBoolean = type === "boolean";

                    if (cfg.visibility !== undefined) {
                        let field = cfg.visibility?.field
                        let mode = cfg.visibility?.mode
                        if (mode == "boolean") {
                            let inverted = cfg.visibility?.inverted
                            if (inverted) {
                                visible = paramsState[field] === "false" || paramsState[field] === false
                            } else {
                                visible = paramsState[field] === "true" || paramsState[field] === true
                            }
                        }
                    }

                    if (!visible) {
                        return (
                            <input key={key} type="hidden" name={key} defaultValue={defaultValue} />
                        );
                    }

                    return (
                        <YStack
                            key={key}
                            style={{
                                display: "flex",
                                width: "100%",
                                marginBottom: "10px",
                                boxSizing: "border-box",
                                flexDirection: "column",
                            }}
                        >
                            <XStack ai="center" jc="space-between" pb="$2">
                                <XStack ai="center" gap="$3">
                                    {isBoolean && (
                                        <Toggle
                                            id={`${key}-toggle`}
                                            size="$4"
                                            className="no-drag"
                                            checked={(value ?? "") === "true"}
                                            onChange={(checked) => setParam(key, checked ? "true" : "false")}
                                        />
                                    )}
                                    <Text>{key}</Text>
                                </XStack>

                                <TooltipSimple label={"set as default"} delay={{ open: 500, close: 0 }} restMs={0}>
                                    <Button
                                        color={value == defaultValue ? "transparent" : "$gray10"}
                                        onPress={() => editCardField(["configParams", key, "defaultValue"], value)}
                                        cursor="pointer"
                                        disabled={value == defaultValue}
                                        size="$2"
                                        icon={Pin}
                                        opacity={0.4}
                                        hoverStyle={{ opacity: 1 }}
                                        scaleIcon={1.3}
                                        p="$0"
                                        circular
                                        backgroundColor="transparent"
                                    />
                                </TooltipSimple>
                            </XStack>

                            {!isBoolean && (
                                <>
                                    {(!["json", "array", "boolean", "path"].includes(type)) && (
                                        cfg.selector === "agents" ? (
                                            // 🔽 UI especial para seleccionar un agent (board)
                                            <AgentsSelector
                                                value={value ?? defaultValue}
                                                onChange={(v) => setParam(key, v)}
                                                placeholder={placeholder}
                                            />
                                        ) : cfg?.options?.length ? (
                                            <YStack>
                                                <SelectList
                                                    title={key}
                                                    elements={cfg.options}
                                                    value={value ?? defaultValue}
                                                    onValueChange={(v) => setParam(key, v)}
                                                    selectorStyle={{
                                                        normal: { backgroundColor: "$gray1", borderColor: "$gray7" },
                                                        hover: { backgroundColor: "$gray2" },
                                                    }}
                                                />
                                            </YStack>
                                        ) : (
                                            <TextEditDialog f={1}>
                                                {["text"].includes(type) ? (
                                                    <TextArea
                                                        className="no-drag"
                                                        f={1}
                                                        focusStyle={{ outlineWidth: "1px" }}
                                                        value={value}
                                                        onChangeText={(val) => setParam(key, val)}
                                                        placeholder={placeholder}
                                                        rows={6}
                                                    />
                                                ) : (
                                                    <Input
                                                        className="no-drag"
                                                        value={value}
                                                        placeholder={placeholder}
                                                        minWidth={100}
                                                        onChangeText={(val) => setParam(key, val)}
                                                    />
                                                )}
                                                <TextEditDialog.Trigger
                                                    bc="$gray1"
                                                    pl="$2"
                                                    pos="absolute"
                                                    right={"$2"}
                                                    m="$3"
                                                    bottom={0}
                                                    cursor="pointer"
                                                >
                                                    <Icon name="maximize-2" size={20} color={"var(--gray8)"} />
                                                </TextEditDialog.Trigger>
                                                <TextEditDialog.Editor
                                                    placeholder={placeholder}
                                                    value={value}
                                                    readValue={() => paramsState[key] ?? ""}
                                                    onChange={(val) => setParam(key, val)}
                                                    type={type}
                                                />
                                            </TextEditDialog>
                                        ))}

                                    {type === "array" &&
                                        (cfg.cardSelector ? (
                                            <CardPicker
                                                type={cfg.cardSelectorType}
                                                value={(() => {
                                                    try {
                                                        const parsed = Array.isArray(value) ? value : JSON.parse(value);
                                                        return Array.isArray(parsed) ? parsed : [];
                                                    } catch {
                                                        return [];
                                                    }
                                                })()}
                                                onChange={(arr) => {
                                                    setParam(key, JSON.stringify(arr));
                                                }}
                                                onApply={(arr) => {
                                                    const json = JSON.stringify(arr);
                                                    setParam(key, json);
                                                    editCardField(["configParams", key, "defaultValue"], json);
                                                }}
                                            />
                                        ) : (
                                            <Input
                                                className="no-drag"
                                                value={
                                                    arrayText[key] ??
                                                    (() => {
                                                        try {
                                                            const parsed = Array.isArray(value) ? value : JSON.parse(value);
                                                            return Array.isArray(parsed) ? parsed.join(", ") : "";
                                                        } catch {
                                                            return "";
                                                        }
                                                    })()
                                                }
                                                placeholder={placeholder}
                                                minWidth={100}
                                                onChangeText={(val) => {
                                                    setArrayText((prev) => ({ ...prev, [key]: val }));
                                                    const items = val.split(/\s*,\s*/).filter(Boolean);
                                                    setParam(key, JSON.stringify(items));
                                                }}
                                                onBlur={() => {
                                                    setArrayText((prev) => {
                                                        const next = { ...prev };
                                                        delete next[key];
                                                        return next;
                                                    });
                                                }}
                                            />
                                        ))}

                                    {type === "json" && (
                                        <XStack
                                            p="$3"
                                            bc="$gray1"
                                            borderColor="$gray8"
                                            bw={1}
                                            br="$4"
                                            overflow="hidden"
                                            mx="10px"
                                            f={1}
                                            height={200}
                                        >
                                            <Monaco
                                                language="json"
                                                darkMode={resolvedTheme === "dark"}
                                                sourceCode={value}
                                                onChange={(code) => setParam(key, code)}
                                                options={{
                                                    formatOnPaste: true,
                                                    formatOnType: true,
                                                    minimap: { enabled: false },
                                                    lineNumbers: "off",
                                                }}
                                            />
                                        </XStack>
                                    )}

                                    {type === "path" && (
                                        <FilePicker
                                            allowMultiple={true}
                                            mx="10px"
                                            initialPath={"/data/public"}
                                            onFileChange={(filePath) => {
                                                setParam(key, filePath);
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </YStack>
                    );
                })}

            </YStack>

            {data.type === "action" && (
                <YStack w={"100%"} {...(data.buttonMode === "full" ? { f: 1 } : {})} ai="center" jc="center">
                    <Button
                        id={`${data.name}-run-button`}
                        className="no-drag"
                        onPress={handleSubmit}
                        h={isButtonFull && "100%"}
                        mx={isButtonFull ? 0 : "10px"}
                        w={"100%"}
                        maw={"100%"}
                        f={isButtonFull && 1}
                        p={"10px"}
                        textAlign="center"
                        bc={data.color}
                        hoverStyle={{ bc: data.color, filter: "brightness(1.05)" }}
                        onHoverIn={(e) => e.currentTarget.style.filter = "brightness(1.05)"}
                        onHoverOut={(e) => e.currentTarget.style.filter = "none"}
                        pressStyle={{ bc: data.color, filter: "brightness(0.85)" }}
                        color={data.color}
                        textProps={{ fow: "400", filter: "brightness(0.5)", fos: "$5" }}
                        icon={(props) =>
                            data.icon && (data.displayButtonIcon || data.buttonMode === 'full') && (
                                <Icon
                                    {...props}
                                    style={{ filter: "brightness(0.5)" }}
                                    name={data.icon}
                                    size={data.buttonMode === 'full' ? 48 : 24}
                                />
                            )
                        }
                    >
                        {loading ? "..." : (data.buttonLabel || "Run")}
                    </Button>
                </YStack>
            )}
        </YStack>
    );
};

export const ActionCard = ({ data, children }) => {
    return (
        <YStack height="100%" className="no-drag">
            {children}
        </YStack>
    );
};