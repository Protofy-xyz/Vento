import React, { useState, useEffect } from 'react'
import { YStack, XStack, Button, Text, Stack, useToastController, Spinner } from "@my/ui"
import { Tinted } from 'protolib/components/Tinted'
import { Copy, Check, Smartphone, Download, QrCode } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import { useSession } from 'protolib/lib/useSession'
import QRCode from 'react-qr-code'
import type { NetworkOption } from '../network/options'

// Slide 1: Download APK
const DownloadSlide = ({ apkUrl, networkInfo, loading, onCopy, copied }) => {
    if (loading) {
        return (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$4">
                <Spinner size="large" />
                <Text color="$gray11">Detecting network address...</Text>
            </YStack>
        )
    }

    return (
        <YStack alignItems="center" gap="$6" paddingVertical="$4">
            {/* QR Code */}
            <YStack 
                backgroundColor="white" 
                padding="$4" 
                borderRadius="$4"
                alignItems="center"
                justifyContent="center"
            >
                {apkUrl && (
                    <QRCode 
                        value={apkUrl} 
                        size={200}
                        level="M"
                    />
                )}
            </YStack>

            {/* Instructions */}
            <YStack alignItems="center" gap="$2" maxWidth={500}>
                <XStack alignItems="center" gap="$2">
                    <Download size={20} color="var(--color9)" />
                    <Text fontSize="$5" fontWeight="600" textAlign="center">
                        Step 1: Download Vento Client
                    </Text>
                </XStack>
                <Text fontSize="$3" color="$gray11" textAlign="center">
                    Scan this QR code with your Android device to download the Vento client app.
                </Text>
                {networkInfo?.interface && (
                    <Text fontSize="$2" color="$gray9" textAlign="center">
                        Network: {networkInfo.interface} ({networkInfo.ip})
                    </Text>
                )}
            </YStack>

            {/* URL Display */}
            <YStack 
                backgroundColor="$gray3" 
                padding="$3" 
                borderRadius="$3" 
                width="100%"
                maxWidth={500}
            >
                <Text 
                    fontSize="$2" 
                    color="$gray11" 
                    fontFamily="$mono"
                    textAlign="center"
                    numberOfLines={1}
                >
                    {apkUrl}
                </Text>
            </YStack>

            {/* Copy button */}
            <Button 
                size="$3"
                onPress={onCopy}
                icon={copied ? Check : Copy}
            >
                {copied ? "Copied!" : "Copy Download Link"}
            </Button>
        </YStack>
    )
}

// Slide 2: Connect QR
const ConnectSlide = ({ connectUrl, loading, onCopy, copied }) => {
    if (loading) {
        return (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$4">
                <Spinner size="large" />
                <Text color="$gray11">Generating connection code...</Text>
            </YStack>
        )
    }

    return (
        <YStack alignItems="center" gap="$6" paddingVertical="$4">
            {/* QR Code */}
            <YStack 
                backgroundColor="white" 
                padding="$4" 
                borderRadius="$4"
                alignItems="center"
                justifyContent="center"
            >
                {connectUrl && (
                    <QRCode 
                        value={connectUrl} 
                        size={200}
                        level="M"
                    />
                )}
            </YStack>

            {/* Instructions */}
            <YStack alignItems="center" gap="$2" maxWidth={500}>
                <XStack alignItems="center" gap="$2">
                    <QrCode size={20} color="var(--color9)" />
                    <Text fontSize="$5" fontWeight="600" textAlign="center">
                        Step 2: Connect to Vento
                    </Text>
                </XStack>
                <Text fontSize="$3" color="$gray11" textAlign="center">
                    Open the Vento app on your Android device and tap "Scan to Connect", 
                    then scan this QR code to connect automatically.
                </Text>
            </YStack>

            {/* Info box */}
            <YStack 
                backgroundColor="$green3" 
                padding="$3" 
                borderRadius="$3" 
                width="100%"
                maxWidth={500}
                borderWidth={1}
                borderColor="$green6"
            >
                <Text fontSize="$2" color="$green11" textAlign="center">
                    This QR contains your connection credentials. 
                    Keep it private and don't share it.
                </Text>
            </YStack>
        </YStack>
    )
}

const slides = [
    { name: "Download App", title: "Download Vento Client" },
    { name: "Connect", title: "Connect Your Device" }
]

const AndroidWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const [session] = useSession() as [{ user?: { id?: string }, token?: string }, any]
    const [copied, setCopied] = useState(false)
    const [apkUrl, setApkUrl] = useState('')
    const [connectUrl, setConnectUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [networkInfo, setNetworkInfo] = useState<any>(null)
    const [step, setStep] = useState(0)

    const totalSlides = slides.length
    const currentSlide = slides[step]

    const titlesUpToCurrentStep = slides
        .filter((_, index) => index <= step)
        .map(slide => slide.name)
        .join(" / ")

    useEffect(() => {
        const fetchNetworkAddress = async () => {
            try {
                const result = await API.get('/api/core/v1/netaddr/vento')
                if (result.data && result.data.apkUrl) {
                    setApkUrl(result.data.apkUrl)
                    setNetworkInfo(result.data)
                    
                    // Build connection URL with credentials
                    if (session?.user?.id && session?.token && result.data.baseUrl) {
                        const params = new URLSearchParams({
                            host: result.data.baseUrl,
                            user: session.user.id,
                            token: session.token
                        })
                        setConnectUrl(`vento://connect?${params.toString()}`)
                    }
                } else {
                    // Fallback to window.location if API fails
                    if (typeof window !== 'undefined') {
                        const origin = window.location.origin
                        setApkUrl(`${origin}/public/clients/vento-client.apk`)
                        
                        if (session?.user?.id && session?.token) {
                            const params = new URLSearchParams({
                                host: origin,
                                user: session.user.id,
                                token: session.token
                            })
                            setConnectUrl(`vento://connect?${params.toString()}`)
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to get network address:', err)
                // Fallback to window.location
                if (typeof window !== 'undefined') {
                    const origin = window.location.origin
                    setApkUrl(`${origin}/public/clients/vento-client.apk`)
                    
                    if (session?.user?.id && session?.token) {
                        const params = new URLSearchParams({
                            host: origin,
                            user: session.user.id,
                            token: session.token
                        })
                        setConnectUrl(`vento://connect?${params.toString()}`)
                    }
                }
            } finally {
                setLoading(false)
            }
        }
        
        fetchNetworkAddress()
    }, [session])

    const handleCopy = async () => {
        const urlToCopy = step === 0 ? apkUrl : connectUrl
        try {
            await navigator.clipboard.writeText(urlToCopy)
            setCopied(true)
            toast.show('Copied!', {
                message: step === 0 ? 'Download link copied' : 'Connection URL copied'
            })
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            toast.show('Failed to copy', {
                message: 'Please copy manually'
            })
        }
    }

    const handleBack = () => {
        if (step === 0 && onBack) {
            onBack()
        } else if (step > 0) {
            setStep(step - 1)
        }
    }

    const handleNext = () => {
        if (step < totalSlides - 1) {
            setStep(step + 1)
            setCopied(false)
        } else {
            // Done - close the wizard
            onCreated?.()
        }
    }

    return (
        <YStack padding="$3" paddingTop="$0" width={800} flex={1}>
            <XStack justifyContent="space-between" width="100%">
                <Stack flex={1}>
                    <Text fontWeight={"500"} fontSize={16} color="$gray9">{titlesUpToCurrentStep}</Text>
                </Stack>
                <Stack flex={1} alignItems="flex-end">
                    <Text fontWeight={"500"} fontSize={16} color="$gray9">[{step + 1}/{totalSlides}]</Text>
                </Stack>
            </XStack>

            <Tinted>
                <Stack>
                    <Text fontWeight={"500"} fontSize={30} color="$color">{currentSlide.title}</Text>
                </Stack>
            </Tinted>

            <Stack flex={1} marginTop={"$4"}>
                {step === 0 && (
                    <DownloadSlide 
                        apkUrl={apkUrl} 
                        networkInfo={networkInfo} 
                        loading={loading}
                        onCopy={handleCopy}
                        copied={copied}
                    />
                )}
                {step === 1 && (
                    <ConnectSlide 
                        connectUrl={connectUrl} 
                        loading={loading || !connectUrl}
                        onCopy={handleCopy}
                        copied={copied}
                    />
                )}
            </Stack>

            <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
                <Button width={250} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button width={250} onPress={handleNext}>
                        {step === totalSlides - 1 ? "Done" : "Next"}
                    </Button>
                </Tinted>
            </XStack>
        </YStack>
    )
}

export const androidOption: NetworkOption = {
    id: 'android',
    name: 'Android Device',
    description: 'Connect your Android phone as a network device',
    icon: 'smartphone',
    Component: AndroidWizard
}
