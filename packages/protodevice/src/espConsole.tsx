import React, { useRef, useEffect, useState } from 'react';
import { YStack, Paragraph, Text, XStack, Button, Checkbox } from '@my/ui';
import { Tinted } from 'protolib/components/Tinted';
import { RefreshCcw, Download, Check, Trash2 } from '@tamagui/lucide-icons';
import { resetDevice, downloadLogs } from "@extensions/esphome/utils";


const ANSI_REGEX = /((?:\x1b|\u001b)\[[0-9;]*)([a-zA-Z])/g;
type Token = { style: string; text: string };

function parseAnsiText(text, initialStyle = 'ansiNormal') {
    let tokens: Token[] = [];
    let currentStyle = initialStyle;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ANSI_REGEX.exec(text)) !== null) {
        const [full, sequence, terminator] = match;
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
            tokens.push({
                style: currentStyle,
                text: text.substring(lastIndex, matchIndex),
            });
        }

        // Update style only if this is a color mode.
        if (terminator === 'm') {
            if (/0m$/.test(full)) {
                currentStyle = 'ansiNormal';
            } else if (/31m$/.test(full)) {
                currentStyle = 'ansiRed';
            } else if (/32m$/.test(full)) {
                currentStyle = 'ansiGreen';
            } else if (/33m$/.test(full)) {
                currentStyle = 'ansiYellow';
            } else if (/34m$/.test(full)) {
                currentStyle = 'ansiBlue';
            } else if (/35m$/.test(full)) {
                currentStyle = 'ansiMagenta';
            } else if (/36m$/.test(full)) {
                currentStyle = 'ansiCyan';
            } else if (/37m$/.test(full)) {
                currentStyle = 'ansiWhite';
            }
        }

        lastIndex = ANSI_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            style: currentStyle,
            text: text.substring(lastIndex),
        });
    }

    return { tokens, endStyle: currentStyle };
}

const styleMap = {
    ansiNormal: { color: '#F6F6F6' },
    ansiRed: { color: '#FF6666' },
    ansiGreen: { color: '#66FF66' },
    ansiYellow: { color: '#FFFF66' },
    ansiBlue: { color: '#66A3FF' },
    ansiMagenta: { color: '#FF66FF' },
    ansiCyan: { color: '#66FFFF' },
    ansiWhite: { color: '#FFFFFF' },
};


function breakTokensIntoLines(tokens) {
    const lines = [];
    let currentLine = [];

    tokens.forEach(token => {
        const parts = token.text.split('\n');
        parts.forEach((part, index) => {
            if (index > 0) {
                lines.push(currentLine);
                currentLine = [];
            }
            if (part.length > 0) {
                currentLine.push({ ...token, text: part });
            }
        });
    });
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
}

export const EspConsole = ({ consoleOutput = '', onCancel, deviceName, showReset = true }) => {
    const scrollContainerRef = useRef(null);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [lineElements, setLineElements] = useState<React.ReactNode[]>([]);
    const processedLengthRef = useRef(0);
    const ansiCarryRef = useRef('');
    const ansiStyleRef = useRef('ansiNormal');
    const pendingLineRef = useRef<Token[]>([]);
    const lineIdRef = useRef(0);

    useEffect(() => {
        if (consoleOutput !== '') return;
        setLineElements([]);
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

        const newElements = lines.map(lineTokens => {
            const timestamp = new Date().toLocaleTimeString();
            const key = lineIdRef.current++;
            return (
                <Paragraph
                    key={key}
                    fontFamily="Menlo, Courier, monospace"
                    whiteSpace="pre-wrap"
                    marginBottom={4}
                >
                    <Text style={{ color: '#F6F6F6' }} mr={"$2"}>
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
    }, [consoleOutput]);

    useEffect(() => {
        if (!autoScrollEnabled) return;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [lineElements, autoScrollEnabled]);

    return <YStack gap={"$2"} justifyContent="space-between" flex={1} >
        <XStack jc="flex-end">
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
        </XStack>
        <YStack
            ref={scrollContainerRef}
            backgroundColor="#1f1f1f"
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
                <Button icon={Download} onPress={() => downloadLogs(consoleOutput, deviceName)}>Download logs</Button>
                <Button
                    icon={Trash2}
                    onPress={() => {
                        setLineElements([]);
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
