import React, { useRef, useEffect, useState, useMemo } from 'react';
import { YStack, Paragraph, Text, XStack, Button, Checkbox, useThemeName } from '@my/ui';
import { Tinted } from 'protolib/components/Tinted';
import { RefreshCcw, Download, Check, Trash2, AlertTriangle } from '@tamagui/lucide-icons';
import { resetDevice, downloadLogs } from "@extensions/esphome/utils";
import { breakTokensIntoLines, createAnsiStyleMap, parseAnsiText, AnsiToken } from './utils/ansi';


const formatTimestamp = () => {
    const date = new Date();
    try {
        return date.toLocaleTimeString(undefined, {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        } as Intl.DateTimeFormatOptions & { fractionalSecondDigits?: number });
    } catch {
        const pad = (value, size = 2) => value.toString().padStart(size, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
    }
};

export const EspConsole = ({ consoleOutput = '', onCancel, deviceName, showReset = true, disconnectInfo = null }) => {
    const scrollContainerRef = useRef(null);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [lineElements, setLineElements] = useState<React.ReactNode[]>([]);
    const [plainLines, setPlainLines] = useState<string[]>([]);
    const processedLengthRef = useRef(0);
    const ansiCarryRef = useRef('');
    const ansiStyleRef = useRef('ansiNormal');
    const pendingLineRef = useRef<AnsiToken[]>([]);
    const lineIdRef = useRef(0);
    const themeName = useThemeName();

    const styleMap = useMemo(() => createAnsiStyleMap(themeName), [themeName]);

    useEffect(() => {
        if (consoleOutput !== '') return;
        setLineElements([]);
        setPlainLines([]);
        processedLengthRef.current = 0;
        ansiCarryRef.current = '';
        ansiStyleRef.current = 'ansiNormal';
        pendingLineRef.current = [];
        lineIdRef.current = 0;
    }, [consoleOutput]);

    useEffect(() => {
        if (consoleOutput.length <= processedLengthRef.current) return;

        const chunk = consoleOutput.slice(processedLengthRef.current);
        processedLengthRef.current = consoleOutput.length;

        // Restore ANSI carry from previous chunk if needed
        let parseTarget = ansiCarryRef.current + chunk;
        ansiCarryRef.current = '';

        if (!parseTarget) return;

        // If chunk ends with an incomplete ANSI sequence, carry it over
        const incompleteMatch = parseTarget.match(/(\x1b\[[0-9;]*)$/);
        if (incompleteMatch && !/\x1b\[[0-9;]*m$/.test(parseTarget)) {
            ansiCarryRef.current = incompleteMatch[1];
            parseTarget = parseTarget.slice(0, -ansiCarryRef.current.length);
        }

        if (!parseTarget) return;

        let normalizedTarget = parseTarget.replace(/\r\n?/g, '\n');
        if (normalizedTarget.includes('\\x1b')) {
            normalizedTarget = normalizedTarget.replace(/\\x1b/g, '\x1b');
        }
        const parsedResult = parseAnsiText(normalizedTarget, ansiStyleRef.current);
        ansiStyleRef.current = parsedResult.endStyle;
        let lines = breakTokensIntoLines(parsedResult.tokens);
        if (pendingLineRef.current.length) {
            if (lines.length) {
                lines[0] = [...pendingLineRef.current, ...lines[0]];
            } else {
                lines = [[...pendingLineRef.current]];
            }
            pendingLineRef.current = [];
        }

        if (!lines.length) return;

        const endsWithNewline = normalizedTarget.endsWith('\n') || normalizedTarget.endsWith('\r');
        if (!endsWithNewline) {
            const last = lines.pop();
            pendingLineRef.current = last ? last : [];
        }

        const timestamp = formatTimestamp();
        const newElements = lines.map(lineTokens => {
            const key = lineIdRef.current++;
            return (
                <Paragraph
                    key={key}
                    fontFamily="Menlo, Courier, monospace"
                    whiteSpace="pre-wrap"
                    marginBottom={4}
                >
                    <Text style={styleMap.ansiNormal} mr={"$2"}>
                        [{timestamp}]
                    </Text>
                    {lineTokens.map((token, tokenIndex) => (
                        <Text key={`${key}-${tokenIndex}`} style={styleMap[token.style]}>
                            {token.text}
                        </Text>
                    ))}
                </Paragraph>
            );
        });

        setLineElements(prev => [...prev, ...newElements]);
        setPlainLines(prev => [
            ...prev,
            ...lines.map(lineTokens =>
                `[${timestamp}] ${lineTokens.map(t => t.text).join('')}`
            )
        ]);
    }, [consoleOutput]);

    useEffect(() => {
        if (!autoScrollEnabled) return;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [lineElements, autoScrollEnabled]);

    return <YStack gap={"$2"} justifyContent="space-between" flex={1} >
        <XStack jc="space-between" ai="center">
            <XStack ai="center" gap="$2">
                <Text color="$color10" fontSize="$2">
                    Autoscroll
                </Text>
                <Checkbox
                    checked={autoScrollEnabled}
                    onCheckedChange={(val) => setAutoScrollEnabled(!!val)}
                    aria-label="Toggle autoscroll"
                >
                    <Checkbox.Indicator>
                        <Check size={14} />
                    </Checkbox.Indicator>
                </Checkbox>
            </XStack>
            {disconnectInfo && (
                <Tinted>
                    <XStack
                        ai="center"
                        gap="$2"
                        px="$3"
                        py="$1"
                        br="$2"
                        backgroundColor="$red3"
                    >
                        <AlertTriangle size={14} color="$red10" />
                        <Text color="$red10" fontSize="$2">
                            {disconnectInfo.message}
                        </Text>
                    </XStack>
                </Tinted>
            )}
        </XStack>
        <YStack
            ref={scrollContainerRef}
            backgroundColor="$bgContent"
            padding="$3"
            borderRadius="$2"
            flex={1}
            overflow="scroll"
        >
            {lineElements}
        </YStack>
        <XStack justifyContent="center" gap={"$4"} mt={"$6"}>
            <Button onPress={() => onCancel()}>Cancel</Button>
            <Tinted>
                {showReset && (
                    <Button icon={RefreshCcw} onPress={() => resetDevice()}>Reset device</Button>
                )}
                <Button
                    icon={Download}
                    onPress={() => downloadLogs(plainLines.join('\n'), deviceName)}
                >
                    Download logs
                </Button>
                <Button
                    icon={Trash2}
                    onPress={() => {
                        setLineElements([]);
                        setPlainLines([]);
                        processedLengthRef.current = consoleOutput.length;
                        ansiCarryRef.current = '';
                        ansiStyleRef.current = 'ansiNormal';
                        pendingLineRef.current = [];
                        lineIdRef.current = 0;
                    }}
                >
                    Clear logs
                </Button>
            </Tinted>
        </XStack>
    </YStack>
};
