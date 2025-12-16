import React, { useEffect, useState } from 'react'
import { Text, TooltipSimple } from '@my/ui'
import { XStack, YStack, Button, Spinner } from '@my/ui'
import { Trash, ArrowUp, X, Sparkles } from '@tamagui/lucide-icons'
import dynamic from 'next/dynamic';
import { isElectron } from 'protolib/lib/isElectron';

const BoardTextArea = dynamic(() =>
  import('@extensions/boards/components/BoardTextArea').then(mod => mod.BoardTextArea),
  { ssr: false }
);

export const RuleItem = ({ value, loading, onDelete, onEdit, availableParams = [], allowParams = false, onBlur = (e) => { }, ...props }) => {
  return (
    <XStack ai="flex-end" gap="$2" mb="$2" width="100%" {...props}>
      <BoardTextArea
        speechRecognition={true}
        readOnly={!onEdit}
        value={value}
        onChange={(e) => onEdit?.(e.target.value)}
        onBlur={onBlur}
        placeholder="Rule Value..."
        enableShortcuts={false}
        style={{ width: '100%' }}
        availableParams={availableParams}
        allowParams={allowParams}
      />
      <Button
        disabled={loading}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        theme="red"
        bg="transparent"
        color="$red9"
        circular
        scaleIcon={1.2}
        icon={loading ? Spinner : Trash}
        onPress={onDelete}
      />
    </XStack>
  )
}

async function normalizeAdd(onAddRule, ...args) {
  try {
    await onAddRule(...args);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e?.message || 'Error adding rule.' };
  }
}

export const Rules = ({
  rules,
  loading = false,
  onAddRule,
  onDeleteRule,
  onEditRule,
  loadingIndex,
  disabledConfig = {},
  availableParams = [],
  allowParams = false,
  onReloadRules = async (_rules) => { }
}) => {
  const [draftRules, setDraftRules] = useState(rules ?? [])
  const [newRule, setNewRule] = useState("")
  const [generating, setGenerating] = useState(false)
  const [isFocus, setIsFocus] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const setDraftAt = (i, text) =>
    setDraftRules(prev => {
      const next = [...prev]
      next[i] = text
      return next
    })

  const commitIfChanged = async (i) => {
    const next = draftRules[i] ?? ''
    const prev = rules[i] ?? ''
    if (next === prev) return

    setGenerating(true)
    setErrorMsg(null)
    try {
      await onEditRule?.(i, next)
      await onReloadRules(draftRules)
    } finally {
      setGenerating(false)
    }
  }

  const addRule = async (e) => {
    if (newRule.trim().length < 3) return
    setGenerating(true)
    setErrorMsg(null)
    const res = await normalizeAdd(onAddRule, e, newRule)
    setGenerating(false)
    if (res.ok) setNewRule('')
    else setErrorMsg(res.message || 'Error adding rule.')
  }

  const reloadRules = async (e) => {
    e.stopPropagation()
    setGenerating(true)
    setErrorMsg(null)
    await onReloadRules(draftRules)
    setGenerating(false)
  }

  const editFirstRule = async () => {
    setGenerating(true)
    setErrorMsg(null)
    try {
      await onEditRule?.(0, draftRules[0])
    } catch (e) {
      setErrorMsg(e?.message || 'Error editing rule.')
    } finally {
      setGenerating(false)
    }
  }

  const isLoadingOrGenerating = loadingIndex === rules.length || generating || loading
  const ruleHasChanged = draftRules[0] !== rules[0] && draftRules[0] != ""
  const differentRulesCode = ruleHasChanged && !isFocus

  // Error has priority over "rules changed" warning
  const borderStyles = {
    borderColor: errorMsg ? '$red10' : differentRulesCode ? "$color9" : 'transparent',
    borderWidth: (errorMsg || differentRulesCode) && !isLoadingOrGenerating ? 2 : 0,
    borderStyle: 'dashed' as const,
  }

  const feedbackMessageText = errorMsg || (differentRulesCode ? '⚠️ Rules not generated. Press the send button "↑" to generate or "x" to cancel.' : null)

  useEffect(() => {
    setDraftRules(rules ?? [])
  }, [rules])


  return (
    <YStack height="100%" f={1} w="100%">
      {!(disabledConfig["enabled"] === false) ? <>
        <XStack gap="$3" width="100%" f={1} {...borderStyles} data-tour="rules-textarea">
          <BoardTextArea
            onBlur={() => {
              setTimeout(() => setIsFocus(false), 100)
            }}
            onFocus={() => setIsFocus(true)}
            speechRecognition={true}
            placeholder={isLoadingOrGenerating ? "Generating rules..." : "Add your rules here..."}
            value={draftRules[0]}
            onChange={(e) => {
              // setNewRule(e.target.value)
              setErrorMsg(null)
              setDraftAt(0, e.target.value)
            }}
            onEnter={editFirstRule}
            style={{ width: '100%', paddingBottom: 30 }}
            disabled={isLoadingOrGenerating}
            enableShortcuts={true}
            availableParams={availableParams}
            allowParams={allowParams}
            footer={
              <XStack justifyContent='space-between' f={1} ai="flex-end" gap="$2">
                <XStack flex={1} minWidth={0} maxHeight={40} overflow="hidden">
                  {(errorMsg || differentRulesCode) && !isLoadingOrGenerating && (
                    <TooltipSimple label={feedbackMessageText} restMs={0} delay={{ open: 500, close: 0 }}>
                      <Text
                        paddingHorizontal="$2"
                        numberOfLines={2}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        color={errorMsg ? "$red10" : "$color9"}
                        fontSize="$3"
                      >
                        {feedbackMessageText}
                      </Text>
                    </TooltipSimple>)}
                </XStack>
                <XStack gap="$2" flexShrink={0}>
                  {differentRulesCode && <TooltipSimple
                    label={"Cancel changes"}
                    delay={{ open: 500, close: 0 }}
                    restMs={0}
                  >
                    <Button
                      display={isLoadingOrGenerating ? 'none' : 'flex'}
                      size="$3"
                      p="$0"
                      onMouseDown={(e) => e.stopPropagation()}
                      color={'$gray9'}
                      bc="$bgContent"
                      borderWidth={1}
                      borderColor="$gray9"
                      hoverStyle={{ backgroundColor: '$bgContent' }}
                      pressStyle={{ backgroundColor: '$bgContent' }}
                      circular
                      icon={X}
                      scaleIcon={1.4}
                      onPress={() => { setDraftAt(0, rules[0] || ""); setErrorMsg(null); }}
                    />
                  </TooltipSimple>}
                  <TooltipSimple
                    label={newRule.trim().length > 1 ? "Add Rule" : "Reload Rules"}
                    delay={{ open: 500, close: 0 }}
                    restMs={0}
                  >
                    <Button
                      size="$3"
                      p="$0"
                      disabled={isLoadingOrGenerating || !ruleHasChanged}
                      onMouseDown={(e) => e.stopPropagation()}
                      bg={ruleHasChanged ? '$color' : 'transparent'}
                      color={ruleHasChanged ? "$gray3" : !isElectron() ? '$gray7' : '$gray3'}
                      hoverStyle={{ backgroundColor: '$gray11' }}
                      pressStyle={{ backgroundColor: '$gray10' }}
                      circular
                      icon={isLoadingOrGenerating ? Spinner : (!ruleHasChanged ? Sparkles : ArrowUp)}
                      scaleIcon={1.4}
                      onPress={editFirstRule}
                    />
                  </TooltipSimple>
                </XStack>
              </XStack>
            }
          />

        </XStack>
      </> : disabledConfig?.["disabledView"]?.()}
    </YStack>
  )
}