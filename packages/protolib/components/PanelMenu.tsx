import { YStack, XStack } from '@my/ui'
import { ChevronDown, Minus } from '@tamagui/lucide-icons'
import { Accordion, Input, Paragraph, SizableText, Square, ScrollView } from '@my/ui'
import { usePathname, useSearchParams } from 'solito/navigation';
import { useState } from 'react';
import { API, getPendingResult } from 'protobase';
import { AlertDialog } from './AlertDialog';
import { Link } from './Link';
import { Tinted } from './Tinted';
import { PanelMenuItem } from './PanelMenuItem';
import { useQueryState } from '../next'
import { useThemeSetting } from '@tamagui/next-theme'
import { getIcon } from './InternalIcon';
import { shouldShowInArea } from '../helpers/Visibility';

const appId = process.env.NEXT_PUBLIC_APP_ID;

const healthCheckLinkRoute = (str) => {
    if (appId == 'adminpanel' && str.startsWith('/workspace/')) {
        // remove /workspace/ from the start of the string
        str = str.replace('/workspace/', '/')
    }
    return str.startsWith('/') ? str : ("/" + str)
};

const getSubtabHref = (subtab) =>
    subtab.href ?? (subtab.type + subtab.path).replace(/\/+/g, '/');

const isSubtabMatch = (href: string, pathname: string) => {
    return href.includes(pathname) && pathname != '/'
};

const isTabSelected = (subtabs, shortedMatch) =>
    subtabs.some((subtab) => {
        const href = getSubtabHref(subtab)
        return shortedMatch == href
    });

const getShortestMatch = (tabs: string[], pathname: string, searchParams): string | null => {
    const queryStr = searchParams.toString()

    let filteredTabs = tabs
        .filter(href => isSubtabMatch(href, pathname))
        .sort((a, b) => a.length - b.length);

    if (filteredTabs.length == 1) return filteredTabs[0];
    else if (filteredTabs.length > 1) {
        const filteredQueryTabs = filteredTabs.filter(href => href.includes(queryStr));
        return filteredQueryTabs ? filteredQueryTabs[0] : filteredTabs[0];
    }
    return null
}

const findBoardForSubtab = (subtab: any, boards: any[] | undefined | null) => {
    if (!boards || !boards.length) return null;

    const href = getSubtabHref(subtab) || '';

    // 1) Try query param ?board=name
    const queryMatch = href.match(/[?&]board=([^&]+)/);
    if (queryMatch?.[1]) {
        const byQuery = boards.find(b => b?.name === queryMatch[1]);
        if (byQuery) return byQuery;
    }

    // 2) Try path like /boards/view/name or /boards/name
    const pathMatch = href.match(/boards\/(?:view\/)?([^/?&]+)/);
    if (pathMatch?.[1]) {
        const byPath = boards.find(b => b?.name === pathMatch[1]);
        if (byPath) return byPath;
    }

    // 3) Fallback: match by subtab.name
    return boards.find(b => b?.name === subtab.name) ?? null;
};

const CreateDialog = ({ subtab }) => {
    const [name, setName] = useState('')
    const [result, setResult] = useState(getPendingResult("pending"))
    const template = subtab.options.templates[0]

    if (!template) {
        throw "Invalid template specified in workspace file: " + subtab.options.templates[0]
    }

    return <XStack onPress={() => { }}>
        <AlertDialog
            onAccept={async (setOpen) => {
                const response = await API.post('/api/core/v1/templates/' + subtab.options.templates[0].options.type, {
                    name: name,
                    data: {
                        options: subtab.options.templates[0].options,
                        path: subtab.path
                    }
                })
                //@ts-ignore
                if (response.isLoaded) {
                    setName('')
                    setOpen(false)
                    setResult(getPendingResult("pending"))
                } else {
                    setResult(response)
                }
            }}
            title={template.title ?? "Create a new " + subtab.options.templates[0]}
            trigger={<PanelMenuItem
                icon={getIcon(subtab.icon)}
                text={subtab.name}
                mb={'$4'}
            />}
            description={template.description ?? ("Use a simple name for your " + subtab.options.templates[0] + ", related to what your " + subtab.options.templates[0] + " does.")}
        >
            <YStack f={1} jc="center" ai="center">
                {result.isError ? (
                    <Paragraph mb={"$5"} color="$red10">
                        Error: {result.error?.error}
                    </Paragraph>
                ) : null}
                <Input
                    value={name}
                    onChangeText={(text) => setName(text)}
                    f={1}
                    mx={"$8"}
                    textAlign='center'
                    id="name"
                    placeholder={template.placeholder ?? 'name...'}
                />
            </YStack>
        </AlertDialog>
    </XStack>
}

const Subtabs = ({ subtabs, collapsed, shortedMatch }: any) => {
    return (
        <YStack f={1} gap="$1">
            {subtabs.map((subtab, index) => {
                if (subtab.type == 'create') return <CreateDialog subtab={subtab} key={index} />
                let href = getSubtabHref(subtab)
                const content = (
                    <Tinted>
                        <PanelMenuItem
                            collapsed={collapsed}
                            selected={shortedMatch == href}
                            icon={getIcon(subtab.icon)}
                            text={subtab.name}
                            extraLabel={subtab.extraLabel}
                        />
                    </Tinted>
                )
                if (subtab.external || (!subtab.href?.startsWith('/workspace/') && appId == 'adminpanel')) {
                    return (
                        <a href={href} key={index}>
                            {content}
                        </a>
                    )
                }

                return (
                    <Link href={healthCheckLinkRoute(href)} key={index}>
                        {content}
                    </Link>
                )
            })}
        </YStack>
    )
}

const Tabs = ({ tabs, boards, collapsed }: any) => {
    const { resolvedTheme } = useThemeSetting()
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const spreadSubtabs = Object.keys(tabs).reduce((acc, key) => {
        if (Array.isArray(tabs[key])) {
            return acc.concat(tabs[key]);
        }
        if (typeof tabs[key] === 'object' && tabs[key] !== null) {
            return acc.concat(tabs[key]);
        }
        return acc;
    }, []);

    const hrefList = spreadSubtabs.map(subtab => getSubtabHref(subtab))
    const shortedMatch = getShortestMatch(hrefList, pathname, searchParams);

    return (tabs ?
        <YStack f={1} enterStyle={{ opacity: 0, top: -3 }} top={0} animation={"bouncy" as any}>
            {Object.keys(tabs).map((tab, index) => {
                if (tabs[tab].length === undefined) {
                    const single = tabs[tab];

                    // Si está asociado a un board, aplicamos visibility del board para 'menu'
                    if (single.type !== 'create') {
                        const board = findBoardForSubtab(single, boards);
                        if (board && !shouldShowInArea(board, 'menu')) {
                            return <></>;
                        }
                    }

                    return (
                        <Subtabs
                            key={index}
                            subtabs={[single]}
                            collapsed={collapsed}
                            shortedMatch={shortedMatch}
                        />
                    );
                }

                // Caso: array de subtabs → filtramos por visibility de board en 'menu'
                const tabContent = tabs[tab].filter((subtab) => {
                    if (subtab.type === 'create') return true; // el botón create siempre se ve
                    const board = findBoardForSubtab(subtab, boards);
                    if (!board) return true; // si no está ligado a un board, no filtramos
                    return shouldShowInArea(board, 'menu');
                });

                if (!tabContent.length) return <></>
                return (
                    <Accordion value={collapsed ? ("a" + index) : undefined} collapsible={!collapsed} defaultValue={"a" + index} br={"$6"} overflow="hidden" type="single" key={index}>
                        <Accordion.Item value={"a" + index}>
                            <Accordion.Trigger
                                p={"$2"}
                                backgroundColor={"$backgroundTransparent"}
                                focusStyle={{ backgroundColor: "$backgroundTransparent" }}
                                hoverStyle={{ backgroundColor: '$backgroundTransparent' }}
                                bw={0} flexDirection="row" justifyContent="space-between">
                                {({ open }) => (
                                    //@ts-ignore
                                    <XStack f={1} h="40px" jc="center" p={"$2"} animateOnly={['backgroundColor']} animation="bouncy" br="$4" backgroundColor={isTabSelected(tabContent, shortedMatch) && !open ? (resolvedTheme == "dark" ? '$color2' : '$color4') : '$backgroundTransparent'}>
                                        {!collapsed && <SizableText f={1} ml={"$2.5"} fontWeight="bold" size={"$5"}>{tab}</SizableText>}
                                        {/* @ts-ignore */}
                                        <Square animation="bouncy" rotate={open ? '180deg' : '0deg'}>
                                            {
                                                collapsed
                                                    ? <Minus color="$gray6" size={20} />
                                                    : <ChevronDown color={isTabSelected(tabContent, shortedMatch) && !open ? '$color8' : '$gray9'} size={20} />
                                            }
                                        </Square>
                                    </XStack>
                                )}
                            </Accordion.Trigger>
                            <Accordion.Content position="relative" backgroundColor={"$backgroundTransparent"} pt={'$0'} pb={"$2"} >
                                <Subtabs collapsed={collapsed} subtabs={tabContent} shortedMatch={shortedMatch} />
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                )
            })}
        </YStack> : <></>
    );
};

export const PanelMenu = ({ workspace, boards, collapsed }) => {
    const searchParams = useSearchParams();
    
    const query = Object.fromEntries(searchParams.entries());
    const [state, setState] = useState(query)
    useQueryState(setState)

    return (
        <YStack pt="$3">
            <Tinted>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    pl={"$0"}
                    mah="calc( 100vh - 200px )"
                >
                    <Tabs tabs={workspace.menu} boards={boards} collapsed={collapsed} />
                </ScrollView>
            </Tinted>
        </YStack>
    )
}
