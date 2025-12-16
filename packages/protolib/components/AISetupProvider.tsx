import { useState, useEffect, ReactNode } from 'react'
import { AISetupWizard } from './AISetupWizard'
import { TutorialVideoDialog, useTutorialVideo } from './TutorialVideoDialog'
import { useSettings, settingsAtom } from '@extensions/settings/hooks'
import { API } from 'protobase'
import { atom, useAtom } from 'jotai'
import { useSession } from '../lib/useSession'
import { OnboardingProvider, OnboardingTrigger } from '@extensions/onboarding'

// Global atom to control AI setup wizard visibility
export const showAISetupWizardAtom = atom(false)

// Hook to open the AI setup wizard from anywhere
export const useOpenAISetupWizard = () => {
    const [, setShowWizard] = useAtom(showAISetupWizardAtom)
    return () => setShowWizard(true)
}

type AISetupProviderProps = {
    children: ReactNode
}

export const AISetupProvider = ({ children }: AISetupProviderProps) => {
    const [settings, setSettings] = useAtom(settingsAtom)
    const [showWizardGlobal, setShowWizardGlobal] = useAtom(showAISetupWizardAtom)
    const [showWizardLocal, setShowWizardLocal] = useState(false)
    const [showTutorial, setShowTutorial] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [checked, setChecked] = useState(false)
    const [session] = useSession()
    const { hasWatchedTutorial, markTutorialAsWatched } = useTutorialVideo()
    
    // Combine local and global wizard state
    const showWizard = showWizardLocal || showWizardGlobal
    const setShowWizard = (value: boolean) => {
        setShowWizardLocal(value)
        setShowWizardGlobal(value)
    }

    useEffect(() => {
        // Esperar a tener sesión antes de cargar settings
        const token = (session as any)?.token
        if (!token) {
            console.log('AISetupProvider: No token yet, waiting...')
            return
        }
        
        // Cargar settings al montar
        const loadSettings = async () => {
            console.log('AISetupProvider: Loading settings with token')
            try {
                const result = await API.get(`/api/core/v1/settings/all?token=${token}`)
                console.log('AISetupProvider: Settings API result:', result)
                
                if (result.isError) {
                    console.error('AISetupProvider: Error loading settings:', result.error)
                    setShowWizard(true)
                } else {
                    const data = result.data || {}
                    console.log('AISetupProvider: Settings data:', data)
                    setSettings(data)
                    
                    // Verificar si existe la configuración de IA
                    const aiProvider = data['ai.provider']
                    console.log('AISetupProvider: ai.provider value:', aiProvider, 'type:', typeof aiProvider)
                    
                    if (!aiProvider) {
                        console.log('AISetupProvider: No ai.provider found, showing wizard')
                        setShowWizard(true)
                    } else {
                        console.log('AISetupProvider: ai.provider found, NOT showing wizard')
                    }
                }
            } catch (error) {
                console.error('AISetupProvider: Exception loading settings:', error)
                setShowWizard(true)
            }
            setChecked(true)
        }

        loadSettings()
    }, [(session as any)?.token])

    const handleComplete = (provider: string) => {
        // Update the settings atom with the new provider
        setSettings((prev) => ({
            ...prev,
            'ai.provider': provider
        }))
        setShowWizard(false)
        
        // Show tutorial video after AI setup if not watched before
        if (!hasWatchedTutorial()) {
            setShowTutorial(true)
        }
    }

    const handleSkip = async () => {
        // Skip - save 'skip' as provider so the wizard doesn't show again
        // but the action knows that no AI is configured
        const token = (session as any)?.token
        if (token) {
            try {
                await API.post(`/api/core/v1/settings?token=${token}`, {
                    name: 'ai.provider',
                    value: 'skip'
                })
                console.log('AISetupProvider: User skipped wizard, saved ai.provider=skip')
            } catch (e) {
                console.error('AISetupProvider: Error saving skip:', e)
            }
        }
        setSettings((prev) => ({
            ...prev,
            'ai.provider': 'skip'
        }))
        setShowWizard(false)
    }

    // Don't render anything until we have verified
    if (!checked) {
        return <>{children}</>
    }

    const handleTutorialClose = () => {
        setShowTutorial(false)
        markTutorialAsWatched()
    }

    const handleDontShowAgain = () => {
        markTutorialAsWatched()
    }

    return (
        <>
            {children}
            <AISetupWizard
                open={showWizard}
                onComplete={handleComplete}
                onSkip={handleSkip}
            />
            <TutorialVideoDialog
                open={showTutorial}
                onClose={handleTutorialClose}
                showDontShowAgain
                onDontShowAgain={handleDontShowAgain}
            />
        </>
    )
}

export default AISetupProvider
