import { SettingModel } from '.'
import { DataView } from 'protolib/components/DataView'
import { AdminPage } from 'protolib/components/AdminPage'
import { usePrompt } from 'protolib/context/PromptAtom'
import { DataTable2 } from 'protolib/components/DataTable2'
import { useState, useEffect, useMemo } from 'react'
import {
  XStack,
  YStack,
  Text,
  Switch,
  Select,
  Adapt,
  Sheet,
  ScrollView,
  Spinner,
  Input,
  Button,
  Popover
} from '@my/ui'
import { Icon } from 'protolib/components/board/ActionCard'
import { Tinted } from 'protolib/components/Tinted'
import { API } from 'protobase'
import { useSession } from 'protolib/lib/useSession'
import { useToastController } from '@my/ui'
import { ChevronDown, Check, Bot, Palette, Code, Shield, Sparkles, Eye, Globe, Cpu, ExternalLink, Wifi, Plus, Pencil, Trash2, MoreVertical, X, ChevronRight, Key } from '@tamagui/lucide-icons'
import { useSettings } from './hooks'
import { FormInput } from 'protolib/components/FormInput'

const sourceUrl = '/api/core/v1/settings'

// ============================================================================
// SETTINGS DEFINITIONS
// ============================================================================

type SettingType = 'boolean' | 'select' | 'text' | 'secret'

interface SettingDefinition {
  key: string
  label: string
  description: string
  type: SettingType
  category: 'ai' | 'appearance' | 'developer' | 'privacy'
  options?: { value: string; label: string }[]
  defaultValue?: string
  icon?: any
  dependsOn?: { key: string; value: string | string[] }
  isKey?: boolean // If true, stored in /api/core/v1/keys instead of settings
}

const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'ai.enabled',
    label: 'Enable AI Features',
    description: 'Show AI chat panel and enable AI-powered features throughout the interface',
    type: 'boolean',
    category: 'ai',
    defaultValue: 'true',
    icon: Sparkles
  },
  {
    key: 'ai.provider',
    label: 'AI Provider',
    description: 'Select which AI service to use for chat and AI features',
    type: 'select',
    category: 'ai',
    options: [
      { value: 'chatgpt', label: 'ChatGPT (OpenAI)' },
      { value: 'llama', label: 'Local AI (LLaMA)' },
      { value: 'lmstudio', label: 'LM Studio' },
      { value: 'skip', label: 'Disabled' }
    ],
    defaultValue: 'chatgpt',
    icon: Bot
  },
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    description: 'Your OpenAI API key for ChatGPT access',
    type: 'secret',
    category: 'ai',
    defaultValue: '',
    icon: Key,
    dependsOn: { key: 'ai.provider', value: 'chatgpt' },
    isKey: true
  },
  {
    key: 'theme.accent',
    label: 'Accent Color',
    description: 'Primary accent color used throughout the interface',
    type: 'select',
    category: 'appearance',
    options: [
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'purple', label: 'Purple' },
      { value: 'pink', label: 'Pink' },
      { value: 'red', label: 'Red' },
      { value: 'orange', label: 'Orange' },
      { value: 'yellow', label: 'Yellow' }
    ],
    defaultValue: 'green',
    icon: Palette
  },
  {
    key: 'code.visible',
    label: 'Show Code Editor',
    description: 'Display code editing panels in the interface',
    type: 'boolean',
    category: 'developer',
    defaultValue: 'true',
    icon: Code
  },
  {
    key: 'cloud.telemetry',
    label: 'Anonymous Telemetry',
    description: 'Send anonymous usage data to help improve Vento',
    type: 'boolean',
    category: 'privacy',
    defaultValue: 'true',
    icon: Globe
  }
]

const CATEGORIES = {
  ai: { label: 'AI & Chat', icon: Bot, description: 'Configure AI providers and chat' },
  appearance: { label: 'Appearance', icon: Palette, description: 'Customize look and feel' },
  developer: { label: 'Developer', icon: Code, description: 'Power user settings' },
  privacy: { label: 'Privacy', icon: Shield, description: 'Data and privacy preferences' }
}

// ============================================================================
// SETTING COMPONENTS
// ============================================================================

const SettingSwitch = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <Tinted>
    <Switch
      size="$4"
      checked={value}
      onCheckedChange={onChange}
      backgroundColor={value ? '$color7' : '$gray6'}
    >
      <Switch.Thumb animation="quick" backgroundColor="white" />
    </Switch>
  </Tinted>
)

const SettingSelect = ({ value, onChange, options }: { 
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) => (
  <Tinted>
    <Select value={value} onValueChange={onChange} disablePreventBodyScroll>
      <Select.Trigger 
        width={200} 
        iconAfter={ChevronDown}
        backgroundColor="transparent"
        borderColor="$color6"
        borderWidth={1}
        hoverStyle={{ borderColor: '$color8' }}
      >
        <Select.Value placeholder="Select..." />
      </Select.Trigger>
      <Adapt when="sm" platform="touch">
        <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
          <Sheet.Frame>
            <Sheet.ScrollView>
              <Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>
          <Sheet.Overlay />
        </Sheet>
      </Adapt>
      <Select.Content zIndex={200000}>
        <Select.Viewport minWidth={200}>
          <Select.Group>
            {options.map((option, i) => (
              <Select.Item key={option.value} index={i} value={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator marginLeft="auto">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select>
  </Tinted>
)

const SettingSecret = ({ value, onChange, placeholder }: { 
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) => {
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value || '')
  const hasValue = value && value.length > 0

  // Update tempValue when value changes (e.g., on load)
  useEffect(() => {
    if (!editing) {
      setTempValue(value || '')
    }
  }, [value, editing])

  if (editing) {
    return (
      <XStack gap="$2" alignItems="center">
        <FormInput
          width={200}
          size="$3"
          placeholder={placeholder || "Enter key..."}
          secureTextEntry
          value={tempValue}
          onChangeText={setTempValue}
          backgroundColor="$gray3"
          borderColor="$color6"
        />
        <Button size="$2" chromeless onPress={() => { setEditing(false); setTempValue(value || '') }}>
          <X size={14} />
        </Button>
        <Tinted>
          <Button size="$2" backgroundColor="$color7" color="white" onPress={() => { onChange(tempValue); setEditing(false) }}>
            <Check size={14} />
          </Button>
        </Tinted>
      </XStack>
    )
  }

  return (
    <XStack gap="$2" alignItems="center">
      <Text fontSize="$3" color={hasValue ? '$color11' : '$color9'} fontFamily="$mono">
        {hasValue ? '••••••••••••' : '(not set)'}
      </Text>
      <Button size="$2" chromeless onPress={() => { setTempValue(value || ''); setEditing(true) }}>
        <Pencil size={14} color="$color10" />
      </Button>
    </XStack>
  )
}

const SettingRow = ({ setting, value, onChange, loading }: { 
  setting: SettingDefinition
  value: any
  onChange: (key: string, value: any, isKey?: boolean) => void
  loading?: boolean
}) => {
  const IconComponent = setting.icon || Eye
  
  const parsedValue = useMemo(() => {
    if (setting.type === 'boolean') return value === true || value === 'true'
    return value ?? setting.defaultValue ?? ''
  }, [value, setting])

  const handleChange = (newValue: any) => {
    if (setting.type === 'boolean') {
      onChange(setting.key, newValue ? 'true' : 'false', setting.isKey)
    } else {
      onChange(setting.key, newValue, setting.isKey)
    }
  }

  return (
    <Tinted>
      <XStack
        padding="$4"
        borderRadius="$4"
        alignItems="center"
        gap="$4"
        borderWidth={2}
        borderColor="transparent"
        backgroundColor="$gray2"
        opacity={loading ? 0.6 : 1}
        hoverStyle={{ borderColor: '$color6', backgroundColor: '$background' }}
        cursor="default"
      >
        <XStack
          width={44}
          height={44}
          borderRadius={12}
          backgroundColor="$color4"
          alignItems="center"
          justifyContent="center"
        >
          <IconComponent size={22} color="$color10" />
        </XStack>

        <YStack flex={1} gap="$1">
          <Text fontSize="$4" fontWeight="600" color="$color12">
            {setting.label}
          </Text>
          <Text fontSize="$2" color="$color10">
            {setting.description}
          </Text>
        </YStack>

        <XStack minWidth={200} justifyContent="flex-end" alignItems="center">
          {loading ? (
            <Spinner size="small" color="$color7" />
          ) : (
            <>
              {setting.type === 'boolean' && <SettingSwitch value={parsedValue} onChange={handleChange} />}
              {setting.type === 'select' && setting.options && (
                <SettingSelect value={parsedValue} onChange={handleChange} options={setting.options} />
              )}
              {setting.type === 'text' && (
                <Text fontSize="$3" color="$color9" fontFamily="$mono">
                  {parsedValue || '(not set)'}
                </Text>
              )}
              {setting.type === 'secret' && (
                <SettingSecret value={parsedValue} onChange={handleChange} placeholder="sk-..." />
              )}
            </>
          )}
        </XStack>
      </XStack>
    </Tinted>
  )
}

const SettingsCategory = ({ category, settings, allValues, onChange, loadingKeys }: { 
  category: keyof typeof CATEGORIES
  settings: SettingDefinition[]
  allValues: Record<string, any>
  onChange: (key: string, value: any, isKey?: boolean) => void
  loadingKeys: Set<string>
}) => {
  const cat = CATEGORIES[category]
  const IconComponent = cat.icon

  const visibleSettings = settings.filter(setting => {
    if (!setting.dependsOn) return true
    const depValue = allValues[setting.dependsOn.key]
    if (Array.isArray(setting.dependsOn.value)) return setting.dependsOn.value.includes(depValue)
    return depValue === setting.dependsOn.value
  })

  if (visibleSettings.length === 0) return null

  return (
    <YStack gap="$3" marginBottom="$5">
      <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
        <IconComponent size={18} color="$color9" />
        <Text fontSize="$3" fontWeight="600" color="$color11" textTransform="uppercase" letterSpacing={1}>
          {cat.label}
        </Text>
      </XStack>
      <YStack gap="$2">
        {visibleSettings.map(setting => (
          <SettingRow
            key={setting.key}
            setting={setting}
            value={allValues[setting.key]}
            onChange={onChange}
            loading={loadingKeys.has(setting.key)}
          />
        ))}
      </YStack>
    </YStack>
  )
}

// ============================================================================
// WIFI NETWORKS SECTION
// ============================================================================

const WIFI_PREFIX = 'wifi.'

type WifiNetwork = { key: string; ssid: string; password: string }

const parseWifiSetting = (key: string, value: any): WifiNetwork | null => {
  if (!key.startsWith(WIFI_PREFIX)) return null
  let ssid = key.slice(WIFI_PREFIX.length)
  let password = ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      ssid = parsed?.ssid ?? ssid
      password = parsed?.password ?? ''
    } catch { password = value }
  } else if (value && typeof value === 'object') {
    ssid = value?.ssid ?? ssid
    password = value?.password ?? ''
  }
  return { key, ssid, password }
}

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-')

const WifiNetworksSection = ({ allSettings, token, onSettingsChange }: { 
  allSettings: Record<string, any>
  token: string
  onSettingsChange: () => void
}) => {
  const toast = useToastController()
  const [networks, setNetworks] = useState<WifiNetwork[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState({ ssid: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    const wifiNetworks: WifiNetwork[] = []
    for (const [key, value] of Object.entries(allSettings)) {
      const network = parseWifiSetting(key, value)
      if (network) wifiNetworks.push(network)
    }
    setNetworks(wifiNetworks.sort((a, b) => a.ssid.localeCompare(b.ssid)))
  }, [allSettings])

  const handleSave = async () => {
    setError('')
    if (!form.ssid.trim() || !form.password.trim()) {
      setError('SSID and password are required')
      return
    }
    setSaving(true)
    const keyName = editingKey || `${WIFI_PREFIX}${slugify(form.ssid)}`
    try {
      let res = await API.post(`/api/core/v1/settings/${keyName}?token=${token}`, { 
        name: keyName, value: { ssid: form.ssid.trim(), password: form.password } 
      })
      if (res.isError && !res.data) {
        res = await API.post(`/api/core/v1/settings?token=${token}`, { 
          name: keyName, value: { ssid: form.ssid.trim(), password: form.password } 
        })
      }
      if (!res.isError) {
        toast.show('Wi-Fi saved', { duration: 1500 })
        setShowForm(false)
        setEditingKey(null)
        setForm({ ssid: '', password: '' })
        onSettingsChange()
      }
    } catch { toast.show('Error saving', { native: true }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (key: string) => {
    setSaving(true)
    try {
      await API.get(`/api/core/v1/settings/${encodeURIComponent(key)}/delete?token=${token}`)
      toast.show('Deleted', { duration: 1500 })
      setOpenMenu(null)
      onSettingsChange()
    } catch { toast.show('Error', { native: true }) }
    finally { setSaving(false) }
  }

  return (
    <YStack gap="$3" marginBottom="$5">
      <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
        <Wifi size={18} color="$color9" />
        <Text fontSize="$3" fontWeight="600" color="$color11" textTransform="uppercase" letterSpacing={1} flex={1}>
          Wi-Fi Networks
        </Text>
        <Tinted>
          <Button size="$2" icon={Plus} onPress={() => { setEditingKey(null); setForm({ ssid: '', password: '' }); setShowForm(true); setError('') }}>
            Add
          </Button>
        </Tinted>
      </XStack>

      <YStack gap="$2">
        {networks.length === 0 && !showForm && (
          <Tinted>
            <XStack
              padding="$4"
              borderRadius="$4"
              borderWidth={2}
              borderColor="transparent"
              backgroundColor="$gray2"
              alignItems="center"
              gap="$3"
            >
              <Wifi size={20} color="$color9" />
              <Text color="$color10" fontSize="$3">
                No networks saved. Add one to speed up device provisioning.
              </Text>
            </XStack>
          </Tinted>
        )}

        {networks.map(network => (
          <Tinted key={network.key}>
            <XStack
              padding="$4"
              borderRadius="$4"
              alignItems="center"
              gap="$4"
              borderWidth={2}
              borderColor="transparent"
              backgroundColor="$gray2"
              hoverStyle={{ borderColor: '$color6', backgroundColor: '$background' }}
            >
              <XStack width={44} height={44} borderRadius={12} backgroundColor="$color4" alignItems="center" justifyContent="center">
                <Wifi size={22} color="$color10" />
              </XStack>
              <YStack flex={1}>
                <Text fontSize="$4" fontWeight="600" color="$color12">{network.ssid}</Text>
                <Text fontSize="$2" color="$color9">{'•'.repeat(Math.min(network.password.length, 12))}</Text>
              </YStack>
              <Popover allowFlip placement="bottom-end" open={openMenu === network.key} onOpenChange={(open) => setOpenMenu(open ? network.key : null)}>
                <Popover.Trigger>
                  <Button size="$3" circular chromeless icon={<MoreVertical size={18} />} />
                </Popover.Trigger>
                <Popover.Content padding="$2" borderRadius="$4" borderWidth={1} borderColor="$color6" backgroundColor="$background" elevate>
                  <YStack gap="$1" minWidth={120}>
                    <Button size="$3" chromeless icon={<Pencil size={14} />} justifyContent="flex-start"
                      onPress={() => { setEditingKey(network.key); setForm({ ssid: network.ssid, password: network.password }); setShowForm(true); setOpenMenu(null); setError('') }}>
                      Edit
                    </Button>
                    <Button size="$3" chromeless icon={<Trash2 size={14} color="$red10" />} justifyContent="flex-start"
                      onPress={() => handleDelete(network.key)} disabled={saving}>
                      <Text color="$red10">Delete</Text>
                    </Button>
                  </YStack>
                </Popover.Content>
              </Popover>
            </XStack>
          </Tinted>
        ))}

        {showForm && (
          <Tinted>
            <YStack padding="$4" borderRadius="$4" borderWidth={2} borderColor="$color6" backgroundColor="$background" gap="$3">
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize="$4" fontWeight="600" color="$color12">
                  {editingKey ? 'Edit Network' : 'Add Network'}
                </Text>
                <Button size="$2" circular chromeless icon={<X size={16} />} onPress={() => setShowForm(false)} />
              </XStack>
              <YStack gap="$2">
                <Text fontSize="$2" fontWeight="500" color="$color11">SSID</Text>
                <Input placeholder="Network name" value={form.ssid} onChangeText={(t) => setForm({ ...form, ssid: t })} 
                  backgroundColor="$gray3" borderColor="transparent" />
              </YStack>
              <YStack gap="$2">
                <Text fontSize="$2" fontWeight="500" color="$color11">Password</Text>
                <FormInput placeholder="Password" secureTextEntry value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} 
                  backgroundColor="$gray3" borderColor="transparent" />
              </YStack>
              {error && <Text fontSize="$2" color="$red10">{error}</Text>}
              <XStack gap="$3" justifyContent="flex-end" marginTop="$1">
                <Button chromeless onPress={() => setShowForm(false)}>Cancel</Button>
                <Button backgroundColor="$color7" color="white" onPress={handleSave} disabled={saving}>
                  {saving ? <Spinner size="small" color="white" /> : (editingKey ? 'Update' : 'Save')}
                </Button>
              </XStack>
            </YStack>
          </Tinted>
        )}
      </YStack>
    </YStack>
  )
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

const SettingsPage = ({ pageSession }: any) => {
  const [session] = useSession()
  const [settings, setSettingsState] = useSettings()
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const toast = useToastController()

  useEffect(() => {
    const load = async () => {
      const token = (session as any)?.token
      if (!token) return
      try {
        // Load settings
        const settingsResult = await API.get(`/api/core/v1/settings/all?token=${token}`)
        if (!settingsResult.isError && settingsResult.data) setSettingsState(settingsResult.data)
        
        // Load keys (for API keys)
        const keysResult = await API.get(`/api/core/v1/keys?all=1&token=${token}`)
        if (!keysResult.isError && keysResult.data?.items) {
          const keysMap: Record<string, string> = {}
          for (const item of keysResult.data.items) {
            keysMap[item.name] = item.value || ''
          }
          setKeys(keysMap)
        }
      } catch (err) { console.error(err) }
      finally { setIsLoading(false) }
    }
    load()
  }, [session])

  const handleSettingChange = async (key: string, value: any, isKey?: boolean) => {
    const token = (session as any)?.token
    if (!token) return
    
    if (isKey) {
      // Handle API key storage
      setKeys(prev => ({ ...prev, [key]: value }))
      setLoadingKeys(prev => new Set(Array.from(prev).concat(key)))
      try {
        let result = await API.post(`/api/core/v1/keys/${key}?token=${token}`, { name: key, value })
        if (result.isError) await API.post(`/api/core/v1/keys?token=${token}`, { name: key, value })
        toast.show('Key saved', { duration: 1000 })
      } catch (err) {
        toast.show('Error saving key', { native: true })
      } finally {
        setLoadingKeys(prev => { const next = new Set(prev); next.delete(key); return next })
      }
    } else {
      // Handle regular settings
      setSettingsState(prev => ({ ...prev, [key]: value }))
      setLoadingKeys(prev => new Set(Array.from(prev).concat(key)))
      try {
        let result = await API.post(`/api/core/v1/settings/${key}?token=${token}`, { name: key, value })
        if (result.isError) await API.post(`/api/core/v1/settings?token=${token}`, { name: key, value })
        toast.show('Saved', { duration: 1000 })
      } catch (err) {
        toast.show('Error', { native: true })
        const result = await API.get(`/api/core/v1/settings/all?token=${token}`)
        if (!result.isError && result.data) setSettingsState(result.data)
      } finally {
        setLoadingKeys(prev => { const next = new Set(prev); next.delete(key); return next })
      }
    }
  }
  
  // Merge settings and keys for display
  const allValues = useMemo(() => ({ ...settings, ...keys }), [settings, keys])

  const settingsByCategory = useMemo(() => {
    const grouped: Record<string, SettingDefinition[]> = {}
    for (const s of SETTINGS_DEFINITIONS) {
      if (!grouped[s.category]) grouped[s.category] = []
      grouped[s.category].push(s)
    }
    return grouped
  }, [])

  return (
    <AdminPage title="Settings" pageSession={pageSession}>
      <ScrollView flex={1}>
        <YStack flex={1} padding="$5" paddingTop="$4" maxWidth={800} width="100%" alignSelf="center">
          
          {isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center" padding="$8">
              <Spinner size="large" color="$color7" />
            </YStack>
          ) : (
            <>
              {Object.keys(CATEGORIES).map(category => (
                <SettingsCategory
                  key={category}
                  category={category as keyof typeof CATEGORIES}
                  settings={settingsByCategory[category] || []}
                  allValues={allValues}
                  onChange={handleSettingChange}
                  loadingKeys={loadingKeys}
                />
              ))}

              <WifiNetworksSection
                allSettings={settings}
                token={(session as any)?.token || ''}
                onSettingsChange={async () => {
                  const result = await API.get(`/api/core/v1/settings/all?token=${(session as any)?.token}`)
                  if (!result.isError && result.data) setSettingsState(result.data)
                }}
              />

              <Tinted>
                <XStack
                  padding="$4"
                  borderRadius="$4"
                  borderWidth={2}
                  borderColor="transparent"
                  backgroundColor="$gray2"
                  alignItems="center"
                  gap="$3"
                  hoverStyle={{ borderColor: '$color6', backgroundColor: '$background', cursor: 'pointer' }}
                  cursor="pointer"
                  onPress={() => window.location.href = '/workspace/settings/raw'}
                >
                  <XStack width={44} height={44} borderRadius={12} backgroundColor="$color4" alignItems="center" justifyContent="center">
                    <Code size={22} color="$color10" />
                  </XStack>
                  <YStack flex={1}>
                    <Text fontSize="$4" fontWeight="600" color="$color12">Advanced Settings</Text>
                    <Text fontSize="$2" color="$color10">View and edit all raw settings</Text>
                  </YStack>
                  <ChevronRight size={20} color="$color9" />
                </XStack>
              </Tinted>
            </>
          )}
        </YStack>
      </ScrollView>
    </AdminPage>
  )
}

// ============================================================================
// RAW SETTINGS PAGE
// ============================================================================

const RawSettingsPage = ({ initialItems, pageSession }: any) => {
  usePrompt(() => initialItems?.isLoaded ? 'Settings: ' + JSON.stringify(initialItems.data) : '')
  return (
    <AdminPage title="Raw Settings" pageSession={pageSession}>
      <DataView
        enableAddToInitialData
        disableViews={["grid"]}
        defaultView={'list'}
        sourceUrl={sourceUrl}
        initialItems={initialItems}
        numColumnsForm={1}
        name="settings"
        model={SettingModel}
        columns={DataTable2.columns(
          DataTable2.column("name", row => row.name, "name", undefined, true, '400px'),
          DataTable2.column("value", row => typeof row.value === "string" ? row.value : JSON.stringify(row.value), "value", undefined, true),
        )}
      />
    </AdminPage>
  )
}

// ============================================================================
// CONFIG PANELS PAGE
// ============================================================================

const configPanels = [
  { name: 'Assets', href: '/workspace/assets', icon: "blocks", description: "Manage system assets" },
  { name: 'Tasks', href: '/workspace/tasks', icon: "zap", description: "Manage automated tasks" },
  { name: 'Devices', href: '/workspace/devices', icon: "router", description: "Manage connected devices" },
  { name: 'Storages', href: '/workspace/objects', icon: "boxes", description: "Manage data storages" },
  { name: 'Files', href: '/workspace/files?path=/', icon: "folder", description: "Manage system files" },
  { name: 'Users', href: '/workspace/users', icon: "users", description: "Manage system users" },
  { name: 'Keys', href: '/workspace/keys', icon: "key", description: "Manage system keys" },
  { name: 'Events', href: '/workspace/events', icon: "activity", description: "View system events" },
  { name: 'Databases', href: '/workspace/databases', icon: "database", description: "Manage databases" },
  { name: 'Settings', href: '/workspace/settings', icon: "cog", description: "Configure system settings" },
  { name: 'Themes', href: '/workspace/themes', icon: "palette", description: "Change or customize themes" }
]

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  'settings': { component: SettingsPage },
  'settings/raw': { component: RawSettingsPage },
  'config': {
    component: ({ pageSession }: any) => (
      <AdminPage title="Config" pageSession={pageSession}>
        <XStack f={1} m="$6" marginTop="$8" flexWrap="wrap" gap="$4" rowGap="$4" justifyContent="flex-start" alignItems="flex-start" alignContent="flex-start">
          <Text paddingLeft="$4" width="100%" fontSize="$9" fontWeight="600" color="$color11">Config Panels</Text>
          {configPanels.map((panel, index) => (
            <a key={index} href={panel.href} style={{ textDecoration: 'none', display: 'inline-flex', flex: '0 0 auto' }}>
              <XStack ai="center" br="$6" width={500} padding="$4" backgroundColor="var(--bgPanel)" f={0} flexShrink={0} gap="$4" animation="quick" hoverStyle={{ opacity: 0.9, cursor: 'pointer' }}>
                <Icon color="var(--color)" name={panel.icon} size={34} style={{ opacity: 0.8 }} />
                <YStack>
                  <Text fontSize="$6" fontWeight="500">{panel.name}</Text>
                  <Text fontSize="$6" color="$color9">{panel.description}</Text>
                </YStack>
              </XStack>
            </a>
          ))}
        </XStack>
      </AdminPage>
    )
  }
}
