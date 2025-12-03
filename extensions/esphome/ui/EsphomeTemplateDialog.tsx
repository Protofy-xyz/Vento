import React from 'react'
import { AlertDialog } from 'protolib/components/AlertDialog'
import { Tinted } from 'protolib/components/Tinted'
import { SelectList } from 'protolib/components/SelectList'
import { Button, Input, Text, XStack, YStack } from '@my/ui'

type TemplateDialogState = {
  open: boolean
  device: any
  yaml: string
  templateName: string
  description: string
  boardName: string
  subsystems: any[]
  error?: string
  submitting: boolean
}

type EsphomeTemplateDialogProps = {
  templateDialog: TemplateDialogState
  setTemplateDialog: React.Dispatch<React.SetStateAction<TemplateDialogState>>
  resetTemplateDialog: () => void
  submitTemplateDialog: () => Promise<void> | void
  boardOptions: string[]
}

export const EsphomeTemplateDialog = ({
  templateDialog,
  setTemplateDialog,
  resetTemplateDialog,
  submitTemplateDialog,
  boardOptions
}: EsphomeTemplateDialogProps) => {
  return (
    <AlertDialog
      open={templateDialog.open}
      setOpen={(open) => {
        if (!open) resetTemplateDialog()
      }}
      title="Create template from ESPHome device"
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
            onChangeText={(v) => setTemplateDialog(prev => ({ ...prev, templateName: v }))}
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
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600" color="$gray11">Board</Text>
          <SelectList
            //@ts-ignore
            f={1}
            elements={boardOptions}
            value={templateDialog.boardName}
            setValue={(v) => setTemplateDialog(prev => ({ ...prev, boardName: v }))}
            placeholder="Select a board"
          />
        </YStack>
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
              Create template
            </Button>
          </Tinted>
        </XStack>
      </YStack>
    </AlertDialog>
  )
}
