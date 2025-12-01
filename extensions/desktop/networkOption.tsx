import React, { useState, useEffect } from 'react'
import { YStack, XStack, Button, Text, Stack, useToastController, Spinner, Select } from "@my/ui"
import { Tinted } from 'protolib/components/Tinted'
import { Copy, Check, Monitor, Download, ChevronDown } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import type { NetworkOption } from '../network/options'

type Platform = {
    id: string
    name: string
    file: string
}

const platforms: Platform[] = [
    { id: 'windows-amd64', name: 'Windows (64-bit)', file: 'ventoagent-windows-amd64.exe' },
    { id: 'windows-arm64', name: 'Windows (ARM64)', file: 'ventoagent-windows-arm64.exe' },
    { id: 'darwin-amd64', name: 'macOS (Intel)', file: 'ventoagent-darwin-amd64' },
    { id: 'darwin-arm64', name: 'macOS (Apple Silicon)', file: 'ventoagent-darwin-arm64' },
    { id: 'linux-amd64', name: 'Linux (64-bit)', file: 'ventoagent-linux-amd64' },
    { id: 'linux-arm64', name: 'Linux (ARM64)', file: 'ventoagent-linux-arm64' },
    { id: 'linux-armv7', name: 'Linux (ARMv7)', file: 'ventoagent-linux-armv7' },
]

const detectPlatform = (): string => {
    if (typeof navigator === 'undefined') return 'windows-amd64'
    
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform?.toLowerCase() || ''
    
    // Detect OS
    let os = 'windows'
    if (userAgent.includes('mac') || platform.includes('mac')) {
        os = 'darwin'
    } else if (userAgent.includes('linux') || platform.includes('linux')) {
        os = 'linux'
    }
    
    // Detect architecture
    let arch = 'amd64'
    if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
        arch = 'arm64'
    } else if (userAgent.includes('arm')) {
        arch = 'armv7'
    }
    
    // Special case for Apple Silicon Macs
    if (os === 'darwin') {
        // Check if running on Apple Silicon
        // Modern browsers on Apple Silicon report arm64
        if (platform.includes('arm') || userAgent.includes('arm')) {
            arch = 'arm64'
        }
    }
    
    const platformId = `${os}-${arch}`
    
    // Validate platform exists
    const exists = platforms.find(p => p.id === platformId)
    return exists ? platformId : 'windows-amd64'
}

const DesktopWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const [copied, setCopied] = useState(false)
    const [loading, setLoading] = useState(true)
    const [baseUrl, setBaseUrl] = useState('')
    const [networkInfo, setNetworkInfo] = useState<any>(null)
    const [selectedPlatform, setSelectedPlatform] = useState<string>(detectPlatform())

    const currentPlatform = platforms.find(p => p.id === selectedPlatform) || platforms[0]
    const downloadUrl = baseUrl ? `${baseUrl}/public/clients/desktop/${currentPlatform.file}` : ''

    useEffect(() => {
        const fetchNetworkAddress = async () => {
            try {
                const result = await API.get('/api/core/v1/netaddr/vento')
                if (result.data && result.data.baseUrl) {
                    setBaseUrl(result.data.baseUrl)
                    setNetworkInfo(result.data)
                } else {
                    // Fallback to window.location if API fails
                    if (typeof window !== 'undefined') {
                        setBaseUrl(window.location.origin)
                    }
                }
            } catch (err) {
                console.error('Failed to get network address:', err)
                // Fallback to window.location
                if (typeof window !== 'undefined') {
                    setBaseUrl(window.location.origin)
                }
            } finally {
                setLoading(false)
            }
        }
        
        fetchNetworkAddress()
    }, [])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(downloadUrl)
            setCopied(true)
            toast.show('Copied!', {
                message: 'Download URL copied to clipboard'
            })
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            toast.show('Failed to copy', {
                message: 'Please copy manually'
            })
        }
    }

    const handleBack = () => {
        if (onBack) {
            onBack()
        }
    }

    const handleDone = () => {
        onCreated?.()
    }

    if (loading) {
        return (
            <YStack padding="$3" paddingTop="$0" width={700} flex={1} alignItems="center" justifyContent="center" gap="$4">
                <Spinner size="large" />
                <Text color="$gray11">Detecting network address...</Text>
            </YStack>
        )
    }

    return (
        <YStack padding="$3" paddingTop="$0" width={700} flex={1}>
            <Tinted>
                <Stack marginBottom="$2">
                    <Text fontWeight="500" fontSize={30} color="$color">Download Desktop Agent</Text>
                </Stack>
            </Tinted>

            <Text marginBottom="$6" fontSize="$3" color="$gray9">
                Download the Vento agent for your computer. Copy the URL below and paste it in the browser of the target machine to download.
            </Text>

            <YStack alignItems="center" gap="$6" paddingVertical="$4" flex={1}>
                {/* Platform selector */}
                <YStack gap="$2" width="100%" maxWidth={500}>
                    <Text fontSize="$4" fontWeight="600" color="$gray11">Select Platform</Text>
                    <Select
                        value={selectedPlatform}
                        onValueChange={setSelectedPlatform}
                        size="$4"
                    >
                        <Select.Trigger iconAfter={ChevronDown}>
                            <Select.Value placeholder="Select platform" />
                        </Select.Trigger>
                        <Select.Content zIndex={200000}>
                            <Select.ScrollUpButton />
                            <Select.Viewport>
                                {platforms.map((platform, i) => (
                                    <Select.Item key={platform.id} index={i} value={platform.id}>
                                        <Select.ItemText>{platform.name}</Select.ItemText>
                                    </Select.Item>
                                ))}
                            </Select.Viewport>
                            <Select.ScrollDownButton />
                        </Select.Content>
                    </Select>
                </YStack>

                {/* Download URL display */}
                <YStack gap="$2" width="100%" maxWidth={500}>
                    <XStack alignItems="center" gap="$2">
                        <Download size={20} color="var(--color9)" />
                        <Text fontSize="$4" fontWeight="600" color="$gray11">Download URL</Text>
                    </XStack>
                    <YStack 
                        backgroundColor="$gray3" 
                        padding="$3" 
                        borderRadius="$3" 
                        width="100%"
                    >
                        <Text 
                            fontSize="$2" 
                            color="$gray11" 
                            fontFamily="$mono"
                            wordWrap="break-word"
                        >
                            {downloadUrl}
                        </Text>
                    </YStack>
                    {networkInfo?.interface && (
                        <Text fontSize="$2" color="$gray9">
                            Network: {networkInfo.interface} ({networkInfo.ip})
                        </Text>
                    )}
                </YStack>

                {/* Copy button */}
                <Button 
                    size="$4"
                    onPress={handleCopy}
                    icon={copied ? Check : Copy}
                >
                    {copied ? "Copied!" : "Copy Download URL"}
                </Button>

                {/* Instructions */}
                <YStack 
                    backgroundColor="$blue3" 
                    padding="$3" 
                    borderRadius="$3" 
                    width="100%"
                    maxWidth={500}
                    borderWidth={1}
                    borderColor="$blue6"
                    gap="$2"
                >
                    <Text fontSize="$3" fontWeight="600" color="$blue11">Instructions:</Text>
                    <Text fontSize="$2" color="$blue11">
                        1. Copy the URL above
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                        2. Open a browser on the target computer
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                        3. Paste the URL and download the agent
                    </Text>
                    <Text fontSize="$2" color="$blue11">
                        4. Run the downloaded agent to connect
                    </Text>
                </YStack>
            </YStack>

            <XStack gap={40} justifyContent='center' marginTop="$4" alignItems="flex-end">
                <Button width={200} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button width={200} onPress={handleDone}>
                        Done
                    </Button>
                </Tinted>
            </XStack>
        </YStack>
    )
}

export const desktopOption: NetworkOption = {
    id: 'desktop',
    name: 'Desktop Agent',
    description: 'Download agent for Windows, macOS or Linux computers',
    icon: 'monitor',
    Component: DesktopWizard
}

