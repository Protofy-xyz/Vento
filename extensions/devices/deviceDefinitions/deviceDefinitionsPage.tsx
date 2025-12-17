import React, { useState } from "react"
import { CircuitBoard, Tag, BookOpen, Router, Cog, Upload, Copy } from '@tamagui/lucide-icons'
import { DeviceDefinitionModel } from './deviceDefinitionsSchemas'
import { API, z, getPendingResult } from 'protobase'
import { DeviceCoreModel } from '../devicecores'
import { DeviceBoardModel } from "../deviceBoards"
import { usePendingEffect } from "protolib/lib/usePendingEffect"
import { Chip } from "protolib/components/Chip"
import { DataTable2 } from "protolib/components/DataTable2"
import { DataView, DataViewActionButton } from "protolib/components/DataView"
import { AdminPage } from "protolib/components/AdminPage"
import { PaginatedData } from "protolib/lib/SSR"
import { XStack, YStack, Text, Paragraph, useToastController } from '@my/ui'
import { usePageParams } from "protolib/next"
import { InteractiveIcon } from "protolib/components/InteractiveIcon"
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useRouter } from "next/router"
import { DeviceTemplateDialog, TemplateDialogState } from "../components/DeviceTemplateDialog"
import { TemplateEditor, useTemplateEditor } from "../components/TemplateEditor"

const DeviceDefitionIcons = {
  name: Tag,
  board: CircuitBoard
}

const sourceUrl = '/api/core/v1/devicedefinitions'
const boardsSourceUrl = '/api/core/v1/deviceboards'
const coresSourceUrl = '/api/core/v1/devicecores?all=1'

const createDuplicateDialogState = (): TemplateDialogState => ({
  open: false,
  device: null,
  yaml: '',
  templateName: '',
  description: '',
  boardName: '',
  subsystems: [],
  error: undefined,
  warning: undefined,
  submitting: false,
  overwriteConfirmed: false
})

export default {
  component: ({ workspace, pageState, initialItems, itemData, pageSession, extraData }: any) => {
    const [coresList, setCoresList] = useState(extraData?.cores ?? getPendingResult('pending'))
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const router = useRouter();
    const toast = useToastController()
    const templateEditor = useTemplateEditor()

    usePendingEffect((s) => { API.get({ url: coresSourceUrl }, s) }, setCoresList, extraData?.cores)
    const cores = coresList.isLoaded ? coresList.data.items.map(i => DeviceCoreModel.load(i).getData()) : []
    const { replace } = usePageParams(pageState)
    const ensureDefinitionModel = (value) => {
      if (!value) return value
      return value instanceof DeviceDefinitionModel ? value : DeviceDefinitionModel.load(value?.data ?? value)
    }

    const [boardsList, setBoardsList] = useState(extraData?.boards ?? getPendingResult('pending'))
    usePendingEffect((s) => { API.get({ url: boardsSourceUrl }, s) }, setBoardsList, extraData?.boards)
    const boards = boardsList.isLoaded ? boardsList.data.items.map(i => DeviceBoardModel.load(i).getData()) : []
    const [duplicateDialog, setDuplicateDialog] = useState<TemplateDialogState>(createDuplicateDialogState())
    const [definitionToDuplicate, setDefinitionToDuplicate] = useState<DeviceDefinitionModel | null>(null)

    const generateBoardJs = (boardName) => {
      const board = boards.find((board) => board.name === boardName)
      if (!board) {
        console.error('Board not found')
        return null
      }
      const components = ['mydevice', boardName]
      board.ports.forEach(() => {
        components.push(null)
      })
      return { components: JSON.stringify(components) + ';' }
    }

    // WIP adding upload dialog
    //     extraActions ={[
    //   <DataViewActionButton icon={Upload} description="Upload a Definition" onPress={() => {console.log("Upload button pressed"); setUploadDialogOpen(true);}}>Extra Action 1</DataViewActionButton>,
    // ]}
    const resetDuplicateDialog = () => {
      setDuplicateDialog(createDuplicateDialogState())
      setDefinitionToDuplicate(null)
    }

    const openDuplicateDialog = (definition) => {
      const model = ensureDefinitionModel(definition)
      if (!model) return
      const data = model.getData()
      const defaultName = data?.name ? `${data.name}_copy` : ''
      setDefinitionToDuplicate(model)
      setDuplicateDialog({
        ...createDuplicateDialogState(),
        open: true,
        templateName: defaultName,
        description: data?.description ?? '',
        boardName: typeof data?.board === 'string' ? data.board : data?.board?.name ?? ''
      })
    }

    const submitDuplicateDefinition = async () => {
      if (!definitionToDuplicate) {
        return
      }
      const trimmedName = duplicateDialog.templateName.trim()
      if (!trimmedName) {
        setDuplicateDialog(prev => ({ ...prev, error: 'Name is required' }))
        return
      }
      setDuplicateDialog(prev => ({ ...prev, submitting: true, error: undefined }))
      try {
        const originalResponse = await API.get(`/api/core/v1/devicedefinitions/${encodeURIComponent(definitionToDuplicate.getId())}`)
        if (originalResponse.isError || !originalResponse.data) {
          throw new Error(originalResponse.error?.message ?? 'Unable to load definition')
        }
        const payload = {
          ...originalResponse.data,
          name: trimmedName,
          description: duplicateDialog.description
        }
        const result = await API.post('/api/core/v1/devicedefinitions', payload)
        if (result.isError) {
          throw new Error(result.error?.message ?? 'Unable to duplicate template')
        }
        toast.show('Definition duplicated', { message: trimmedName })
        resetDuplicateDialog()
      } catch (e: any) {
        setDuplicateDialog(prev => ({ ...prev, submitting: false, error: e?.message ?? 'Unable to duplicate template' }))
      }
    }

    const extraMenuActions = [
      {
        text: "Duplicate template",
        icon: Copy,
        action: (element) => openDuplicateDialog(element),
        isVisible: () => true
      }
    ]

    return (<AdminPage title="Device Definitions" workspace={workspace} pageSession={pageSession}>
      <DataView
        entityName={"device definitions"}
        itemData={itemData}
        sourceUrl={sourceUrl}
        initialItems={initialItems}
        onSelectItem={(item) => {
          const definition = ensureDefinitionModel(item)
          if (!definition?.data?.name) return
          templateEditor.openTemplate(definition.data.name)
        }}
        onAdd={(item) => {
          const generatedComponents = generateBoardJs(item.board.name)
          if (generatedComponents) {
            item.config = { components: generatedComponents.components }
          }
          // Open editor after creation (with a small delay to allow the item to be created)
          setTimeout(() => {
            templateEditor.openTemplate(item.name)
          }, 500)
          return item
        }}
        numColumnsForm={1}
        name="Definition"
        onEdit={data => { console.log("DATA (onEdit): ", data); return data }}
        columns={DataTable2.columns(
          DataTable2.column("", () => "", false, (row) => {
            return <InteractiveIcon mt="$2" onPress={() => replace('item', row.name)} Icon={Cog}></InteractiveIcon>
          }, true, '50px'),
          DataTable2.column("name", row => row.name, "name"),
          DataTable2.column("board", row => row.board, "board", (row) => <Chip text={row.board.name} color={'$gray5'} />),
          DataTable2.column("sdk", row => row.sdk, "sdk", (row) => <Chip text={row.sdk} color={'$gray5'} />),
        )}
        extraFieldsForms={{
          sdk: z.union([z.any(), z.any()]).dependsOn("board").generateOptions((formData) => {
            if (formData.board) {
              return cores.find(core => core.name === formData.board.core).sdks
            }
            return []
          }).after("board"),
        }}
        // extraFieldsFormsAdd={{
        //   device: z.boolean().after("board").label("automatic device").defaultValue(true)
        // }}
        model={DeviceDefinitionModel}
        pageState={pageState}
        icons={DeviceDefitionIcons}
        title=""
        toolBarContent={
          <XStack gap="$6">
            <XStack cursor="pointer" hoverStyle={{ opacity: 0.8 }} onPress={() => router.push('/devices')}>
              <Paragraph>
                <Text fontSize="$9" fontWeight="600" color="$color8">
                  Devices
                </Text>
              </Paragraph>
            </XStack>
            <XStack cursor="pointer" hoverStyle={{ opacity: 0.8 }} onPress={() => router.push('/deviceDefinitions')}>
              <Paragraph>
                <Text fontSize="$9" fontWeight="600" color="$color11">
                  Templates
                </Text>
              </Paragraph>
            </XStack>
          </XStack>
        }
        dataTableGridProps={{ itemMinWidth: 300, spacing: 20 }}
        extraMenuActions={extraMenuActions}
      />

      {/* Template Editor Modal */}
      <TemplateEditor {...templateEditor.editorProps} />
      <AlertDialog
        p={"$2"}
        pt="$5"
        pl="$5"
        setOpen={setUploadDialogOpen}
        open={uploadDialogOpen}
        hideAccept={true}
        description={""}
      >
        <YStack f={1} jc="center" ai="center">
          <XStack mr="$5">
            <Text fontWeight={"600"} fontSize={34} color="$color9">Upload your device definition file</Text>
          </XStack>
        </YStack>
      </AlertDialog>
      <DeviceTemplateDialog
        templateDialog={duplicateDialog}
        setTemplateDialog={setDuplicateDialog}
        resetTemplateDialog={resetDuplicateDialog}
        submitTemplateDialog={submitDuplicateDefinition}
        boardOptions={duplicateDialog.boardName ? [duplicateDialog.boardName] : []}
        boardFieldMode="readonly"
        lockedBoardName={duplicateDialog.boardName}
        actionLabel="Duplicate template"
        title="Duplicate template"
      />
    </AdminPage>
    )
  },
  getServerSideProps: PaginatedData(sourceUrl, ['admin'], {
    cores: coresSourceUrl,
    boards: boardsSourceUrl
  })
}