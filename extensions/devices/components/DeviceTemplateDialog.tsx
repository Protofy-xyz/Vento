import React from 'react'
import { AlertDialog } from 'protolib/components/AlertDialog'
import { Tinted } from 'protolib/components/Tinted'
import { SelectList } from 'protolib/components/SelectList'
import { Button, Input, Text, XStack, YStack } from '@my/ui'

export type TemplateDialogState = {
  open: boolean
  device: any
  yaml: string
  templateName: string
  description: string
  boardName: string
  subsystems: any[]
  error?: string
  warning?: string
  submitting: boolean
  overwriteConfirmed: boolean
}

type DeviceTemplateDialogProps = {
  templateDialog: TemplateDialogState
  setTemplateDialog: React.Dispatch<React.SetStateAction<TemplateDialogState>>
  resetTemplateDialog: () => void
  submitTemplateDialog: () => Promise<void> | void
  boardOptions: string[]
  actionLabel?: string
  boardFieldMode?: 'select' | 'readonly' | 'hidden'
  lockedBoardName?: string
  title?: string
}

export const DeviceTemplateDialog = ({
  templateDialog,
  setTemplateDialog,
  resetTemplateDialog,
  submitTemplateDialog,
  boardOptions,
  actionLabel = 'Create template',
  boardFieldMode = 'select',
  lockedBoardName,
  title = 'Create template'
}: DeviceTemplateDialogProps) => {
  return (
    <AlertDialog
      open={templateDialog.open}
      setOpen={(open) => {
        if (!open) resetTemplateDialog()
      }}
      title={title}
      description=""
      hideAccept
      onOpenChange={(open) => {
        if (!open) {
          resetTemplateDialog()
        }
      }}
    >
      <YStack gap="$3" p="$3" w={400} maxWidth="100%">
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600" color="$gray11">Template name</Text>
          <Input
            placeholder="Template name"
            value={templateDialog.templateName}
            onChangeText={(v) => setTemplateDialog(prev => ({
              ...prev,
              templateName: v,
              warning: undefined,
              overwriteConfirmed: false
            }))}
            disabled={templateDialog.submitting}
          />
        </YStack>
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600" color="$gray11">Description</Text>
          <Input
            placeholder="What is this template for?"
            value={templateDialog.description}
            onChangeText={(v) => setTemplateDialog(prev => ({ ...prev, description: v }))}
            disabled={templateDialog.submitting}
          />
        </YStack>
        {boardFieldMode !== 'hidden' && (
          <YStack gap="$1">
            <Text fontSize="$3" fontWeight="600" color="$gray11">Board</Text>
            {boardFieldMode === 'select' ? (
              <SelectList
                //@ts-ignore
                f={1}
                elements={boardOptions}
                value={templateDialog.boardName}
                setValue={(v) => setTemplateDialog(prev => ({ ...prev, boardName: v }))}
                placeholder="Select a board"
              />
            ) : (
              <Input
                value={lockedBoardName ?? templateDialog.boardName}
                disabled
              />
            )}
          </YStack>
        )}
        {templateDialog.warning ? (
          <Text color="$yellow10" fontSize="$3">{templateDialog.warning}</Text>
        ) : null}
        {templateDialog.error ? (
          <Text color="$red9" fontSize="$3">{templateDialog.error}</Text>
        ) : null}
        {templateDialog.submitting && (
          <Text color="$gray10" fontSize="$3">Loading...</Text>
        )}
        <XStack justifyContent="center" gap="$4" mt="$4">
          <Tinted>
            <Button
              disabled={templateDialog.submitting}
              onPress={resetTemplateDialog}
            >
              Cancel
            </Button>
          </Tinted>
          <Tinted>
            <Button
              disabled={templateDialog.submitting}
              onPress={submitTemplateDialog}
            >
              {actionLabel}
            </Button>
          </Tinted>
        </XStack>
      </YStack>
    </AlertDialog>
  )
}
