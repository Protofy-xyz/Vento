import { useState, useEffect, ReactNode } from 'react'
import { AISetupWizard } from './AISetupWizard'
import { useSettings, settingsAtom } from '@extensions/settings/hooks'
import { API } from 'protobase'
import { useAtom } from 'jotai'
import { useSession } from '../lib/useSession'

type AISetupProviderProps = {
    children: ReactNode
}

export const AISetupProvider = ({ children }: AISetupProviderProps) => {
    const [settings, setSettings] = useAtom(settingsAtom)
    const [showWizard, setShowWizard] = useState(false)
    const [checked, setChecked] = useState(false)
    const [session] = useSession()

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

    return (
        <>
            {children}
            <AISetupWizard
                open={showWizard}
                onComplete={handleComplete}
                onSkip={handleSkip}
            />
        </>
    )
}

export default AISetupProvider
