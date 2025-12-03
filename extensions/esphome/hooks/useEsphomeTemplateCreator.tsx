import { useState } from 'react'
import { API } from 'protobase'
import { parse as parseYaml } from 'yaml'
import { DevicesModel } from '@extensions/devices/devices/devicesSchemas'

type TemplateDialogState = {
  open: boolean
  device: DevicesModel | null
  yaml: string
  templateName: string
  boardName: string
  error?: string
  submitting: boolean
}

type UseEsphomeTemplateCreatorOptions = {
  deviceDefinitions?: any
  refreshDefinitions?: () => Promise<void> | void
}

const sanitizeTemplateName = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')

export const useEsphomeTemplateCreator = (options: UseEsphomeTemplateCreatorOptions = {}) => {
  const { deviceDefinitions, refreshDefinitions } = options
  const [templateDialog, setTemplateDialog] = useState<TemplateDialogState>({
    open: false,
    device: null,
    yaml: '',
    templateName: '',
    boardName: '',
    error: undefined,
    submitting: false
  })
  const [boardOptions, setBoardOptions] = useState<string[]>([])

  const loadBoards = async () => {
    try {
      const boardsResp = await API.get('/api/core/v1/deviceboards?all=1')
      const boards = boardsResp?.data?.items ?? []
      setBoardOptions(boards.map((b: any) => b?.name).filter(Boolean))
      return boards
    } catch (err) {
      console.error('Error fetching boards list:', err)
      return []
    }
  }

  const resolveBoardName = async (device: DevicesModel, yamlContent: string) => {
    let boardName: string | undefined
    let yamlBoard: string | undefined

    if (device.data.deviceDefinition) {
      const cachedDefinition = deviceDefinitions?.isLoaded
        ? deviceDefinitions.data.items.find((def: any) => def.name === device.data.deviceDefinition)
        : null
      const boardFromCache = cachedDefinition?.board
      if (boardFromCache) {
        boardName = typeof boardFromCache === 'string' ? boardFromCache : boardFromCache?.name
      }

      if (!boardName) {
        const definitionResp = await API.get(`/api/core/v1/devicedefinitions/${device.data.deviceDefinition}`)
        if (!definitionResp?.isError && definitionResp?.data?.board) {
          boardName = typeof definitionResp.data.board === 'string' ? definitionResp.data.board : definitionResp.data.board.name
        }
      }
    }

    if (!boardName) {
      try {
        const parsed = parseYaml(yamlContent || '')
        const parsedBoard = parsed?.esp32?.board || parsed?.esp8266?.board
        if (typeof parsedBoard === 'string') {
          yamlBoard = parsedBoard
        }
      } catch (err) {
        console.error('Error parsing YAML while resolving board:', err)
      }
    }

    if (!boardName && yamlBoard) {
      try {
        const boardsResp = await API.get('/api/core/v1/deviceboards?all=1')
        const boards = boardsResp?.data?.items ?? []
        setBoardOptions(boards.map((b: any) => b?.name).filter(Boolean))
        const matchedBoard = boards.find((board: any) => {
          const esphomeConfig = board?.config?.['esphome-yaml'] ?? board?.config?.esphomeYaml
          const boardId = esphomeConfig?.esp32?.board || esphomeConfig?.esp8266?.board
          return boardId === yamlBoard
        })
        if (matchedBoard?.name) {
          boardName = matchedBoard.name
        }
      } catch (err) {
        console.error('Error looking up device boards while resolving board:', err)
      }
    }

    if (!boardName && yamlBoard) {
      boardName = yamlBoard
    }

    return boardName
  }

  const openCreateTemplateDialog = async (device: DevicesModel) => {
    const configFile = device.getConfigFile()
    if (!configFile) return

    const defaultName = sanitizeTemplateName(`${device.data.name}_template`)
    setTemplateDialog({
      open: true,
      device,
      yaml: '',
      templateName: defaultName,
      boardName: '',
      error: undefined,
      submitting: true
    })

    try {
      await loadBoards()
      const yamlResponse = await API.get('/api/core/v1/files/' + configFile)
      if (yamlResponse?.isError) {
        setTemplateDialog(prev => ({ ...prev, error: 'Could not read device YAML file.', submitting: false }))
        return
      }

      const yamlContent = yamlResponse?.data ?? ''
      const boardName = await resolveBoardName(device, yamlContent)

      setTemplateDialog(prev => ({
        ...prev,
        yaml: yamlContent,
        boardName: boardName ?? '',
        error: undefined,
        submitting: false
      }))
    } catch (err) {
      console.error('Error preparing template dialog:', err)
      setTemplateDialog(prev => ({ ...prev, error: 'Unexpected error while reading the device config.', submitting: false }))
    }
  }

  const submitTemplateDialog = async () => {
    const { device, yaml, templateName, boardName } = templateDialog
    if (!device || !yaml) {
      setTemplateDialog(prev => ({ ...prev, error: 'Missing device data or YAML content.' }))
      return
    }

    const safeTemplateName = sanitizeTemplateName(templateName)
    if (!safeTemplateName) {
      setTemplateDialog(prev => ({ ...prev, error: 'Template name must contain letters, numbers or underscores.' }))
      return
    }

    if (!boardName) {
      setTemplateDialog(prev => ({ ...prev, error: 'Board name is required to create the template.' }))
      return
    }

    setTemplateDialog(prev => ({ ...prev, submitting: true, error: undefined }))

    try {
      const boardResponse = await API.get(`/api/core/v1/deviceboards/${encodeURIComponent(boardName)}`)
      if (boardResponse?.isError || !boardResponse?.data) {
        setTemplateDialog(prev => ({ ...prev, error: 'Could not load board data for the selected board.', submitting: false }))
        return
      }

      const createResponse = await API.post('/api/core/v1/devicedefinitions', {
        name: safeTemplateName,
        sdk: 'esphome-yaml',
        board: boardResponse.data
      })

      if (createResponse?.isError) {
        setTemplateDialog(prev => ({ ...prev, error: `Error creating template: ${JSON.stringify(createResponse?.error) ?? 'Unknown error'}`, submitting: false }))
        return
      }

      const yamlPath = `data/deviceDefinitions/${safeTemplateName}/config.yaml`
      const writeResponse = await API.post(`/api/core/v1/files/${yamlPath}`, { content: yaml })

      if (writeResponse?.isError) {
        setTemplateDialog(prev => ({ ...prev, error: 'Template created but failed to write YAML file.', submitting: false }))
      } else {
        setTemplateDialog({
          open: false,
          device: null,
          yaml: '',
          templateName: '',
          boardName: '',
          error: undefined,
          submitting: false
        })
      }

      await refreshDefinitions?.()
    } catch (err) {
      console.error('Error creating template from YAML:', err)
      setTemplateDialog(prev => ({ ...prev, error: 'Unexpected error while creating the template.', submitting: false }))
    }
  }

  const resetTemplateDialog = () => {
    setTemplateDialog({
      open: false,
      device: null,
      yaml: '',
      templateName: '',
      boardName: '',
      error: undefined,
      submitting: false
    })
  }

  return {
    templateDialog,
    setTemplateDialog,
    openCreateTemplateDialog,
    submitTemplateDialog,
    resetTemplateDialog,
    boardOptions,
  }
}
