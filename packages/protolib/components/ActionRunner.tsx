import { Button, Input, Paragraph, XStack, YStack, Tooltip, Spinner, Text } from '@my/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { HTMLView } from "@extensions/services/widgets";

const enableHTML = true

export const ActionRunner = ({ id = null, setData = (data, id) => { }, name, data, displayResponse, value = undefined, html, caption = "Run", description = "", actionParams = {}, onRun, icon, color = 'var(--color7)', ...props }) => {
    useEffect(() => {
        if (!window['onRunListeners']) window['onRunListeners'] = {}
        window['onRunListeners'][name] = onRun
    }, [name])
    const [params, setParams] = useState({});
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState("");

    const labelWidth = useMemo(() => {
        const margin = 10;
        const keys = Object.keys(actionParams);
        if (keys.length === 0) return 50;
        const longestKey = keys.reduce((acc, cur) => (cur.length > acc.length ? cur : acc), '');
        return longestKey.length * 8 + margin;
    }, [actionParams]);

    return (
        <YStack h="100%" >
            {/* Si hay HTML, renderizarlo */}
            {html?.length > 0 && enableHTML && (
                <HTMLView style={{ width: "100%", height: "100%" }}
                    html={html} data={{ ...props, ...data, icon, name, params: actionParams, color, displayResponse, value }} setData={(data) => {
                        setData(data, id)
                    }} />
            )}

            {/* Si NO hay HTML, usar el diseño clásico */}
            {(!html?.length || !enableHTML) && (
                <>
                    {typeof icon === 'string' && (
                        <div style={{
                            width: "48px",
                            height: "48px",
                            marginBottom: '15px',
                            backgroundColor: color,
                            maskImage: `url(${icon})`,
                            WebkitMaskImage: `url(${icon})`,
                            maskRepeat: "no-repeat",
                            WebkitMaskRepeat: "no-repeat",
                            maskSize: "contain",
                            WebkitMaskSize: "contain",
                            maskPosition: "center",
                            WebkitMaskPosition: "center"
                        }} />
                    )}

                    {Object.keys(actionParams).map((key) => (
                        <Tooltip key={key}>
                            <Tooltip.Trigger width="100%">
                                <XStack width="100%" alignItems="center" mb="$3">
                                    <Paragraph width={labelWidth} mr="$3">{key}</Paragraph>
                                    <Input
                                        flex={1}
                                        placeholder="Value"
                                        className="no-drag"
                                        value={params[key] ?? ''}
                                        onChangeText={(text) =>
                                            setParams({
                                                ...params,
                                                [key]: text,
                                            })
                                        }
                                    />
                                </XStack>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                                <Tooltip.Arrow />
                                <Paragraph>{actionParams[key]}</Paragraph>
                            </Tooltip.Content>
                        </Tooltip>
                    ))}

                    {displayResponse && (
                        <Text className="no-drag" userSelect="none" mt={10} fontSize={30} fontWeight="bold" color="$primary">
                            {React.isValidElement(value) || typeof value === 'string' || typeof value == 'number' ? value : 'N/A'}
                        </Text>
                    )}

                    <Tooltip>
                        <Tooltip.Trigger width="100%">
                            <YStack alignItems="center" justifyContent="center">

                                <Button
                                    pressStyle={{ filter: "brightness(0.95)", backgroundColor: color }}
                                    hoverStyle={{ backgroundColor: color, filter: "brightness(1.1)" }}
                                    backgroundColor={color}
                                    mt="$3"
                                    marginHorizontal="$2"
                                    width="100%"
                                    className="no-drag"
                                    onPress={async () => {
                                        //actionData.automationParams is a key value object where the key is the name of the parameter and the value is the description
                                        //if there are parameters, they should be included in the query parameters of the request
                                        //if a parameter is missing, remove it from the query parameters
                                        const cleanedParams = {};
                                        for (const key in params) {
                                            if (params[key] || params[key] === "0") {
                                                cleanedParams[key] = params[key];
                                            }
                                        }
                                        setLoading(true);
                                        try {
                                            setResponse(JSON.stringify(await onRun(name, cleanedParams), null, 2));
                                        } catch (e) { } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    {loading ? <Spinner /> : caption}
                                </Button>
                            </YStack>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                            <Tooltip.Arrow />
                            <Paragraph>{description}</Paragraph>
                        </Tooltip.Content>
                    </Tooltip>
                </>
            )}
        </YStack>
    );
};
