import { API } from 'protobase'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AutopilotEditor } from './AutopilotEditor'
import { useKeyState } from "../KeySetter";
import { RulesKeySetter } from './RulesKeySetter'
import { TabContainer, TabTitle } from './Tab';
import { useSettingValue } from "@extensions/settings/hooks";
import { getAIProvider } from '../AISetupWizard';

export const RuleEditor = ({ board, actions, states, cardData, setCardData, compiler, onCodeChange, extraCompilerData = {} }) => {
  const [hasCode, setHasCode] = useState(cardData.rulesCode !== undefined)
  const [value, setValue] = useState()
  const aiProvider = useSettingValue<string>('ai.provider', '');
  const providerConfig = useMemo(() => getAIProvider(aiProvider), [aiProvider]);
  
  // Get the API key name from provider config, or default to OPENAI_API_KEY
  const apiKeyName = providerConfig?.apiKeyName || 'OPENAI_API_KEY';
  const { hasKey, updateKey, loading } = useKeyState(apiKeyName);
  const [key, setKey] = useState(0)
  
  // Determine AI readiness based on provider configuration
  const { isAIReady, aiMode } = useMemo(() => {
    // Provider is 'skip' or not configured
    if (!aiProvider || aiProvider === 'skip') {
      return { isAIReady: false, aiMode: 'not-configured' as const };
    }
    
    // Check if provider requires API key
    if (providerConfig?.requiresApiKey) {
      return { isAIReady: hasKey, aiMode: 'needs-key' as const };
    }
    
    // Provider doesn't require API key (local providers)
    return { isAIReady: true, aiMode: 'ready' as const };
  }, [aiProvider, providerConfig, hasKey]);

  const getRulesCode = async (rules) => {
    if (rules && rules.length > 0) {
      const boardStates = states?.[board.name] ?? {}
      //remove cardData.name key from boardStates
      if (cardData.type == 'value') delete boardStates[cardData.name]
      setHasCode(false)
      const code = await API.post('/api/core/v1/autopilot/' + compiler + '?debug=true', { board: board.name, states: boardStates, rules: rules, previousRules: cardData.rules, card: cardData, ...extraCompilerData })
      if (code?.error) return { error: code.error?.error || 'Error generating rules code', message: code?.error?.message || '' }
      if (!code?.data?.jsCode) return {}
      setHasCode(true)
      return {
        rulesCode: code.data.jsCode,
        rulesExplained: code.data?.explanation
      }
    }
    return { rulesCode: '//empty rules', rulesExplained: 'The rules are empty' }
  }

  useEffect(() => {
    if (cardData.rulesCode) {
      try {
        const value = onCodeChange(cardData, states)
        setValue(value)
      } catch (e) { }
    }
  }, [cardData.rulesCode])

  {/* <TabTitle tabname={"Card Rules"} tabDescription='Define the behavior of your card using using natural language' /> */ }
  return <AutopilotEditor
    key={key}
    cardData={cardData}
    board={board}
    panels={cardData.type == 'value' ? ['states'] : ['actions', 'states']}
    setRulesCode={(rulesCode) => {
      setCardData(prev => ({ ...prev, rulesCode }))
    }}
    rulesCode={cardData.rulesCode}
    actions={actions}
    states={states}
    rules={cardData.rules ?? []}
    value={value}
    setRules={async (rules) => {
      const rulesRes = await getRulesCode(rules)
      if (rulesRes.error) throw new Error(rulesRes.message ?? rulesRes.error)

      setKey(k => k + 1)

      setCardData(prev => {
        const next = { ...prev, ...rulesRes, rules }
        return next
      })
    }}
    rulesConfig={{
      enabled: isAIReady,
      loading: loading,
      disabledView: () => <RulesKeySetter 
        updateKey={updateKey} 
        loading={loading} 
        mode={aiMode === 'not-configured' ? 'not-configured' : 'needs-key'}
        providerName={providerConfig?.name}
      />
    }}
    setReturnType={(t) => setCardData(prev => ({ ...prev, returnType: t }))}
    valueReady={hasCode} />
}
