import { createElement, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { XStack, YStack, Text, TooltipSimple } from '@my/ui';
import { useThemeSetting } from '@tamagui/next-theme'
import { X, Minimize2, Maximize2, Expand, Shrink, PanelLeft, PanelRight } from '@tamagui/lucide-icons'
import { TabBar } from 'protolib/components/TabBar';
import { useAtom } from 'jotai';
import { ChatPanelWidthAtom } from 'protolib/components/AdminPanel';

type Side = 'left' | 'right';

export const FloatingWindow = ({ visible, onChangeTab, selectedTab, tabs, side = 'right', onToggleSide, leftAnchorSelector, leftAnchorGap }) => {
    const openWindowSize = 1010
    const winRef = useRef(null)
    const anchorElRef = useRef<HTMLElement | null>(null);

    const { resolvedTheme } = useThemeSetting()
    const [windowSize, setWindowSize] = useState(1010)
    const [fullScreen, setFullScreen] = useState(false)
    const darkMode = resolvedTheme == 'dark'

    const isOpenSize = windowSize === openWindowSize;
    const isLeft = side === 'left';
    const [anchorWidth, setAnchorWidth] = useState<number | null>(null);
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        if (!isLeft) {
        setReady(true);
        return;
        }
        const el = leftAnchorSelector
        ? (document.querySelector(leftAnchorSelector) as HTMLElement | null)
        : null;

        anchorElRef.current = el || null;

        if (anchorElRef.current) {
        const rect = anchorElRef.current.getBoundingClientRect();
        setAnchorWidth(rect.width);
        } else {
        setAnchorWidth(0);
        }
        setReady(true);
    }, [isLeft, leftAnchorSelector]);

    useEffect(() => {
        if (!isLeft || !anchorElRef.current) return;

        const el = anchorElRef.current;
        const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const cr = entry.contentRect;
            // coalesce rapid changes with rAF
            requestAnimationFrame(() => setAnchorWidth(cr.width));
        }
        });

        ro.observe(el);
        return () => ro.disconnect();
    }, [isLeft]);

    useEffect(() => {
        if (!isLeft) return;

        const measure = () => {
        const el = anchorElRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setAnchorWidth(rect.width);
        };

        const onResize = () => requestAnimationFrame(measure);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isLeft]);

    const overlayStyle: React.CSSProperties = {
        pointerEvents: "none",
        width: "100vw",
        height: "120vh",
        position: "fixed",
        ...(isLeft ? { left: visible ? 0 : "-100vw" } : { right: visible ? 0 : "-100vw" }),
    };
    
    const leftOffset = (anchorWidth ?? 0) + leftAnchorGap;
    
    // Read the chat panel width from the atom
    const [chatPanelWidth] = useAtom(ChatPanelWidthAtom);
    
    // Calculate the right offset considering the chat panel
    const rightOffset = 25 + chatPanelWidth;

    const baseStyle = fullScreen
        ? {
            ...(isLeft ? { left: visible ? 0 : "-100vw" } : { right: visible ? chatPanelWidth : "-100vw" }),
            top: "0px",
            width: winRef.current ? winRef.current.offsetWidth : window.innerWidth,
            height: "calc(100vh)"
        }
        : {
            ...(isLeft ? { left: visible ? leftOffset : -windowSize } : { right: visible ? rightOffset : -windowSize }),
            top: "25px",
            width: windowSize,
            height: "calc(100vh - 100px)"
        }

    return <>
        <div
            ref={winRef}
            onClick={() => { }}
            style={overlayStyle}
        ></div>
        {
            <YStack
                pointerEvents='auto'
                position="fixed"
                animation="quick"
                {...baseStyle}
                backgroundColor='var(--bgContent)'
                borderWidth={2}
                br="$5"
                elevation={60}
                shadowOpacity={0.2}
                shadowColor={"black"}
                bw={1}
                boc="$gray6"
                overflow='hidden'
                gap="2px"
            >
                <XStack borderBottomColor={"$gray6"} borderBottomWidth="1px">
                    <XStack ai="center" gap="$3" p="$2.5" px="$3">
                        {/* close */}
                        <XStack
                            cursor='pointer'
                            onPress={() => {
                                onChangeTab("")
                                setFullScreen(false)
                            }}
                            pressStyle={{ opacity: 0.8 }}
                            hoverStyle={{ scale: 1.05 }}
                        >
                            <X size={18} color="var(--color)" />
                        </XStack>

                        {/* side toggle */}
                        <TooltipSimple
                            label={side === 'right' ? 'Move panel to left' : 'Move panel to right'}
                            delay={{ open: 200, close: 0 }}
                            restMs={0}
                        >
                            <XStack
                                cursor='pointer'
                                onPress={() => onToggleSide?.()}
                                pressStyle={{ opacity: 0.8 }}
                                hoverStyle={{ scale: 1.05 }}
                            >
                                {side === 'right' ? (
                                    <PanelLeft size={18} color="var(--color)" />
                                ) : (
                                    <PanelRight size={18} color="var(--color)" />
                                )}
                            </XStack>
                        </TooltipSimple>

                        {/* maximize / restore */}
                        {!fullScreen && <XStack
                            cursor='pointer'
                            onPress={() => {
                                setWindowSize(prev => {
                                    // Consider the chat panel width when maximizing
                                    const maxWidth = window.innerWidth - 330 - chatPanelWidth;
                                    return prev === 1010 ? maxWidth : 1010
                                })
                            }}
                            pressStyle={{ opacity: 0.8 }}
                            hoverStyle={{ scale: 1.05 }}
                        >
                            {isOpenSize ? <Maximize2 size={18} color="var(--color)" /> : <Minimize2 size={18} color="var(--color)" />}
                        </XStack>}
                        {/* fullscreen toggle */}
                        <XStack
                            cursor='pointer'
                            onPress={() => setFullScreen(!fullScreen)}
                            pressStyle={{ opacity: 0.8 }}
                            hoverStyle={{ scale: 1.05 }}
                        >
                            {fullScreen ? <Shrink size={18} color="var(--color)" /> : <Expand size={18} color="var(--color)" />}
                        </XStack>
                    </XStack>
                    <YStack
                        borderRightWidth="1px"
                        borderRightColor={"$gray6"}
                    ></YStack>
                    {
                        <TabBar
                            tabs={tabs}
                            selectedId={selectedTab}
                            onSelect={onChangeTab}
                        />
                    }
                </XStack>
                <XStack flex={1}>
                    {
                        tabs && Object.keys(tabs).map((key) => {
                            const tab = tabs[key];
                            return <YStack key={key} f={1} display={selectedTab === key ? 'flex' : 'none'}>
                                {tab.content}
                            </YStack>
                        })
                    }
                </XStack>
            </YStack>
        }
    </>
}