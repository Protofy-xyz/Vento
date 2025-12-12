import React, { useState, useEffect } from 'react'
import { YStack, XStack, Button, Text, Stack, useToastController, Spinner, ScrollView } from "@my/ui"
import { Tinted } from 'protolib/components/Tinted'
import { Copy, Check, Smartphone, Download, QrCode, Wifi, AlertCircle, CheckCircle } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import { useSession } from 'protolib/lib/useSession'
import QRCode from 'react-qr-code'
import type { NetworkOption } from '../network/options'

// Slide 0: Network Verification
const NetworkVerificationSlide = ({ networkInfo, loading }) => {
    if (loading) {
        return (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$4">
                <Tinted>
                    <Spinner size="large" color="$color9" />
                </Tinted>
                <Text color="$gray11">Detecting network...</Text>
            </YStack>
        )
    }

    return (
        <YStack alignItems="center" gap="$6" paddingVertical="$4">
            {/* WiFi Icon */}
            <Tinted>
                <YStack 
                    backgroundColor="$color3" 
                    padding="$6" 
                    borderRadius={100}
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={2}
                    borderColor="$color6"
                >
                    <Wifi size={64} color="var(--color9)" />
                </YStack>
            </Tinted>

            {/* Instructions */}
            <YStack alignItems="center" gap="$2" maxWidth={500}>
                <Tinted>
                    <XStack alignItems="center" gap="$2">
                        <Wifi size={20} color="var(--color9)" />
                        <Text fontSize="$5" fontWeight="600" textAlign="center" color="$color11">
                            Verify WiFi Connection
                        </Text>
                    </XStack>
                </Tinted>
                <Text fontSize="$3" color="$gray11" textAlign="center">
                    Make sure your Android device is connected to the same WiFi network as Vento.
                </Text>
            </YStack>

            {/* Network Info Box */}
            <Tinted>
                <YStack 
                    backgroundColor="$color3" 
                    padding="$4" 
                    borderRadius="$4" 
                    width="100%"
                    maxWidth={500}
                    gap="$3"
                    borderWidth={1}
                    borderColor="$color6"
                >
                    <XStack alignItems="center" gap="$2">
                        <CheckCircle size={18} color="var(--color9)" />
                        <Text fontSize="$4" fontWeight="600" color="$color11">
                            Vento Network Information
                        </Text>
                    </XStack>
                    
                    <YStack gap="$2" paddingLeft="$6">
                        {networkInfo?.interface && (
                            <XStack gap="$2">
                                <Text fontSize="$3" color="$color10" width={100}>Interface:</Text>
                                <Text fontSize="$3" color="$color12" fontFamily="$mono">{networkInfo.interface}</Text>
                            </XStack>
                        )}
                        {networkInfo?.ip && (
                            <XStack gap="$2">
                                <Text fontSize="$3" color="$color10" width={100}>IP Address:</Text>
                                <Text fontSize="$3" color="$color12" fontFamily="$mono">{networkInfo.ip}</Text>
                            </XStack>
                        )}
                        {networkInfo?.baseUrl && (
                            <XStack gap="$2">
                                <Text fontSize="$3" color="$color10" width={100}>Server URL:</Text>
                                <Text fontSize="$3" color="$color12" fontFamily="$mono" numberOfLines={1}>{networkInfo.baseUrl}</Text>
                            </XStack>
                        )}
                    </YStack>
                </YStack>
            </Tinted>

            {/* Remote control info note */}
            <YStack 
                backgroundColor="$gray3" 
                padding="$3" 
                borderRadius="$3" 
                width="100%"
                maxWidth={500}
                borderWidth={1}
                borderColor="$gray6"
            >
                <XStack alignItems="flex-start" gap="$2">
                    <Smartphone size={16} color="var(--gray11)" marginTop={2} />
                    <YStack flex={1} gap="$1">
                        <Text fontSize="$2" fontWeight="600" color="$gray11">
                            Remote Control Capabilities
                        </Text>
                        <Text fontSize="$2" color="$gray11">
                            The Vento client app enables remote control features such as camera access, 
                            screenshots, location tracking, and shell commands. These capabilities are 
                            essential for Vento to work as intended, but please be aware that your device 
                            can be controlled remotely once connected. You can always deny permissions when 
                            prompted or revoke them later in your device settings if you no longer wish to use them.
                        </Text>
                    </YStack>
                </XStack>
            </YStack>

            {/* Warning box */}
            <YStack 
                backgroundColor="$yellow3" 
                padding="$3" 
                borderRadius="$3" 
                width="100%"
                maxWidth={500}
                borderWidth={1}
                borderColor="$yellow6"
            >
                <XStack alignItems="flex-start" gap="$2">
                    <AlertCircle size={16} color="var(--yellow11)" marginTop={2} />
                    <Text fontSize="$2" color="$yellow11" flex={1}>
                        Your phone must be on the same WiFi network to scan the QR codes and connect. 
                        Check your phone's WiFi settings before continuing.
                    </Text>
                </XStack>
            </YStack>
        </YStack>
    )
}

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
                        Step 2: Download Vento Client
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
                        Step 3: Connect to Vento
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
    { name: "Network Check", title: "Verify WiFi Connection" },
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
        const urlToCopy = step === 1 ? apkUrl : connectUrl
        try {
            await navigator.clipboard.writeText(urlToCopy)
            setCopied(true)
            toast.show('Copied!', {
                message: step === 1 ? 'Download link copied' : 'Connection URL copied'
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
        <YStack padding="$3" paddingTop="$0" width="100%" maxWidth={800} maxHeight="80vh">
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

            <ScrollView flex={1} marginTop={"$4"} showsVerticalScrollIndicator={true}>
                <Stack paddingBottom="$4">
                    {step === 0 && (
                        <NetworkVerificationSlide 
                            networkInfo={networkInfo} 
                            loading={loading}
                        />
                    )}
                    {step === 1 && (
                        <DownloadSlide 
                            apkUrl={apkUrl} 
                            networkInfo={networkInfo} 
                            loading={loading}
                            onCopy={handleCopy}
                            copied={copied}
                        />
                    )}
                    {step === 2 && (
                        <ConnectSlide 
                            connectUrl={connectUrl} 
                            loading={loading || !connectUrl}
                            onCopy={handleCopy}
                            copied={copied}
                        />
                    )}
                </Stack>
            </ScrollView>

            <XStack gap="$4" justifyContent='center' marginTop="$3" marginBottom={"$1"} flexWrap="wrap">
                <Button minWidth={200} flex={1} maxWidth={250} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button minWidth={200} flex={1} maxWidth={250} onPress={handleNext}>
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
