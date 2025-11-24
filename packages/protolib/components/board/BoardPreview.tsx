import { YStack, Text, XStack, Tooltip, Paragraph, Dialog, Label, Input, Button, TooltipSimple } from '@my/ui';
import { Tinted } from '../Tinted';
import { Sparkles, Cog, Type, LayoutTemplate, AlertTriangle, X } from "@tamagui/lucide-icons";
import { BoardModel } from '@extensions/boards/boardsSchemas';
import { useRouter } from 'solito/navigation';
import { getIconUrl } from '../IconSelect';
import { ItemMenu } from '../ItemMenu';
import { useState } from 'react';
import { API } from 'protobase';
import { Toggle } from '../Toggle';
import { Workflow, LayoutDashboard, Presentation } from "@tamagui/lucide-icons";
import { InteractiveIcon } from 'protolib/components/InteractiveIcon'
import { shouldShowInArea } from 'protolib/helpers/Visibility';

const Chip = ({ name }: { name: string }) => (
    <XStack key={name} ai="center" br="$10" px="$3" py="$1.5" bg="$bgContent"
        mr="$2" mb="$2" maxWidth={220} overflow="hidden">
        <Text numberOfLines={1} ellipsizeMode="tail">{name}</Text>
    </XStack>
);

export default ({ element, width, onDelete, ...props }: any) => {
    const board = new BoardModel(element);
    const [editSettingsDialog, seteditSettingsDialog] = useState(false);
    const [createTemplateDialog, setCreateTemplateDialog] = useState(false);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [description, setDescription] = useState('');
    const [templateName, setTemplateName] = useState(selectedBoard?.data.name);
    const [displayName, setDisplayName] = useState(board?.get("displayName") ?? '');
    const [tags, setTags] = useState<string[]>(board.get("tags") ?? []);
    const [newTag, setNewTag] = useState('');

    const initialHidden = !shouldShowInArea(element, 'agents');
    const [hidden, setHidden] = useState<boolean>(initialHidden);

    const router = useRouter();

    const navIcons = [
        { key: 'graph' as const, label: 'Graph', Icon: Workflow },
        { key: 'board' as const, label: 'Dashboard', Icon: LayoutDashboard },
        { key: 'ui' as const, label: 'Presentation', Icon: Presentation },
    ];

    const goToView = (key: 'graph' | 'board' | 'ui', e: any) => {
        e.stopPropagation?.();
        e.preventDefault?.();

        const boardName = board.get('name');
        router.push(`/boards/view?board=${boardName}#${key}`);
    };
    const handleRemoveTag = (tagToRemove: string) => {
        setTags((prev) => prev.filter((t) => t !== tagToRemove));
    };

    const handleAddTag = () => {
        const value = newTag.trim();
        if (!value) return;
        if (tags.includes(value)) {
            setNewTag('');
            return;
        }
        setTags((prev) => [...prev, value]);
        setNewTag('');
    };

    return (
        <YStack
            cursor="default"
            bg="$bgPanel"
            elevation={4}
            br="$4"
            width={'100%'}
            f={1}
            display="flex"
            maxWidth={width ?? 474}
            p="$4"
            gap="$4"
            pointerEvents={editSettingsDialog || createTemplateDialog ? 'none' : 'auto'}
            {...props}
        >
            {hidden && (
                <Tinted>
                    <TooltipSimple
                        label="This board is hidden from default views. You can still see it when showing boards from all views."
                        delay={{ open: 500, close: 0 }}
                        restMs={0}
                    >
                        <XStack pos='absolute' gap="$2" right="14px" top="-10px" jc="center" ai="center" br="$2" bg="$yellow9" px="$2" py="$1" >
                            <AlertTriangle color={"black"} size={14} />
                            <Text color={"black"} fow="600" fos="$1">
                                Hidden board
                            </Text>
                        </XStack>
                    </TooltipSimple>
                </Tinted>
            )}

            <XStack jc={"space-between"} ai={"start"} >
                <XStack gap="$2" ai={"start"} >
                    <YStack>
                        <Text fos="$8" fow="600" maw={(width ?? 474) - 100} overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>
                            {board?.get("displayName") ?? board?.get("name")}
                        </Text>
                        <Text fos="$2" fow="600" >{board?.get("name")}</Text>
                    </YStack>
                </XStack>
                <XStack
                    ai={"center"}
                    onClick={(e) => { e.stopPropagation?.(); e.preventDefault?.(); }}
                    onPointerDown={(e) => { e.stopPropagation?.(); }}
                    onMouseDown={(e) => { e.stopPropagation?.(); }}
                    onPress={(e) => { e.stopPropagation?.(); }}
                >
                    <Tinted><Sparkles color={board.get("autopilot") ? "$color8" : "$gray8"} /></Tinted>

                    <ItemMenu
                        type={"item"}
                        mt={"1px"}
                        ml={"-5px"}
                        element={board}
                        deleteable={() => true}
                        onDelete={onDelete}
                        extraMenuActions={[
                            {
                                text: "Settings",
                                icon: Cog,
                                action: (element) => {
                                    const data = element.data ?? element;
                                    seteditSettingsDialog(true);
                                    setSelectedBoard({ data });

                                    const isHidden = !shouldShowInArea(data, 'agents');
                                    setHidden(isHidden);

                                    setDisplayName(
                                        data.displayName ??
                                        data.name ??
                                        ''
                                    );

                                    setTags(data.tags ?? []);
                                    setNewTag('');
                                },
                                isVisible: () => true
                            },
                            {
                                text: "Create template",
                                icon: LayoutTemplate,
                                action: (element) => { setCreateTemplateDialog(true); setSelectedBoard(element) },
                                isVisible: () => true
                            }
                        ]}
                    />
                </XStack>
            </XStack>

            <XStack
                gap="$3"
                ai="center"
                jc="flex-start"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                mb="$2"
            >
                <Tinted>
                    {navIcons.map(({ key, Icon, label }) => (
                        <InteractiveIcon
                            key={key}
                            Icon={Icon}
                            IconColor="var(--color10)"
                            hoverStyle={{ bc: "var(--color5)" }}
                            pressStyle={{ o: 0.8 }}
                            size={30}
                            tooltip={label}
                            onClick={(e) => goToView(key, e)}
                        />
                    ))}
                </Tinted>
            </XStack>
            <YStack gap="$2">
                <Text fow="600">Content</Text>
                {
                    board?.get("cards")?.length
                        ? <XStack gap="$2" f={1} mah={"$9"} flexWrap="wrap" overflow="auto">
                            {board.get("cards")?.filter(i => i).map((card: any, index: number) => (
                                <Tinted key={card.name}>
                                    <Tooltip>
                                        <Tooltip.Trigger>
                                            <YStack h={"$3"} w={"$3"} br={card.type == "action" ? "$10" : "$2"} jc={"center"} ai={"center"} bc={card.color ?? "$color6"} >
                                                <img
                                                    src={getIconUrl(card.icon)}
                                                    width={20}
                                                    height={20}
                                                />
                                            </YStack>
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>
                                            <Tooltip.Arrow />
                                            <Paragraph fow="600">{card.type}</Paragraph>
                                            <Paragraph>{card.name}</Paragraph>
                                        </Tooltip.Content>
                                    </Tooltip>
                                </Tinted>
                            ))}
                        </XStack>
                        : <Text color={"$color9"}>No values</Text>
                }
            </YStack>
            <YStack gap="$2" >
                <Text fow="600">Tags</Text>
                <XStack flexWrap="wrap">
                    {board?.get("tags")?.length
                        ? board.get("tags")?.map((tag: string, index: number) => (
                            <Tinted key={index}>
                                <Chip name={tag} />
                            </Tinted>
                        ))
                        : <Text color={"$color9"}>No tags</Text>
                    }
                </XStack>
            </YStack>

            <Dialog key={selectedBoard?.id} open={createTemplateDialog} onOpenChange={setCreateTemplateDialog}>
                <Dialog.Portal className='DialogPopup'>
                    <Dialog.Overlay className='DialogPopup' />
                    <Dialog.Content overflow="hidden" p={"$8"} height={'400px'} width={"400px"} className='DialogPopup'
                        onClick={(e) => { e.stopPropagation(); }}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                        onPointerDown={(e) => { e.stopPropagation(); }}>
                        <YStack height="100%" justifyContent="space-between">
                            <Text fos="$8" fow="600" mb="$3" className='DialogPopup'>Agent Template</Text>
                            <XStack ai={"center"} className='DialogPopup'>
                                <Label ml={"$2"} h={"$3.5"} size={"$5"} className='DialogPopup'>Name</Label>
                            </XStack>
                            <Input
                                br={"8px"}
                                className='DialogPopup'
                                value={templateName}
                                // color={error ? '$red9' : null}
                                onChange={(e) => {
                                    setTemplateName(e.target.value);
                                }}
                            />

                            <XStack ai={"center"} className='DialogPopup'>
                                <Label ml={"$2"} h={"$3.5"} size={"$5"} className='DialogPopup'>Description</Label>
                            </XStack>
                            <Input
                                br={"8px"}
                                className='DialogPopup'
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                }}
                            />

                            <YStack flex={1} className='DialogPopup' />
                            <Button className='DialogPopup'
                                onMouseDown={(e) => { e.stopPropagation(); }}
                                onPointerDown={(e) => { e.stopPropagation(); }} onPress={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await API.post(`/api/core/v2/templates/boards`, {
                                            name: templateName,
                                            description,
                                            from: selectedBoard?.data?.name
                                        })
                                        setSelectedBoard(null);
                                        setCreateTemplateDialog(false);
                                    } catch (e) {
                                        console.log('e: ', e)
                                    }
                                }}>Create
                            </Button>
                        </YStack>
                        <Dialog.Close />
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog>


            <Dialog open={editSettingsDialog} onOpenChange={seteditSettingsDialog}>
                <Dialog.Portal className='DialogPopup'>
                    <Dialog.Overlay className='DialogPopup' />
                    <Dialog.Content
                        overflow="auto"
                        p="$8"
                        width={420}
                        maxHeight="80vh"
                        className='DialogPopup'
                    >
                        <Tinted>
                            <YStack gap="$4">
                                <Text fos="$8" fow="600" mb="$3" className='DialogPopup'>Settings</Text>
                                <XStack ai={"center"} className='DialogPopup'>
                                    <Label ml={"$2"} h={"$3.5"} size={"$5"} className='DialogPopup'> <Type color={"$color8"} mr="$2" />Display Name</Label>
                                </XStack>
                                <Input
                                    br={"8px"}
                                    className='DialogPopup'
                                    value={displayName}
                                    onChange={(e) => {
                                        setDisplayName(e.target.value);
                                    }}
                                />

                                <XStack
                                    ai="center"
                                    gap="$2"
                                    mt="$4"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                    onMouseDown={(e) => { e.stopPropagation(); }}
                                    onPointerDown={(e) => { e.stopPropagation(); }}
                                >
                                    <Label h={"$3.5"} size={"$5"}>Hide board</Label>
                                    <Toggle
                                        checked={hidden}
                                        onChange={(next) => {
                                            setHidden(next);
                                            setSelectedBoard(prev => {
                                                if (!prev) return prev;
                                                const updatedVisibility = next ? [] : undefined;
                                                return {
                                                    data: {
                                                        ...prev.data,
                                                        visibility: updatedVisibility,
                                                    },
                                                };
                                            });
                                        }}
                                    />
                                </XStack>
                                <YStack mt="$4" gap="$2" className='DialogPopup'>
                                    <Label ml="$2" h="$3.5" size="$5" className='DialogPopup'>
                                        Tags
                                    </Label>

                                    <XStack flexWrap="wrap">
                                        {tags.length ? (
                                            tags.map((tag) => (
                                                <XStack
                                                    key={tag}
                                                    ai="center"
                                                    br="$10"
                                                    px="$3"
                                                    py="$1.5"
                                                    gap="$2"
                                                    bg="$bgContent"
                                                    hoverStyle={{ bg: "$color4" }}
                                                    mr="$2"
                                                    mb="$2"
                                                    maxWidth={220}
                                                    overflow="hidden"
                                                >
                                                    <Text numberOfLines={1} ellipsizeMode="tail">
                                                        {tag}
                                                    </Text>
                                                    <Button
                                                        size="$1"
                                                        circular
                                                        bg="$color6"
                                                        hoverStyle={{ bg: "$color6" }}
                                                        icon={X}
                                                        scaleIcon={0.8}
                                                        onPress={() => handleRemoveTag(tag)}
                                                        aria-label={`Remove ${tag}`}
                                                    />
                                                </XStack>
                                            ))
                                        ) : (
                                            <Text color="$color9">No tags</Text>
                                        )}
                                    </XStack>

                                    <XStack mt="$2" gap="$2" ai="center">
                                        <Input
                                            br="8px"
                                            className='DialogPopup'
                                            f={1}
                                            value={newTag}
                                            placeholder="Add tag"
                                            onChange={(e) => setNewTag(e.target.value)}
                                        />
                                        <Button
                                            size="$2"
                                            className='DialogPopup'
                                            onPress={handleAddTag}
                                        >
                                            Add
                                        </Button>
                                    </XStack>
                                </YStack>

                                <Button
                                    className='DialogPopup'
                                    onPress={async () => {
                                        try {
                                            if (!selectedBoard?.data) return;
                                            const payload = {
                                                ...selectedBoard.data,
                                                displayName: displayName || selectedBoard.data.displayName || selectedBoard.data.name,
                                                tags,
                                            };
                                            await API.post(
                                                `/api/core/v1/boards/${selectedBoard.data.name}`,
                                                payload
                                            );
                                            setSelectedBoard(null);
                                            seteditSettingsDialog(false);
                                        } catch (e) {
                                            console.log('e: ', e);
                                        }
                                    }}
                                >
                                    Save
                                </Button>
                            </YStack>
                        </Tinted>
                        <Dialog.Close />
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog>
        </YStack>
    )
}
