import { useRef } from "react"
import { YStack, XStack, Input, Spinner, Button, Text } from "@my/ui"
import { Plus, Settings } from "@tamagui/lucide-icons"
import { useOpenAISetupWizard } from "../AISetupProvider"
import { Tinted } from "../Tinted"

type RulesKeySetterProps = {
    updateKey: (key: string) => void
    loading: boolean
    mode?: 'needs-key' | 'not-configured'  // 'needs-key' for API key input, 'not-configured' for no AI setup
    providerName?: string  // Name of the provider that needs API key
}

export const RulesKeySetter = ({ updateKey, loading, mode = 'needs-key', providerName = 'OpenAI' }: RulesKeySetterProps) => {
    const aiKeyText = useRef("")
    const openAISetupWizard = useOpenAISetupWizard()

    if (loading) {
        return <YStack f={1} jc='center' ai="center" p="$4">
            <Spinner size="large" />
        </YStack>
    }

    // Show "not configured" message when provider is 'skip' or not set
    if (mode === 'not-configured') {
        return <YStack f={1} jc='center' ai="center" p="$4" gap="$3">
            <Text fontSize="$4" fontWeight="500" textAlign="center" color="$color11">
                AI is not configured yet.
            </Text>
            <Text fontSize="$3" textAlign="center" color="$color10">
                Set up an AI provider to enable AI-powered rules.
            </Text>
            <Tinted>
                <Button
                    size="$4"
                    icon={Settings}
                    onPress={openAISetupWizard}
                    backgroundColor="$color8"
                    color="white"
                    hoverStyle={{ backgroundColor: '$color9' }}
                >
                    Configure AI
                </Button>
            </Tinted>
        </YStack>
    }

    // Show API key input for providers that require it
    return <YStack f={1} jc='center' ai="center" p="$4">
        <Text fontSize="$4" fontWeight="500" textAlign="center" mb="$2">
            AI Rules require a {providerName} API Key.
        </Text>
        <XStack p="$2" w="100%" gap="$2" ai="center" >
            <Input
                f={1}
                placeholder={`Enter your ${providerName} API Key`}
                placeholderTextColor="$gray9"
                boc="$gray4"
                bc="$gray1"
                disabled={loading}
                onChangeText={(text) => aiKeyText.current = text}
            />
            <Button circular icon={Plus} onPress={() => updateKey(aiKeyText.current)} disabled={loading}></Button>
        </XStack>
    </YStack>
}