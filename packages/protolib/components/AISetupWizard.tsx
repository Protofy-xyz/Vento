import { useState } from 'react'
import { YStack, XStack, Text, Paragraph, Input } from '@my/ui'
import { AlertDialog } from './AlertDialog'
import { Tinted } from './Tinted'
import { Bot, Cpu, Cloud, Sparkles, Key, ChevronLeft } from '@tamagui/lucide-icons'
import { API } from 'protobase'
import { useSession } from '../lib/useSession'

const providers = [
    // {
    //     id: 'llama',
    //     name: 'Local AI',
    //     description: 'Run AI locally, no API key required. Use your own hardware to run AI.',
    //     icon: Bot
    // },
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
        requirements: 'Min 8GB RAM'
    },
    {
        id: 'gemma3-12b',
        name: 'Gemma3 12B - Balanced',
        description: 'Runs on mid-range hardware. Good balance of speed and capability.',
        requirements: 'Min 16GB RAM'
    },
    {
        id: 'gemma3-27b',
        name: 'Gemma3 27B - Powerful',
        description: 'Requires serious hardware. Most capable for complex tasks.',
        requirements: 'Min 32GB RAM, GPU recommended'
    }
]

type AISetupWizardProps = {
    open: boolean
    onComplete: (provider: string) => void
    onSkip?: () => void
}

type Step = 'provider' | 'apikey' | 'localmodel'

export const AISetupWizard = ({ open, onComplete, onSkip }: AISetupWizardProps) => {
    const [selectedProvider, setSelectedProvider] = useState('chatgpt')
    const [selectedModel, setSelectedModel] = useState('gemma3-12b')
    const [apiKey, setApiKey] = useState('')
    const [step, setStep] = useState<Step>('provider')
    const [session] = useSession()

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
            await saveSettings()
            onComplete(selectedProvider)
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

            // Save model size if Llama
            if (selectedProvider === 'llama') {
                const modelRes = await API.post(`/api/core/v1/settings?token=${token}`, {
                    name: 'ai.localmodel',
                    value: selectedModel
                })
                console.log('AISetupWizard: ai.localmodel save result:', modelRes)
            }
        } catch (error) {
            console.error('AISetupWizard: Error saving settings:', error)
        }
    }

    const handleBack = () => {
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
        }
    }

    const getDescription = () => {
        switch (step) {
            case 'provider': return 'Select your default AI provider for Vento'
            case 'apikey': return 'Enter your OpenAI API key to use ChatGPT'
            case 'localmodel': return 'Choose a model size based on your hardware'
        }
    }

    const getAcceptCaption = () => {
        if (step === 'provider' && (selectedProvider === 'chatgpt' || selectedProvider === 'llama')) {
            return 'Next'
        }
        return 'Continue'
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
                            borderColor={isSelected ? '$color8' : '$borderColor'}
                            backgroundColor={isSelected ? '$color3' : '$background'}
                            hoverStyle={{
                                borderColor: isSelected ? '$color8' : '$color6',
                                backgroundColor: isSelected ? '$color3' : '$color2'
                            }}
                            pressStyle={{ scale: 0.98 }}
                            cursor="pointer"
                            onPress={() => setSelectedProvider(provider.id)}
                            gap="$3"
                            alignItems="center"
                            animation="quick"
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
        <YStack gap="$4" f={1}>
            <Tinted>
                <YStack
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$color3"
                    gap="$4"
                    borderWidth={2}
                    borderColor="$color6"
                >
                    <XStack gap="$3" alignItems="center">
                        <XStack
                            width={40}
                            height={40}
                            borderRadius={10}
                            backgroundColor="$color5"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Key size={20} color="$color11" />
                        </XStack>
                        <Text fontWeight="600" color="$color12">API Key</Text>
                    </XStack>
                    <Input
                        placeholder="sk-proj-..."
                        value={apiKey}
                        onChangeText={setApiKey} 
                        size="$4"
                        backgroundColor="$background"
                        borderColor="$color6"
                    />
                </YStack>
            </Tinted>
            <Paragraph size="$2" color="$color10">
                Get your API key from{' '}
                <Text color="$color11" fontWeight="600">platform.openai.com</Text>
            </Paragraph>
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
                            animation="quick"
                        >
                            <YStack flex={1} gap="$1">
                                <XStack justifyContent="space-between" alignItems="center">
                                    <Text fontWeight="600" fontSize="$5" color="$color12">
                                        {model.name}
                                    </Text>
                                    <Text fontSize="$2" color="$color9">
                                        {model.requirements}
                                    </Text>
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
            showCancel={true}
            onAccept={handleContinue}
            onCancel={handleBack}
            acceptButtonProps={{ icon: step === 'provider' ? Sparkles : undefined }}
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

                {step === 'provider' && (
                    <Paragraph size="$2" color="$color10" textAlign="center" mt="$2">
                        You can change this later in Settings
                    </Paragraph>
                )}
            </YStack>
        </AlertDialog>
    )
}

export default AISetupWizard
