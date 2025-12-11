import { useState } from 'react'
import { YStack, XStack, Text, Button } from '@my/ui'
import { AlertDialog } from './AlertDialog'
import { Tinted } from './Tinted'
import { Play, X } from '@tamagui/lucide-icons'

const TUTORIAL_VIDEO_ID = 'XC8FLbpMKo8'
const TUTORIAL_VIDEO_URL = `https://www.youtube.com/embed/${TUTORIAL_VIDEO_ID}?autoplay=1&rel=0`

type TutorialVideoDialogProps = {
    open: boolean
    onClose: () => void
    showDontShowAgain?: boolean
    onDontShowAgain?: () => void
}

export const TutorialVideoDialog = ({ 
    open, 
    onClose, 
    showDontShowAgain = false,
    onDontShowAgain 
}: TutorialVideoDialogProps) => {
    return (
        <AlertDialog
            open={open}
            setOpen={(isOpen) => !isOpen && onClose()}
            title="Welcome to Vento!"
            description="Watch this quick tutorial to get started"
            hideAccept
            showCancel
            cancelCaption="Close"
            onCancel={onClose}
            maxWidth={900}
            width="95%"
        >
            <YStack width="100%" gap="$4" py="$2">
                <Tinted>
                    {/* Video container with 16:9 aspect ratio */}
                    <YStack
                        width="100%"
                        borderRadius="$4"
                        overflow="hidden"
                        backgroundColor="$gray1"
                        style={{
                            aspectRatio: '16/9',
                        }}
                    >
                        {open && (
                            <iframe
                                width="100%"
                                height="100%"
                                src={TUTORIAL_VIDEO_URL}
                                title="Vento Tutorial"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                style={{
                                    border: 'none',
                                    borderRadius: 'inherit',
                                }}
                            />
                        )}
                    </YStack>
                </Tinted>

                {showDontShowAgain && onDontShowAgain && (
                    <XStack justifyContent="center" mt="$2">
                        <Button
                            chromeless
                            size="$3"
                            opacity={0.7}
                            hoverStyle={{ opacity: 1 }}
                            onPress={() => {
                                onDontShowAgain()
                                onClose()
                            }}
                        >
                            <Text fontSize="$2" color="$color10">
                                Don't show this again
                            </Text>
                        </Button>
                    </XStack>
                )}
            </YStack>
        </AlertDialog>
    )
}

// Hook to manage tutorial video state with localStorage
export const useTutorialVideo = () => {
    const STORAGE_KEY = 'vento_tutorial_watched'
    
    const hasWatchedTutorial = (): boolean => {
        if (typeof window === 'undefined') return true
        return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    
    const markTutorialAsWatched = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, 'true')
        }
    }
    
    const resetTutorialWatched = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY)
        }
    }
    
    return {
        hasWatchedTutorial,
        markTutorialAsWatched,
        resetTutorialWatched,
    }
}

export default TutorialVideoDialog



