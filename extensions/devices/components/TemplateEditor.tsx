import React, { useState, useEffect } from 'react'
import { XStack, YStack, Text, Spinner } from '@my/ui'
import { API } from 'protobase'
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useToastController } from '@my/ui'
import { ConfigEditor } from '../deviceDefinitions/ConfigEditor'
import ESPHomeViewer from '@extensions/esphome/viewers'

/**
 * Target types for the editor:
 * - device: Opens editor based on device's template or config file
 * - definition: Opens editor for a device definition/template
 * - yaml: Opens a direct YAML file
 */
export type EditorTarget =
  | { type: 'device'; deviceName: string }
  | { type: 'definition'; definitionName: string }
  | { type: 'yaml-esphome'; yamlPath: string; yamlTitle?: string }

export type TemplateEditorProps = {
  /** Target to edit (device, definition, or direct yaml) */
  target?: EditorTarget | null
  /** Whether the editor dialog is open */
  open: boolean
  /** Callback when the editor is closed */
  onClose: () => void
  /** Optional callback when saved successfully */
  onSaved?: (name: string) => void
}

type EditorMode = 'visual' | 'yaml-esphome' | 'none'

type EditorState = {
  loading: boolean
  error?: string
  mode: EditorMode
  title: string
  // For visual editor
  definition: any | null
  // For yaml editor
  yamlPath?: string
}

const initialState: EditorState = {
  loading: false,
  error: undefined,
  mode: 'none',
  title: 'Edit',
  definition: null,
  yamlPath: undefined
}

/**
 * Intelligent Template/Config Editor that handles:
 * - Device configs (parses device to find template or config file)
 * - Device definitions/templates (visual or YAML based on SDK)
 * - Direct YAML file editing
 * 
 * Usage with device:
 * ```tsx
 * editor.openDevice('my_device')
 * ```
 * 
 * Usage with definition:
 * ```tsx
 * editor.openDefinition('my_template')
 * ```
 * 
 * Usage with direct YAML:
 * ```tsx
 * editor.openYaml('path/to/file.yaml', 'Title')
 * ```
 */
export const TemplateEditor = ({
  target,
  open,
  onClose,
  onSaved
}: TemplateEditorProps) => {
  const toast = useToastController()
  const [state, setState] = useState<EditorState>(initialState)

  // Load content based on target when opened
  useEffect(() => {
    if (!open || !target) {
      setState(initialState)
      return
    }

    switch (target.type) {
      case 'device':
        loadFromDevice(target.deviceName)
        break
      case 'definition':
        loadFromDefinition(target.definitionName)
        break
      case 'yaml-esphome':
        loadDirectYaml(target.yamlPath, target.yamlTitle)
        break
      default:
        setState(initialState)
    }
  }, [open, target])

  /**
   * Load editor state from a device name
   * - If device has a template, load the template
   * - If device has a config file but no template, open the config file
   */
  const loadFromDevice = async (deviceName: string) => {
    if (!deviceName || deviceName === 'undefined') {
      setState({ ...initialState, error: 'Invalid device name' })
      return
    }

    setState({ ...initialState, loading: true, title: `Loading ${deviceName}...` })

    try {
      // Fetch device data
      const deviceResult = await API.get(`/api/core/v1/devices/${encodeURIComponent(deviceName)}`)
      
      if (deviceResult.isError || !deviceResult.data) {
        setState({ ...initialState, error: `Device "${deviceName}" not found` })
        return
      }

      const device = deviceResult.data
      const templateName = device.deviceDefinition

      // If device has a template, load the template
      if (templateName) {
        await loadFromDefinition(templateName)
        return
      }

      // No template - try to open the device's config file
      const configPath = device.config || `data/devices/${deviceName}/config.yaml`
      
      setState({
        loading: false,
        error: undefined,
        mode: 'yaml-esphome',
        title: `Edit config: ${deviceName}`,
        definition: null,
        yamlPath: configPath
      })
    } catch (err) {
      setState({ ...initialState, error: 'Error loading device' })
    }
  }

  /**
   * Load editor state from a definition/template name
   * - If SDK is esphome-yaml, open YAML editor
   * - Otherwise, open visual ConfigEditor
   */
  const loadFromDefinition = async (definitionName: string) => {
    if (!definitionName || definitionName === 'undefined') {
      setState({ ...initialState, error: 'Invalid definition name' })
      return
    }

    setState({ ...initialState, loading: true, title: `Loading ${definitionName}...` })

    try {
      const result = await API.get(`/api/core/v1/devicedefinitions/${encodeURIComponent(definitionName)}`)
      
      if (result.isError || !result.data) {
        setState({ ...initialState, error: `Template "${definitionName}" not found` })
        return
      }

      const definition = result.data
      const isEsphomeYaml = definition.sdk === 'esphome-yaml'

      if (isEsphomeYaml) {
        // YAML-based template
        const yamlPath = `data/deviceDefinitions/${definitionName}/config.yaml`
        setState({
          loading: false,
          error: undefined,
          mode: 'yaml-esphome',
          title: `Edit template: ${definitionName} (YAML)`,
          definition: null,
          yamlPath
        })
      } else {
        // Visual component-based template
        setState({
          loading: false,
          error: undefined,
          mode: 'visual',
          title: `Edit template: ${definitionName}`,
          definition,
          yamlPath: undefined
        })
      }
    } catch (err) {
      setState({ ...initialState, error: 'Error loading template' })
    }
  }

  /**
   * Load editor state for a direct YAML file
   */
  const loadDirectYaml = (yamlPath: string, yamlTitle?: string) => {
    if (!yamlPath || yamlPath === 'undefined') {
      setState({ ...initialState, error: 'Invalid YAML path' })
      return
    }

    const title = yamlTitle || yamlPath.split('/').pop()?.replace('.yaml', '') || 'Config'
    
    setState({
      loading: false,
      error: undefined,
      mode: 'yaml-esphome',
      title: `Edit: ${title}`,
      definition: null,
      yamlPath
    })
  }

  // Handle save for visual editor (ConfigEditor)
  const handleSaveVisualEditor = async (definition: any) => {
    if (!definition?.name) {
      setState(prev => ({ ...prev, error: 'Template data is invalid' }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }))
    
    const res = await API.post(
      `/api/core/v1/devicedefinitions/${encodeURIComponent(definition.name)}`,
      definition
    )
    
    if (res?.isError) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: res?.error?.message || 'Unable to save template'
      }))
      return
    }

    toast.show('Template updated', { message: definition.name })
    onSaved?.(definition.name)
    onClose()
  }

  // Handle close
  const handleClose = () => {
    setState(initialState)
    onClose()
  }

  // Render content based on mode
  const renderContent = () => {
    if (state.loading) {
      return (
        <XStack alignItems="center" justifyContent="center" flex={1} gap="$2">
          <Spinner size="small" />
          <Text color="$gray10">Loading…</Text>
        </XStack>
      )
    }

    if (state.error) {
      return (
        <YStack alignItems="center" justifyContent="center" flex={1}>
          <Text color="$red9">{state.error}</Text>
        </YStack>
      )
    }

    // YAML editor
    if (state.mode === 'yaml-esphome' && state.yamlPath) {
      return (
        <YStack flex={1} width="100%">
          <ESPHomeViewer
            path={state.yamlPath}
            name={state.title}
          />
        </YStack>
      )
    }

    // Visual editor
    if (state.mode === 'visual' && state.definition) {
      return (
        <ConfigEditor
          definition={state.definition}
          onSave={handleSaveVisualEditor}
          onCancel={handleClose}
        />
      )
    }

    return (
      <YStack alignItems="center" justifyContent="center" flex={1}>
        <Text color="$gray11">Nothing to edit.</Text>
      </YStack>
    )
  }

  return (
    <AlertDialog
      open={open}
      setOpen={(isOpen) => {
        if (!isOpen) handleClose()
      }}
      title={state.title}
      description=""
      hideAccept
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <YStack width="min(1200px, 90vw)" height="80vh" padding="$2" gap="$3">
        {renderContent()}
      </YStack>
    </AlertDialog>
  )
}

/**
 * Hook to manage template/config editor state
 * 
 * Usage:
 * ```tsx
 * const editor = useTemplateEditor()
 * 
 * // Open editor for a device (auto-detects template or config)
 * editor.openDevice('my_device')
 * 
 * // Open editor for a definition/template
 * editor.openDefinition('my_template')
 * 
 * // Open a direct YAML file
 * editor.openYaml('path/to/config.yaml', 'My Config')
 * 
 * // Render
 * <TemplateEditor {...editor.editorProps} />
 * ```
 */
export const useTemplateEditor = (options?: {
  onSaved?: (name: string) => void
}) => {
  const [state, setState] = useState<{
    open: boolean
    target: EditorTarget | null
  }>({
    open: false,
    target: null
  })

  /**
   * Open editor for a device
   * Will auto-detect if device has a template or config file
   */
  const openDevice = (deviceName: string) => {
    if (!deviceName || deviceName === 'undefined') return
    setState({ open: true, target: { type: 'device', deviceName } })
  }

  /**
   * Open editor for a definition/template
   * Will auto-detect if it's visual or YAML based
   */
  const openDefinition = (definitionName: string) => {
    if (!definitionName || definitionName === 'undefined') return
    setState({ open: true, target: { type: 'definition', definitionName } })
  }

  /**
   * Open editor for a direct YAML file
   */
  const openYaml = (yamlPath: string, yamlTitle?: string) => {
    if (!yamlPath || yamlPath === 'undefined') return
    setState({ open: true, target: { type: 'yaml-esphome', yamlPath, yamlTitle } })
  }

  // Legacy aliases for backwards compatibility
  const openTemplate = openDefinition
  const openEditor = openDefinition

  const closeEditor = () => {
    setState({ open: false, target: null })
  }

  const editorProps: TemplateEditorProps = {
    open: state.open,
    onClose: closeEditor,
    onSaved: options?.onSaved,
    target: state.target
  }

  return {
    // Primary methods
    openDevice,
    openDefinition,
    openYaml,
    closeEditor,
    
    // Legacy aliases
    openTemplate,
    openEditor,
    
    // State
    isOpen: state.open,
    target: state.target,
    editorProps
  }
}

export default TemplateEditor
