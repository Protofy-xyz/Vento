import React, { useEffect, useMemo, useState } from 'react'
import { YStack, XStack, Button, Text, Stack, useToastController, Spinner, Input, Select } from "@my/ui"
import { Tinted } from 'protolib/components/Tinted'
import { Copy, Check, Terminal, Download, ChevronDown } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import { useSession } from 'protolib/lib/useSession'
import type { NetworkOption } from '../network/options'

type PiTemplate = {
    name: string
    description: string
    highlights: string[]
    buildScript: (ctx: TemplateContext) => string
}

type TemplateContext = {
    host: string
    token: string
    username: string
    deviceName: string
    downloadUrl: string
}

type Platform = {
    id: string
    name: string
    file: string
}

const piPlatforms: Platform[] = [
    { id: 'linux-arm64', name: 'Raspberry Pi 4 / 5 (64-bit)', file: 'ventoagent-linux-arm64' },
    { id: 'linux-armv7', name: 'Raspberry Pi 2 / 3 (32-bit)', file: 'ventoagent-linux-armv7' },
]

const detectPiPlatform = (): string => {
    if (typeof navigator === 'undefined') return piPlatforms[0].id

    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('armv7') || userAgent.includes('armv6')) {
        return 'linux-armv7'
    }
    return 'linux-arm64'
}

const buildGoAgentScript = (ctx: TemplateContext) => {
    const deviceName = ctx.deviceName || '<DEVICE_NAME>'
    const downloadUrl = ctx.downloadUrl || `${ctx.host}/public/clients/desktop/ventoagent-linux-arm64`
    const lines = [
        '# Download and configure ventoagent (Go)',
        'sudo apt update && sudo apt install -y curl',
        `curl -fsSL ${downloadUrl} -o ventoagent`,
        'chmod +x ventoagent',
        '# Run the agent with your current server credentials',
        `sudo ./ventoagent -host ${ctx.host} -token ${ctx.token} -user ${ctx.username} -device ${deviceName} -no-gui -no-tray`
    ]

    return lines.join('\n')
}

const pythonTemplate: PiTemplate = {
    name: 'Vento Go Agent for Raspberry Pi',
    description: 'Install the precompiled ventoagent binary served by this Vento instance and link your Raspberry Pi as a device.',
    highlights: [
        'Downloads the correct ARM binary directly from your current Vento server.',
        'Includes a ready-to-run command with host, token, username, and device name.',
        'Runs ventoagent in headless mode (-no-gui -no-tray) optimized for Raspberry Pi.',
        'Device name is embedded so you can instantly recognize the Pi once it connects.'
    ],
    buildScript: buildGoAgentScript
}

const CommandBlock = ({ label, value, icon: Icon }: { label: string, value: string, icon: React.ComponentType<{ size?: number, color?: string }> }) => (
    <YStack gap="$2" width="100%" maxWidth={600}>
        <XStack alignItems="center" gap="$2">
            <Icon size={20} color="var(--color9)" />
            <Text fontSize="$4" fontWeight="600" color="$gray11">{label}</Text>
        </XStack>
        <YStack backgroundColor="$gray3" padding="$3" borderRadius="$3">
            <Text
                fontSize="$2"
                color="$gray11"
                fontFamily="$mono"
                whiteSpace="pre-wrap"
            >
                {value}
            </Text>
        </YStack>
    </YStack>
)

const RaspberryPiWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const [session] = useSession() as [{ user?: { id?: string }, token?: string }, any]
    const [loading, setLoading] = useState(true)
    const [baseUrl, setBaseUrl] = useState('')
    const [networkInfo, setNetworkInfo] = useState<any>(null)
    const [copied, setCopied] = useState(false)
    const [deviceName, setDeviceName] = useState('')
    const [selectedPlatform, setSelectedPlatform] = useState<string>(detectPiPlatform())

    const resolvedHost = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

    const template = pythonTemplate

    const scriptHost = resolvedHost || 'http://localhost:8000'
    const scriptToken = session?.token || '<VENTO_TOKEN>'
    const scriptUsername = session?.user?.id || '<VENTO_USER>'
    const currentPlatform = piPlatforms.find(p => p.id === selectedPlatform) || piPlatforms[0]
    const downloadUrl = `${scriptHost}/public/clients/desktop/${currentPlatform.file}`

    const trimmedDeviceName = deviceName.trim()
    const isDeviceNameValid = trimmedDeviceName ? /^[A-Za-z][A-Za-z0-9_]*$/.test(trimmedDeviceName) : false

    const setupScript = useMemo(() => {
        if (!isDeviceNameValid) return ''
        return template.buildScript({
            host: scriptHost,
            token: scriptToken,
            username: scriptUsername,
            deviceName: trimmedDeviceName,
            downloadUrl
        })
    }, [template, scriptHost, scriptToken, scriptUsername, trimmedDeviceName, isDeviceNameValid, downloadUrl])

    useEffect(() => {
        const fetchNetworkAddress = async () => {
            try {
                const result = await API.get('/api/core/v1/netaddr/vento')
                if (result.data && result.data.baseUrl) {
                    setBaseUrl(result.data.baseUrl)
                    setNetworkInfo(result.data)
                } else if (typeof window !== 'undefined') {
                    setBaseUrl(window.location.origin)
                }
            } catch (err) {
                console.error('Failed to get network address:', err)
                if (typeof window !== 'undefined') {
                    setBaseUrl(window.location.origin)
                }
            } finally {
                setLoading(false)
            }
        }

        fetchNetworkAddress()
    }, [])

    const handleCopyScript = async () => {
        if (!setupScript) return
        try {
            await navigator.clipboard.writeText(setupScript)
            setCopied(true)
            toast.show('Copied!', { message: 'Script copied to clipboard' })
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.show('Failed to copy', { message: 'Unable to copy the script' })
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
            <YStack padding="$3" paddingTop="$0" width={700} flex={1} alignItems="center" justifyContent="center" gap="$4" maxHeight="80vh">
                <Spinner size="large" />
                <Text color="$gray11">Detecting network address...</Text>
            </YStack>
        )
    }

    return (
        <YStack padding="$3" paddingTop="$0" width={700} flex={1} maxHeight="80vh" overflow="auto">
            <Tinted>
                <Stack marginBottom="$2">
                    <Text fontWeight="500" fontSize={30} color="$color">Set up your Raspberry Pi</Text>
                </Stack>
            </Tinted>

            <Text marginBottom="$6" fontSize="$3" color="$gray9">
                Provide a device name and copy the script to install the Python GPIO agent on your Raspberry Pi. The script already includes your server URL and current token.
            </Text>

            <YStack gap="$4" alignItems="center">
                <YStack gap="$2" width="100%" maxWidth={600}>
                    <Text fontSize="$4" fontWeight="600" color="$gray11">Device name</Text>
                    <Input
                        value={deviceName}
                        onChangeText={setDeviceName}
                        placeholder="LabPi_01"
                    />
                    <Text fontSize="$2" color="$gray9">
                        Use letters, numbers or underscores. The name must start with a letter and is embedded in every command so the new device is easy to identify.
                    </Text>
                    {deviceName.length > 0 && !isDeviceNameValid && (
                        <Text fontSize="$2" color="$red10">
                            Device names must start with a letter and can only contain English letters, numbers, or underscores.
                        </Text>
                    )}
                </YStack>

                <YStack
                    gap="$2"
                    width="100%"
                    maxWidth={600}
                    padding="$3"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="$gray5"
                    backgroundColor="$gray2"
                >
                    <Text fontSize="$4" fontWeight="600" color="$gray11">{template.name}</Text>
                    <Text fontSize="$2" color="$gray11">
                        {template.description}
                    </Text>
                </YStack>

                <YStack gap="$2" width="100%" maxWidth={600}>
                    <Text fontSize="$4" fontWeight="600" color="$gray11">Architecture</Text>
                    <Select
                        value={selectedPlatform}
                        onValueChange={setSelectedPlatform}
                        size="$4"
                    >
                        <Select.Trigger iconAfter={ChevronDown}>
                            <Select.Value placeholder="Select architecture" />
                        </Select.Trigger>
                        <Select.Content zIndex={200000}>
                            <Select.ScrollUpButton />
                            <Select.Viewport>
                                {piPlatforms.map((platform, index) => (
                                    <Select.Item key={platform.id} index={index} value={platform.id}>
                                        <Select.ItemText>{platform.name}</Select.ItemText>
                                    </Select.Item>
                                ))}
                            </Select.Viewport>
                            <Select.ScrollDownButton />
                        </Select.Content>
                    </Select>
                </YStack>

                <CommandBlock label="Download URL" value={downloadUrl} icon={Download} />

                {networkInfo?.interface && (
                    <Text fontSize="$2" color="$gray9">
                        Detected network: {networkInfo.interface} ({networkInfo.ip})
                    </Text>
                )}

                {setupScript ? (
                    <CommandBlock label="Setup script" value={setupScript} icon={Terminal} />
                ) : (
                    <YStack
                        gap="$2"
                        width="100%"
                        maxWidth={600}
                        padding="$3"
                        borderRadius="$3"
                        backgroundColor="$yellow3"
                        borderWidth={1}
                        borderColor="$yellow6"
                    >
                        <Text fontSize="$4" fontWeight="600" color="$yellow11">Device name required</Text>
                        <Text fontSize="$2" color="$yellow11">
                            Enter a valid device name to generate the script with the correct identifiers.
                        </Text>
                    </YStack>
                )}

                <Button
                    size="$4"
                    disabled={!setupScript}
                    onPress={handleCopyScript}
                    icon={copied ? Check : Copy}
                >
                    {copied ? 'Copied!' : 'Copy script'}
                </Button>

                <YStack
                    backgroundColor="$blue3"
                    padding="$3"
                    borderRadius="$3"
                    width="100%"
                    maxWidth={600}
                    borderWidth={1}
                    borderColor="$blue6"
                    gap="$2"
                >
                    <Text fontSize="$3" fontWeight="600" color="$blue11">What this script includes</Text>
                    {template.highlights.map((highlight) => (
                        <Text key={highlight} fontSize="$2" color="$blue11">
                            - {highlight}
                        </Text>
                    ))}
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

export const raspberryPiOption: NetworkOption = {
    id: 'raspberrypi',
    name: 'Raspberry Pi Agent',
    description: 'Install the Raspberry Pi Python agent for GPIO control with a ready-made script',
    icon: 'cpu',
    Component: RaspberryPiWizard
}
