import { Paragraph, Spinner, Stack, Theme, Unspaced, XStack, YStack } from '@my/ui'
import { Button, Dialog, Spacer, getErrorMessage } from '@my/ui'
import { forwardRef, useEffect, useState } from 'react'
import { Tinted } from './Tinted'
import { Notice } from './Notice'
import Center from './Center'

export const AlertDialog = forwardRef(({
    showCancel,
    hideAccept,
    onAccept = () => { },
    onCancel = () => { },
    title,
    trigger,
    description,
    children,
    cancelCaption = 'Cancel',
    acceptCaption = 'Accept',
    acceptTint,
    cancelTint = 'gray',
    acceptButtonProps = {},
    cancelButtonProps = {},
    open,
    setOpen,
    disableDrag = false,
    disableAdapt = false,
    dialogCloseProps = {},
    integratedChat = false,
    preventCloseOnOutsideClick = false,
    ...props
}: any, ref: any) => {

    const [_open, _setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<any>()

    const seter = setOpen !== undefined ? setOpen : _setOpen
    const status = setOpen !== undefined ? open : _open

    useEffect(() => {
        if (!status) {
            setError(undefined)
        }
    }, [status])
    const openState = open !== undefined ? open : _open
    return (<Theme reset>
        <Dialog ref={ref} open={openState} onOpenChange={setOpen !== undefined ? setOpen : _setOpen}>
            {trigger && <Dialog.Trigger>
                {trigger}
            </Dialog.Trigger>}
            <Dialog.Portal >
                <Dialog.Overlay 
                  {...props.overlayProps}
                  onPointerDownOutside={(e) => {
                    // Prevent closing if prop is set or clicking on driver.js tour elements
                    if (preventCloseOnOutsideClick) {
                      e.preventDefault()
                      return
                    }
                    const target = e.target as HTMLElement
                    if (target?.closest?.('#driver-popover-content') || target?.closest?.('.driver-popover')) {
                      e.preventDefault()
                    }
                    props.overlayProps?.onPointerDownOutside?.(e)
                  }}
                />
                <Dialog.Content 
                  scale={1} 
                  p="$7" 
                  ai="flex-start" 
                  jc="flex-start" 
                  onPointerDownOutside={(e) => {
                    // Prevent closing if prop is set or clicking on driver.js tour elements
                    if (preventCloseOnOutsideClick) {
                      e.preventDefault()
                      return
                    }
                    const target = e.target as HTMLElement
                    if (target?.closest?.('#driver-popover-content') || target?.closest?.('.driver-popover')) {
                      e.preventDefault()
                    }
                    props.onPointerDownOutside?.(e)
                  }}
                  onInteractOutside={(e) => {
                    // Prevent closing if prop is set or interacting with driver.js tour elements
                    if (preventCloseOnOutsideClick) {
                      e.preventDefault()
                      return
                    }
                    const target = e.target as HTMLElement
                    if (target?.closest?.('#driver-popover-content') || target?.closest?.('.driver-popover')) {
                      e.preventDefault()
                    }
                    props.onInteractOutside?.(e)
                  }}
                  {...props}>
                    {/* {integratedChat && openState && <Tinted>
                    <BubbleChat/>
                </Tinted> } */}
                    <YStack f={1} width={"100%"}>
                        <YStack f={1}>
                            {title && <XStack width={"100%"} f={1}>
                                <XStack f={1}>
                                    <Dialog.Title>{title}</Dialog.Title>
                                </XStack>
                            </XStack>}
                            {description && <Dialog.Description mt="$3" mb="$6">
                               {description}
                            </Dialog.Description>}

                            {error && (
                                <Notice>
                                    <Paragraph>{getErrorMessage(error.error)}</Paragraph>
                                </Notice>
                            )}

                            <XStack f={1}>
                                {children}
                            </XStack>

                            {!hideAccept && <YStack p="$2" pt="$0" width="100%" f={1} alignSelf="center">
                                <Spacer flex={1} height="$2" />
                                <XStack>
                                    {showCancel &&
                                        <Tinted tint={cancelTint}>
                                            <Button mr="$5" f={1} onPress={async () => {
                                                const keepOpen = await onCancel()
                                                if (keepOpen !== true) seter(false)
                                            }} aria-label="Close" {...cancelButtonProps}>
                                                {cancelCaption}
                                            </Button>
                                        </Tinted>}
                                    <Tinted tint={acceptTint}>
                                        <Button id="alert-dlg-accept" f={1} onPress={async () => {
                                            setLoading(true)
                                            try {
                                                const keepOpen = await onAccept(setOpen !== undefined ? setOpen : _setOpen)
                                                if (keepOpen !== true) seter(false)
                                            } catch (e) {
                                                setError(e)
                                                console.log('e: ', e)
                                            }
                                            setLoading(false)
                                        }} aria-label="Close" {...acceptButtonProps}>
                                            {loading ? <Spinner /> : acceptCaption}
                                        </Button>
                                    </Tinted>
                                </XStack>
                            </YStack>}
                        </YStack>
                    </YStack>
                    <Dialog.Close {...dialogCloseProps} />
                </Dialog.Content>

            </Dialog.Portal>

            {!disableAdapt && <Dialog.Adapt when="sm" >
                <XStack position='absolute'>
                    <Dialog.Sheet disableDrag={disableDrag}>
                        {/* ml -18 because there is an bug centering the dialog on sm screen */}
                        <Dialog.Sheet.Frame ml="-18px">
                            <YStack p={"$5"} pb="$12" f={1}>
                                <Dialog.Adapt.Contents />
                            </YStack>
                        </Dialog.Sheet.Frame>
                        <Dialog.Sheet.Overlay />
                    </Dialog.Sheet>
                </XStack>
            </Dialog.Adapt>}
        </Dialog>
    </Theme>)
})