import React, { useRef, useEffect, useState } from 'react';
import { YStack, Paragraph, Text, XStack, Button, Checkbox } from '@my/ui';
import { Tinted } from 'protolib/components/Tinted';
import { RefreshCcw, Download, Check } from '@tamagui/lucide-icons';
import { resetDevice, downloadLogs } from "@extensions/esphome/utils";


const ANSI_REGEX = /((?:\x1b|\u001b)\[[0-9;]*m)/g;

function parseAnsiText(text) {
    let tokens = [];
    let currentStyle = 'ansiNormal';
    let lastIndex = 0;
    let match;

    while ((match = ANSI_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({
                style: currentStyle,
                text: text.substring(lastIndex, match.index),
            });
        }
        const ansiCode = match[0];

        if (/\x1b\[[0-9;]*0m/.test(ansiCode)) {
            currentStyle = 'ansiNormal';
        }
        else if (/\x1b\[[0-9;]*31m/.test(ansiCode)) {
            currentStyle = 'ansiRed';
        } else if (/\x1b\[[0-9;]*32m/.test(ansiCode)) {
            currentStyle = 'ansiGreen';
        } else if (/\x1b\[[0-9;]*33m/.test(ansiCode)) {
            currentStyle = 'ansiYellow';
        } else if (/\x1b\[[0-9;]*34m/.test(ansiCode)) {
            currentStyle = 'ansiBlue';
        } else if (/\x1b\[[0-9;]*35m/.test(ansiCode)) {
            currentStyle = 'ansiMagenta';
        } else if (/\x1b\[[0-9;]*36m/.test(ansiCode)) {
            currentStyle = 'ansiCyan';
        } else if (/\x1b\[[0-9;]*37m/.test(ansiCode)) {
            currentStyle = 'ansiWhite';
        }

        lastIndex = ANSI_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({
            style: currentStyle,
            text: text.substring(lastIndex),
        });
    }
    return tokens;
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
    const processedOutput = consoleOutput.replace(/\\x1b/g, "\x1b");
    let tokens = parseAnsiText(processedOutput);

    tokens = tokens.map(token => {
        const trimmed = token.text.trim();
        if (trimmed && /^[▂▄▆█\s]+$/.test(trimmed)) {
            return { ...token, text: token.text.replace(/\n/g, '') };
        }
        return token;
    });

    const scrollContainerRef = useRef(null);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    useEffect(() => {
        if (!autoScrollEnabled) return;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [tokens, autoScrollEnabled]);

    const lines = breakTokensIntoLines(tokens);

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
            {lines.map((lineTokens, lineIndex) => {
                const timestamp = new Date().toLocaleTimeString();
                return (
                    <Paragraph
                        key={lineIndex}
                        fontFamily="Menlo, Courier, monospace"
                        whiteSpace="pre-wrap"
                        marginBottom={4}
                    >
                        <Text style={{ color: '#F6F6F6' }} mr={"$2"}>
                            [{timestamp}]
                        </Text>
                        {lineTokens.map((token, tokenIndex) => (
                            <Text key={tokenIndex} style={styleMap[token.style]}>
                                {token.text}
                            </Text>
                        ))}
                    </Paragraph>
                );
            })}
        </YStack>
        <XStack justifyContent="center" gap={"$4"} mt={"$6"}>
            <Button onPress={() => onCancel()}>Cancel</Button>
            <Tinted>
                {showReset && (
                    <Button icon={RefreshCcw} onPress={() => resetDevice()}>Reset device</Button>
                )}
                <Button icon={Download} onPress={() => downloadLogs(consoleOutput, deviceName)}>Download logs</Button>
            </Tinted>
        </XStack>
    </YStack>
};
