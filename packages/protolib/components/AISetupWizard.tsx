import { useState, useEffect, useRef } from 'react'
import { YStack, XStack, Text, Paragraph, Input, Progress, Checkbox, Label } from '@my/ui'
import { AlertDialog } from './AlertDialog'
import { Tinted } from './Tinted'
import { Bot, Cpu, Cloud, Sparkles, Key, ChevronLeft, Download, CheckCircle, AlertCircle, Loader, ExternalLink, Info } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import { useSession } from '../lib/useSession'

const providers = [
    {
        id: 'llama',
        name: 'Local AI',
        description: 'Run AI locally, no API key required. Use your own hardware to run AI.',
        icon: Bot
    },
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        description: 'OpenAI GPT-4 and 5 and other advanced cloud models',
        icon: Cloud
    },
    {
        id: 'lmstudio',
        name: 'LM Studio',
        description: 'Local models with LM Studio',
        icon: Cpu
    }
]

const localModels = [
    {
        id: 'gemma3-4b',
        name: 'Gemma3 4B - Light',
        description: 'Runs on most computers. Faster but less capable. Good for simple tasks.',
        requirements: 'Min 8GB RAM',
        size: '~5 GB',
        url: 'https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q8_0.gguf',
        filename: 'gemma-3-4b-it-Q8_0.gguf'
    },
    {
        id: 'gemma3-12b',
        name: 'Gemma3 12B - Balanced',
        description: 'Runs on mid-range hardware. Good balance of speed and capability.',
        requirements: 'Min 16GB RAM',
        size: '~8 GB',
        url: 'https://huggingface.co/bartowski/google_gemma-3-12b-it-GGUF/resolve/main/google_gemma-3-12b-it-Q4_1.gguf',
        filename: 'gemma-3-12b-it-Q4_1.gguf'
    },
    {
        id: 'gemma3-27b',
        name: 'Gemma3 27B - Powerful',
        description: 'Requires serious hardware. Most capable for complex tasks.',
        requirements: 'Min 32GB RAM, GPU recommended',
        size: '~16 GB',
        url: 'https://huggingface.co/bartowski/google_gemma-3-27b-it-GGUF/resolve/main/google_gemma-3-27b-it-Q4_0.gguf',
        filename: 'gemma-3-27b-it-Q4_0.gguf'
    }
]

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

type AISetupWizardProps = {
    open: boolean
    onComplete: (provider: string) => void
    onSkip?: () => void
}

type Step = 'provider' | 'apikey' | 'localmodel' | 'download'

type DownloadStatus = 'idle' | 'starting' | 'downloading' | 'completed' | 'error' | 'retrying'

interface DownloadProgress {
    status: DownloadStatus
    percent: number
    downloaded: number
    total: number
    error?: string
}

export const AISetupWizard = ({ open, onComplete, onSkip }: AISetupWizardProps) => {
    const [selectedProvider, setSelectedProvider] = useState('chatgpt')
    const [selectedModel, setSelectedModel] = useState('gemma3-12b')
    const [apiKey, setApiKey] = useState('')
    const [telemetryEnabled, setTelemetryEnabled] = useState(true)
    const [step, setStep] = useState<Step>('provider')
    const [session] = useSession()

    // Download state
    const [downloadId, setDownloadId] = useState<string | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
        status: 'idle',
        percent: 0,
        downloaded: 0,
        total: 0
    })
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [])

    const startDownload = async () => {
        const token = (session as any)?.token
        if (!token) return

        const model = localModels.find(m => m.id === selectedModel)
        if (!model) return

        setDownloadProgress({ status: 'starting', percent: 0, downloaded: 0, total: 0 })

        try {
            const response = await API.post(`/api/core/v1/llama/models/download?token=${token}`, {
                url: model.url,
                filename: model.filename
            })

            if (response.error) {
                setDownloadProgress(prev => ({ ...prev, status: 'error', error: response.error }))
                return
            }

            const newDownloadId = response.data?.downloadId
            const alreadyDownloaded = response.data?.alreadyDownloaded
            const existing = response.data?.existing

            if (newDownloadId) {
                setDownloadId(newDownloadId)

                // If already downloaded, show completed immediately
                if (alreadyDownloaded) {
                    // Fetch final progress to get file size
                    const progressRes = await API.get(`/api/core/v1/llama/models/download/${newDownloadId}?token=${token}`)
                    const data = progressRes.data || {}
                    setDownloadProgress({
                        status: 'completed',
                        percent: 100,
                        downloaded: data.downloaded || data.total || 0,
                        total: data.total || data.downloaded || 0
                    })
                    return
                }

                // If download already in progress, start polling immediately
                setDownloadProgress(prev => ({ ...prev, status: existing ? 'downloading' : 'downloading' }))

                // Start polling for progress
                pollIntervalRef.current = setInterval(() => {
                    pollDownloadProgress(newDownloadId, token)
                }, 1000)

                // Also poll immediately to get current status
                if (existing) {
                    pollDownloadProgress(newDownloadId, token)
                }
            }
        } catch (err: any) {
            setDownloadProgress(prev => ({
                ...prev,
                status: 'error',
                error: err?.message || 'Failed to start download'
            }))
        }
    }

    const preloadModel = async () => {
        const token = (session as any)?.token
        if (!token) return

        const model = localModels.find(m => m.id === selectedModel)
        if (!model) return

        const modelName = model.filename?.replace('.gguf', '') || selectedModel

        try {
            console.log('AISetupWizard: Preloading model:', modelName)
            await API.post(`/api/core/v1/llama/preload?token=${token}`, { model: modelName })
            console.log('AISetupWizard: Model preloaded successfully')
        } catch (err) {
            // Non-fatal - model will load on first use
            console.warn('AISetupWizard: Model preload failed (will load on first use):', err)
        }
    }

    const pollDownloadProgress = async (id: string, token: string) => {
        try {
            const response = await API.get(`/api/core/v1/llama/models/download/${id}?token=${token}`)

            if (response.error) {
                return
            }

            const data = response.data
            if (!data) return

            setDownloadProgress({
                status: data.status as DownloadStatus,
                percent: data.percent || 0,
                downloaded: data.downloaded || 0,
                total: data.total || 0,
                error: data.error
            })

            // Stop polling if completed or error
            if (data.status === 'completed' || data.status === 'error') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
            }
        } catch (err) {
            // Ignore polling errors
        }
    }

    const handleContinue = async () => {
        if (step === 'provider') {
            if (selectedProvider === 'chatgpt') {
                setStep('apikey')
                return true // Keep dialog open
            } else if (selectedProvider === 'llama') {
                setStep('localmodel')
                return true // Keep dialog open
            } else {
                // LM Studio - just save and close
                await saveSettings()
                onComplete(selectedProvider)
            }
        } else if (step === 'apikey') {
            await saveSettings()
            onComplete(selectedProvider)
        } else if (step === 'localmodel') {
            // Go to download step
            setStep('download')
            // Start download automatically
            setTimeout(() => startDownload(), 100)
            return true // Keep dialog open
        } else if (step === 'download') {
            if (downloadProgress.status === 'completed') {
                await saveSettings()
                // Preload the model so it's ready when user talks
                await preloadModel()
                onComplete(selectedProvider)
            } else if (downloadProgress.status === 'error') {
                // Retry download
                startDownload()
                return true
            }
            return true // Keep dialog open while downloading
        }
    }

    const saveSettings = async () => {
        const token = (session as any)?.token

        if (!token) {
            console.error('AISetupWizard: No session token available!')
            return
        }

        console.log('AISetupWizard: Saving provider:', selectedProvider)

        try {
            // Save ai.enabled (CREATE - sin key en la URL para crear nuevo)
            const enabledRes = await API.post(`/api/core/v1/settings?token=${token}`, {
                name: 'ai.enabled',
                value: 'true'
            })
            console.log('AISetupWizard: ai.enabled save result:', enabledRes)

            // Save ai.provider (CREATE)
            const providerRes = await API.post(`/api/core/v1/settings?token=${token}`, {
                name: 'ai.provider',
                value: selectedProvider
            })
            console.log('AISetupWizard: ai.provider save result:', providerRes)

            // Save API key if ChatGPT
            if (selectedProvider === 'chatgpt' && apiKey) {
                const keyRes = await API.post(`/api/core/v1/keys?token=${token}`, {
                    name: 'OPENAI_API_KEY',
                    value: apiKey
                })
                console.log('AISetupWizard: OPENAI_API_KEY save result:', keyRes)
            }

            // Save model filename if Llama
            if (selectedProvider === 'llama') {
                const model = localModels.find(m => m.id === selectedModel)
                const modelFilename = model?.filename?.replace('.gguf', '') || selectedModel
                const modelRes = await API.post(`/api/core/v1/settings?token=${token}`, {
                    name: 'ai.localmodel',
                    value: modelFilename
                })
                console.log('AISetupWizard: ai.localmodel save result:', modelRes)
            }

            // Save telemetry setting
            const telemetryRes = await API.post(`/api/core/v1/settings?token=${token}`, {
                name: 'cloud.telemetry',
                value: telemetryEnabled ? 'true' : 'false'
            })
            console.log('AISetupWizard: cloud.telemetry save result:', telemetryRes)
        } catch (error) {
            console.error('AISetupWizard: Error saving settings:', error)
        }
    }

    const handleBack = () => {
        if (step === 'download') {
            // Stop any ongoing polling
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }
            // Go back to model selection
            setStep('localmodel')
            setDownloadProgress({ status: 'idle', percent: 0, downloaded: 0, total: 0 })
            setDownloadId(null)
            return true
        }
        if (step !== 'provider') {
            // Estamos en apikey o localmodel, volver al paso de provider
            setStep('provider')
            return true // Keep dialog open
        }
        // Estamos en provider step - esto es Skip
        // NO guardar nada, simplemente cerrar
        if (onSkip) onSkip()
        return false // Let dialog close
    }

    const getTitle = () => {
        switch (step) {
            case 'provider': return 'AI Setup'
            case 'apikey': return 'OpenAI API Key'
            case 'localmodel': return 'Select Model Size'
            case 'download': return 'Downloading Model'
        }
    }

    const getDescription = () => {
        switch (step) {
            case 'provider': return 'Select your default AI provider for Vento'
            case 'apikey': return 'Enter your OpenAI API key to use ChatGPT'
            case 'localmodel': return 'Choose a model size based on your hardware'
            case 'download': {
                const model = localModels.find(m => m.id === selectedModel)
                return `Downloading ${model?.name || 'model'}...`
            }
        }
    }

    const getAcceptCaption = () => {
        if (step === 'provider' && (selectedProvider === 'chatgpt' || selectedProvider === 'llama')) {
            return 'Next'
        }
        if (step === 'localmodel') {
            return 'Download'
        }
        if (step === 'download') {
            if (downloadProgress.status === 'completed') {
                return 'Continue'
            }
            if (downloadProgress.status === 'error') {
                return 'Retry'
            }
            return 'Downloading...'
        }
        return 'Continue'
    }

    const isAcceptDisabled = () => {
        if (step === 'download') {
            return downloadProgress.status === 'downloading' ||
                downloadProgress.status === 'starting' ||
                downloadProgress.status === 'retrying'
        }
        return false
    }

    const renderProviderStep = () => (
        <>
            {providers.map((provider) => {
                const Icon = provider.icon
                const isSelected = selectedProvider === provider.id
                return (
                    <Tinted key={provider.id}>
                        <XStack
                            padding="$4"
                            borderRadius="$4"
                            borderWidth={2}
                            borderColor={isSelected ? '$color6' : 'transparent'}
                            backgroundColor={isSelected ? '$background' : '$gray2'}
                            hoverStyle={{
                                borderColor: '$color6',
                                backgroundColor: "$background"
                            }}
                            pressStyle={{ scale: 0.98 }}
                            cursor="pointer"
                            onPress={() => setSelectedProvider(provider.id)}
                            gap="$3"
                            alignItems="center"
                        >
                            <XStack
                                width={48}
                                height={48}
                                borderRadius={12}
                                backgroundColor={isSelected ? '$color5' : '$color4'}
                                alignItems="center"
                                justifyContent="center"
                            >
                                <Icon size={24} color={isSelected ? '$color11' : '$color10'} />
                            </XStack>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="600" fontSize="$5" color="$color12">
                                    {provider.name}
                                </Text>
                                <Text color="$color11" fontSize="$3">
                                    {provider.description}
                                </Text>
                            </YStack>
                        </XStack>
                    </Tinted>
                )
            })}
        </>
    )

    const renderApiKeyStep = () => (
        <YStack gap="$8" f={1}>
            <Input
                bc="$gray3"
                placeholder="sk-proj-..."
                borderColor="transparent"
                autoFocus
                value={apiKey}
                onChangeText={setApiKey}
                size="$4"
            />
            <YStack
                gap="$4"
            >
                <XStack ai="center" gap="$2">
                    <Info size={18} color="$gray9" />
                    <Text fontWeight="500" color="$gray9">How to get your API key</Text>
                </XStack>

                <YStack gap="$2">
                    {[
                        { num: '1', text: 'Go to OpenAI\'s API Keys page' },
                        { num: '2', text: 'Log in or create an account' },
                        { num: '3', text: 'Click "Create new secret key"' },
                        { num: '4', text: 'Copy the key and paste it above' }
                    ].map((step) => (
                        <XStack key={step.num} ai="center" gap="$3">
                            <XStack
                                width={24}
                                height={24}
                                borderRadius={12}
                                backgroundColor="$bgPanel"
                                alignItems="center"
                                justifyContent="center"
                            >
                                <Text fontSize="$2" fontWeight="600">{step.num}</Text>
                            </XStack>
                            <Text fontSize="$3">{step.text}</Text>
                        </XStack>
                    ))}
                </YStack>

                <XStack
                    alignItems="center"
                    gap="$2"
                    cursor="pointer"
                    alignSelf="flex-start"
                    hoverStyle={{ opacity: 0.8 }}
                    pressStyle={{ opacity: 0.6 }}
                    onPress={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                >
                <ExternalLink size={14} color="$blue10" />
                <Text fontSize="$2" color="$blue10" fontWeight="600" textDecorationLine="underline">
                    Open OpenAI API Keys page
                </Text>
                </XStack>
                <XStack ai="center" gap="$2" opacity={0.7}>
                    <Text fontSize="$2" color="$gray9">
                            ⚠️ Keep your API key secret — usage is billed to your OpenAI account
                    </Text>
                </XStack>
            </YStack>
        </YStack>
    )

    const renderLocalModelStep = () => (
        <>
            {localModels.map((model) => {
                const isSelected = selectedModel === model.id
                return (
                    <Tinted key={model.id}>
                        <XStack
                            padding="$4"
                            borderRadius="$4"
                            borderWidth={2}
                            borderColor={isSelected ? '$color8' : '$borderColor'}
                            backgroundColor={isSelected ? '$color3' : '$background'}
                            hoverStyle={{
                                borderColor: isSelected ? '$color8' : '$color6',
                                backgroundColor: isSelected ? '$color3' : '$color2'
                            }}
                            pressStyle={{ scale: 0.98 }}
                            cursor="pointer"
                            onPress={() => setSelectedModel(model.id)}
                            gap="$3"
                            alignItems="center"
                        >
                            <YStack flex={1} gap="$1">
                                <XStack justifyContent="space-between" alignItems="center">
                                    <Text fontWeight="600" fontSize="$5" color="$color12">
                                        {model.name}
                                    </Text>
                                    <XStack gap="$2" alignItems="center">
                                        <Text fontSize="$2" color="$color10">
                                            {model.size}
                                        </Text>
                                        <Text fontSize="$2" color="$color9">
                                            {model.requirements}
                                        </Text>
                                    </XStack>
                                </XStack>
                                <Text color="$color11" fontSize="$3">
                                    {model.description}
                                </Text>
                            </YStack>
                        </XStack>
                    </Tinted>
                )
            })}
        </>
    )

    const renderDownloadStep = () => {
        const model = localModels.find(m => m.id === selectedModel)
        const { status, percent, downloaded, total, error } = downloadProgress

        const getStatusIcon = () => {
            switch (status) {
                case 'completed':
                    return <CheckCircle size={24} color="$green10" />
                case 'error':
                    return <AlertCircle size={24} color="$red10" />
                case 'downloading':
                case 'retrying':
                case 'starting':
                    return <Loader size={24} color="$color11" />
                default:
                    return <Download size={24} color="$color11" />
            }
        }

        const getStatusText = () => {
            switch (status) {
                case 'starting':
                    return 'Starting download...'
                case 'downloading':
                    return `Downloading... ${percent}%`
                case 'retrying':
                    return 'Connection lost, retrying...'
                case 'completed':
                    return 'Download complete!'
                case 'error':
                    return error || 'Download failed'
                default:
                    return 'Preparing...'
            }
        }

        const progressColor = status === 'completed' ? '$green10' :
            status === 'error' ? '$red10' : '$color10'

        return (
            <Tinted>
                <YStack gap="$4" width="100%">
                    {/* Model info card */}
                    <XStack
                        padding="$4"
                        borderRadius="$4"
                        backgroundColor="$color3"
                        gap="$3"
                        alignItems="center"
                        borderWidth={2}
                        borderColor="$color6"
                    >
                        <XStack
                            width={48}
                            height={48}
                            borderRadius={12}
                            backgroundColor="$color5"
                            alignItems="center"
                            justifyContent="center"
                        >
                            {getStatusIcon()}
                        </XStack>
                        <YStack flex={1} gap="$1">
                            <Text fontWeight="600" fontSize="$5" color="$color12">
                                {model?.name}
                            </Text>
                            <Text color="$color11" fontSize="$3">
                                {model?.filename}
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Progress section */}
                    <YStack gap="$3" padding="$4" borderRadius="$4" backgroundColor="$color2">
                        {/* Status text */}
                        <XStack justifyContent="space-between" alignItems="center">
                            <Text color="$color11" fontSize="$3">
                                {getStatusText()}
                            </Text>
                            {total > 0 && (
                                <Text color="$color10" fontSize="$2">
                                    {formatBytes(downloaded)} / {formatBytes(total)}
                                </Text>
                            )}
                        </XStack>

                        {/* Progress bar */}
                        <Progress value={percent} size="$2">
                            <Progress.Indicator
                                backgroundColor={progressColor}
                            />
                        </Progress>

                        {/* Percentage */}
                        <XStack justifyContent="center">
                            <Text
                                fontSize="$8"
                                fontWeight="bold"
                                color={status === 'completed' ? '$green10' : '$color12'}
                            >
                                {percent}%
                            </Text>
                        </XStack>
                    </YStack>

                    {/* Error message */}
                    {status === 'error' && error && (
                        <XStack
                            padding="$3"
                            borderRadius="$3"
                            backgroundColor="$red3"
                            gap="$2"
                            alignItems="center"
                        >
                            <AlertCircle size={16} color="$red10" />
                            <Text color="$red11" fontSize="$2" flex={1}>
                                {error}
                            </Text>
                        </XStack>
                    )}

                    {/* Success message */}
                    {status === 'completed' && (
                        <XStack
                            padding="$3"
                            borderRadius="$3"
                            backgroundColor="$green3"
                            gap="$2"
                            alignItems="center"
                        >
                            <CheckCircle size={16} color="$green10" />
                            <Text color="$green11" fontSize="$2" flex={1}>
                                Model downloaded successfully! Click Continue to finish setup.
                            </Text>
                        </XStack>
                    )}
                </YStack>
            </Tinted>
        )
    }

    return (
        <AlertDialog
            open={open}
            setOpen={() => {
                // No hacer nada cuando se cierra - solo cerrar con los botones
            }}
            title={getTitle()}
            description={getDescription()}
            acceptCaption={getAcceptCaption()}
            cancelCaption={step === 'provider' ? 'Skip' : 'Back'}
            showCancel={step !== 'download' || downloadProgress.status === 'error' || downloadProgress.status === 'idle'}
            onAccept={handleContinue}
            onCancel={handleBack}
            acceptButtonProps={{
                icon: step === 'provider' ? Sparkles : step === 'localmodel' ? Download : undefined,
                disabled: isAcceptDisabled()
            }}
            cancelButtonProps={{
                icon: step !== 'provider' ? ChevronLeft : undefined,
                ...(step === 'provider' ? {
                    chromeless: true,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    opacity: 0.7,
                    hoverStyle: { opacity: 1, backgroundColor: 'transparent' }
                } : {})
            }}
            maxWidth={600}
            width="95%"
        >
            <YStack width="100%" gap="$3" py="$2">
                {step === 'provider' && renderProviderStep()}
                {step === 'apikey' && renderApiKeyStep()}
                {step === 'localmodel' && renderLocalModelStep()}
                {step === 'download' && renderDownloadStep()}

                {step === 'provider' && (
                    <>
                        <XStack
                            alignItems="center"
                            justifyContent="center"
                            gap="$2"
                            mt="$3"
                            opacity={0.7}
                            cursor="pointer"
                            onPress={() => setTelemetryEnabled(!telemetryEnabled)}
                        >
                            <Checkbox
                                id="telemetry-checkbox"
                                size="$3"
                                checked={telemetryEnabled}
                                onCheckedChange={(checked) => setTelemetryEnabled(checked === true)}
                                borderWidth={0}
                                backgroundColor={telemetryEnabled ? '$color7' : '$color4'}
                                focusStyle={{ outlineWidth: 0 }}   // 👈 esto quita el borde blanco
                            >
                                <Checkbox.Indicator>
                                    <Text color="$color12" fontSize="$2">✓</Text>
                                </Checkbox.Indicator>
                            </Checkbox>
                            <Label
                                htmlFor="telemetry-checkbox"
                                size="$2"
                                color="$color10"
                                cursor="pointer"
                            >
                                Send anonymous usage data to help improve Vento
                            </Label>
                        </XStack>
                    </>
                )}
            </YStack>
        </AlertDialog>
    )
}

export default AISetupWizard
