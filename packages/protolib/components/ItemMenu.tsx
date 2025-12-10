import { Popover, Stack, XStack, YStack, Text, StackProps } from "@my/ui"
import { AlertDialog } from './AlertDialog'
import { useState } from "react";
import { Tinted } from "./Tinted";
import { MoreVertical, Trash2, FilePlus } from '@tamagui/lucide-icons'
import { InteractiveIcon } from "./InteractiveIcon";

export const ItemMenu = ({ type, sourceUrl = '', enableAddToInitialData = false, onDelete, element, deleteable, extraMenuActions = [], hideDeleteButton, ...props }: { type: string, sourceUrl: string, enableAddToInitialData?: boolean, onDelete?: any, deleteable?: Function, element: any, extraMenuActions?: any, hideDeleteButton?: boolean } & StackProps) => {
    const [menuOpened, setMenuOpened] = useState(false)
    const [open, setOpen] = useState(false)

    const addToInitialData = ({ data }) => { }

    const MenuButton = ({ id = "", type, text, Icon, onPress, disabled }: { id?: string, type: string, text: string, Icon: any, onPress: any, disabled?: boolean }) => {
        return <XStack id={id} o={1} br={"$5"} p={"$3"} w="100%" als="flex-start"
            cursor={!disabled ? 'pointer' : 'default'}
            pressStyle={!disabled ? { o: 0.7 } : {}}
            hoverStyle={!disabled ? { bc: "$bgPanel" } : {}}
            onPress={(e) => {
                if (!disabled) {
                    onPress(type === "global" ? '*' : element, e)
                    setMenuOpened(false)
                }
            }}>
            <Icon size={"$1"} color={disabled ? "var(--gray9)" : "var(--color9)"} strokeWidth={2} />
            <Text ml={"$3"}>{text}</Text>
        </XStack>
    }

    return <Stack {...props}>
        <AlertDialog
            acceptCaption="Delete"
            setOpen={setOpen}
            open={open}
            onAccept={async (setOpen) => {
                await onDelete(sourceUrl, element.data[element.idField])
                setOpen(false);
            }}
            title={'Delete '}
            description={"Are you sure to delete this item?"}
            w={280}
        >
            <YStack f={1} jc="center" ai="center">

            </YStack>
        </AlertDialog>
        <Popover onOpenChange={setMenuOpened} open={menuOpened} allowFlip>
            <Popover.Trigger>
                <InteractiveIcon id={`more-btn-${sourceUrl.split("/").slice(-1)}`} Icon={MoreVertical} onPress={(e) => { e.stopPropagation(); setMenuOpened(true) }} ml={"$3"}></InteractiveIcon>
            </Popover.Trigger>
            <Popover.Content padding={0} space={0} left={"$7"} top={"$2"} bw={1} boc="$borderColor" br="$6" overflow="hidden" >
                <Tinted>
                    <YStack bc="$bgContent" alignItems="center" justifyContent="center" padding={"$2"} onPress={(e) => e.stopPropagation()}>
                        <YStack>
                            {extraMenuActions.map((action, i) => {
                                return (!action.menus && type === "item" || action.menus && action.menus?.includes(type)) && action.isVisible && action.isVisible(element) && <MenuButton id={`more-btn-${sourceUrl.split("/").slice(-1)}-option-${i + 1}`} type={type} key={i} text={typeof action.text == "function" ? action.text(type) : action.text} Icon={action.icon} onPress={action.action}></MenuButton>
                            })}
                            {false && enableAddToInitialData && <MenuButton type={type} text={"Add to initial data"} Icon={FilePlus} onPress={(data, e) => { e.stopPropagation(); addToInitialData(data), setMenuOpened(false) }}></MenuButton>}
                            {hideDeleteButton ? <></> : <MenuButton type={type} text={"Delete"} id={`more-btn-${sourceUrl.split("/").slice(-1)}-delete`} Icon={Trash2} disabled={!deleteable(element)} onPress={(data, e) => { e.stopPropagation(); setOpen(true); setMenuOpened(false) }}></MenuButton>}
                        </YStack>
                    </YStack>
                </Tinted>
            </Popover.Content>
        </Popover>
    </Stack>
}