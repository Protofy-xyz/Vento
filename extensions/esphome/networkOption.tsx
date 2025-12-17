import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react'
import { getPendingResult, API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, useToastController, Button, Text, Stack, Input, Spinner, Popover } from "@my/ui"
import { DevicesModel } from '../devices/devices/devicesSchemas'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { Tinted } from 'protolib/components/Tinted'
import { FormInput } from 'protolib/components/FormInput'
import { MoreVertical, Pencil, Trash2, Search, UploadCloud } from '@tamagui/lucide-icons'
import type { NetworkOption } from '../network/options'
import { PublicIcon } from 'protolib/components/IconSelect'
import { TemplateEditor, useTemplateEditor } from '../devices/components/TemplateEditor'
import { useEsphomeDeviceActions } from './hooks/useEsphomeDeviceActions'

const sourceUrl = '/api/core/v1/devices'
const definitionsSourceUrl = '/api/core/v1/deviceDefinitions?all=1'
const boardsSourceUrl = '/api/core/v1/deviceboards?all=1'
const wifiPrefix = 'wifi.'

type WifiNetwork = {
    key: string
    ssid: string
    password: string
}

type SelectableItem = {
    id: string
    name: string
    icon?: string
    image?: string
    description?: string
    extra?: Record<string, any>
}

// Reusable search input component
const SearchInput = ({ value, onChange, placeholder }: { 
    value: string
    onChange: (text: string) => void
    placeholder: string 
}) => (
    <XStack position="relative">
        <Search size={18} style={{ position: 'absolute', left: 12, top: 14, opacity: 0.7 }} />
        <Input
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            size="$4"
            paddingLeft={40}
            backgroundColor="$gray3"
            borderColor="$gray6"
            borderWidth={1}
            outlineColor="$gray8"
        />
    </XStack>
)

// Reusable icon renderer
const ItemIcon = ({ icon, name }: { icon?: string, name: string }) => {
    if (!icon) return null
    const isUrl = icon.includes('/') || icon.startsWith('http')
    return isUrl ? (
        <img src={icon} alt={name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }} />
    ) : (
        <PublicIcon name={icon} size={22} color="var(--color10)" />
    )
}

// Reusable preview image
const PreviewImage = ({ src, alt }: { src?: string, alt: string }) => {
    if (!src) return null
    return (
        <img
            src={src}
            alt={alt}
            style={{
                width: 440,
                maxWidth: "100%",
                height: "auto",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 10,
                display: "block"
            }}
        />
    )
}

// Reusable selectable list item
const SelectableListItem = ({ item, active, onSelect }: {
    item: SelectableItem
    active: boolean
    onSelect: () => void
}) => (
    <YStack
        key={item.id}
        onPress={onSelect}
        cursor="pointer"
        padding="$3"
        borderRadius="$4"
        backgroundColor={active ? "$color3" : "$gray2"}
        borderWidth={1}
        borderColor={active ? "$color7" : "$gray5"}
        alignItems="flex-start"
        hoverStyle={{ borderColor: '$color7', backgroundColor: '$color2' }}
    >
        <XStack gap="$3" alignItems="center">
            <ItemIcon icon={item.icon} name={item.name} />
            <Text fontWeight="700" color="$color11">{item.name}</Text>
        </XStack>
    </YStack>
)

// Reusable list with preview layout
const ListPreviewLayout = ({
    items,
    selectedId,
    onSelect,
    search,
    onSearchChange,
    searchPlaceholder,
    emptyMessage,
    renderPreview,
    error,
    loading,
    loadingMessage
}: {
    items: SelectableItem[]
    selectedId: string | null
    onSelect: (id: string) => void
    search: string
    onSearchChange: (text: string) => void
    searchPlaceholder: string
    emptyMessage: string
    renderPreview: (item: SelectableItem | undefined) => React.ReactNode
    error?: string
    loading?: boolean
    loadingMessage?: string
}) => {
    const normalizedQuery = search.trim().toLowerCase()
    const filteredItems = normalizedQuery
        ? items.filter(item => `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase().includes(normalizedQuery))
        : items

    const selectedItem = filteredItems.find(item => item.id === selectedId) || filteredItems[0]

    if (loading) {
        return (
            <XStack alignItems="center" gap="$2">
                <Spinner size="small" />
                <Text color="$gray10">{loadingMessage || 'Loading...'}</Text>
            </XStack>
        )
    }

    if (items.length === 0) {
        return <Text color="$gray11">{emptyMessage}</Text>
    }

    return (
        <YStack gap="$3" width="100%">
            {error && <Text color="$red9" fontSize="$2">{error}</Text>}
            <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
            <XStack gap="$4" alignItems="flex-start" width="100%" height={520}>
                {/* Left: List */}
                <YStack width={380} flexShrink={0} height="100%">
                    <ScrollView style={{ width: '100%', flexShrink: 0, flexGrow: 0, minHeight: 360 }}>
                        <YStack gap="$2" padding="$1">
                            {filteredItems.length === 0 ? (
                                <YStack padding="$3" borderRadius="$4" borderWidth={1} borderColor="$gray5" backgroundColor="$gray2">
                                    <Text color="$gray10">No items match your search.</Text>
                                </YStack>
                            ) : (
                                filteredItems.map(item => (
                                    <SelectableListItem
                                        key={item.id}
                                        item={item}
                                        active={selectedItem?.id === item.id}
                                        onSelect={() => onSelect(item.id)}
                                    />
                                ))
                            )}
                        </YStack>
                    </ScrollView>
                </YStack>

                {/* Right: Preview */}
                <YStack
                    flex={1}
                    height="100%"
                    backgroundColor="$gray2"
                    borderWidth={1}
                    borderColor="$gray4"
                    borderRadius="$4"
                    padding="$4"
                >
                    <ScrollView style={{ width: '100%' }}>
                        <YStack gap="$3" alignItems="flex-start" paddingBottom="$2">
                            {renderPreview(selectedItem)}
                        </YStack>
                    </ScrollView>
                </YStack>
            </XStack>
        </YStack>
    )
}

const TemplateSlide = ({ selected, setSelected, definitions }: {
    selected: string
    setSelected: (id: string) => void
    definitions: any
}) => {
    const [search, setSearch] = useState('')
    
    const items: SelectableItem[] = [
        { id: '__none__', name: 'Blank Device', description: 'Create a device from scratch!', icon: 'cpu' },
        ...(definitions?.data?.items || []).map((def: any) => ({
            id: def.name,
            name: def.name,
            description: def.description?.trim() || `Board: ${def.board?.name || def.board || 'Unknown'}`,
            icon: def.board?.icon,
            image: def.board?.image
        }))
    ]

    return (
        <YStack gap="$3" width="100%">
            <ListPreviewLayout
                items={items}
                selectedId={selected}
                onSelect={setSelected}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search templates…"
                emptyMessage="No templates available."
                renderPreview={(item) => item ? (
                    <>
                        <Text fontSize="$7" fontWeight="700" color="$color11">{item.name}</Text>
                        <PreviewImage src={item.image} alt={item.name} />
                        <Text color="$gray10" fontSize="$4">{item.description || 'No description available.'}</Text>
                    </>
                ) : (
                    <Text color="$gray9">Select a template to see details</Text>
                )}
            />
            <Spacer marginBottom="$8" />
        </YStack>
    )
}

const BoardSlide = ({ boards, selectedBoard, setSelectedBoard, error }: {
    boards: any
    selectedBoard: string | null
    setSelectedBoard: (value: string) => void
    error?: string
}) => {
    const [search, setSearch] = useState('')
    
    const items: SelectableItem[] = (boards?.data?.items || [])
        .map((board: any) => ({
            id: board.name,
            name: board.name,
            icon: board.icon,
            image: board.image,
            extra: { core: board.core }
        }))
        .sort((a: SelectableItem, b: SelectableItem) => a.name.localeCompare(b.name))

    return (
        <YStack gap="$3" marginBottom="$4" width="100%">
            <ListPreviewLayout
                items={items}
                selectedId={selectedBoard}
                onSelect={setSelectedBoard}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search boards…"
                emptyMessage="No boards found. Please create a board first."
                error={error}
                loading={!boards?.isLoaded}
                loadingMessage="Loading boards…"
                renderPreview={(item) => item ? (
                    <>
                        <Text fontSize="$7" fontWeight="700" color="$color11">{item.name}</Text>
                        {item.image ? (
                            <PreviewImage src={item.image} alt={item.name} />
                        ) : (
                            <Text color="$gray9">No image available</Text>
                        )}
                        {item.extra?.core && (
                            <Text color="$gray10" fontWeight="500">Core: {item.extra.core}</Text>
                        )}
                    </>
                ) : (
                    <Text color="$gray9">Select a board to see details</Text>
                )}
            />
        </YStack>
    )
}

const isNameValid = (text) => {
    return text === '' ? false : /^[a-z0-9_]+$/.test(text)
}

const ConfigureSlide = ({ data, setData, errorMessage = '' }) => {
    const [error, setError] = useState('')

    useEffect(() => setError(errorMessage), [errorMessage])

    const handleChange = (text: string) => {
        if (!isNameValid(text)) {
            setError('Name is required and must use only lowercase letters, numbers or underscores')
        } else {
            setError('')
        }
        setData({ ...data, name: text })
    }

    return <YStack alignItems="center" paddingVertical="$2">
        <YStack width="400px" gap="$2">
            <Text fontSize="$4" color="$gray11">Device Name</Text>
            <Input flex={1} value={data?.name || ''} onChangeText={handleChange} placeholder="my_esp32_device" />
            {error ? <Text marginLeft="$2" fontSize="$2" color="$red8">{error}</Text> : null}
        </YStack>
    </YStack>
}

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-')

const parseWifiKey = (item: any): WifiNetwork | null => {
    const name = item?.name ?? item?.data?.name ?? ''
    if (!name.startsWith(wifiPrefix)) return null

    const rawValue = item?.value ?? item?.data?.value ?? item?.data
    let ssid = name.slice(wifiPrefix.length)
    let password = ''

    if (typeof rawValue === 'string') {
        try {
            const parsed = JSON.parse(rawValue)
            ssid = parsed?.ssid ?? ssid
            password = parsed?.password ?? ''
        } catch (e) {
            password = rawValue ?? ''
        }
    } else if (rawValue && typeof rawValue === 'object') {
        ssid = rawValue?.ssid ?? ssid
        password = rawValue?.password ?? ''
    }

    return {
        key: name,
        ssid,
        password
    }
}

type WifiStepHandle = {
    ensureSelection: () => Promise<WifiNetwork | null>
}

type WifiStepProps = { active: boolean, wifiError?: string, onClearError?: () => void }

const WifiStep = forwardRef<WifiStepHandle, WifiStepProps>(
({ active, wifiError, onClearError }, ref) => {
    const toast = useToastController()
    const [networks, setNetworks] = useState<WifiNetwork[]>([])
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [form, setForm] = useState<{ ssid: string, password: string, key?: string }>({ ssid: '', password: '', key: undefined })
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [openMenu, setOpenMenu] = useState<string | null>(null)

    const loadNetworks = async () => {
        setLoading(true)
        try {
            const res = await API.get('/api/core/v1/settings?all=1')
            if (!res.isError) {
                const items = res?.data?.items ?? res?.data ?? []
                const parsed = items
                    .map(parseWifiKey)
                    .filter((n: WifiNetwork | null) => !!n) as WifiNetwork[]

                const sorted = parsed.sort((a, b) => a.ssid.localeCompare(b.ssid))
                setNetworks(sorted)
                if (sorted.length) {
                    setSelectedKey(sorted[0].key)
                    setForm({ ssid: sorted[0].ssid, password: sorted[0].password, key: sorted[0].key })
                    setShowForm(false)
                } else {
                    setSelectedKey(null)
                    setForm({ ssid: '', password: '', key: undefined })
                    setShowForm(true)
                }
            } else {
                toast.show('Unable to load Wi-Fi credentials', { message: res?.error?.message })
            }
        } catch (e) {
            toast.show('Unable to load Wi-Fi credentials')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (active) {
            loadNetworks()
        }
    }, [active])

    const handleSelect = (key: string, options: { keepForm?: boolean } = {}) => {
        const selected = networks.find(n => n.key === key)
        if (!selected) return
        setSelectedKey(key)
        setForm({ ssid: selected.ssid, password: selected.password, key })
        setError('')
        setShowForm(!!options.keepForm)
        setOpenMenu(null)
        onClearError?.()
    }

    const upsertNetwork = async (): Promise<WifiNetwork | null> => {
        setError('')
        if (!form.ssid.trim() || !form.password.trim()) {
            setError('SSID and password are required')
            return null
        }
        setSaving(true)
        const keyName = form.key ?? `${wifiPrefix}${slugify(form.ssid) || form.ssid}`
        const payloadValue = { ssid: form.ssid.trim(), password: form.password }
        try {
            let res = await API.post(`/api/core/v1/settings/${keyName}`, { name: keyName, value: payloadValue })
            if (res.isError && !res.data) {
                res = await API.post('/api/core/v1/settings', { name: keyName, value: payloadValue })
            }

            if (res.isError) {
                toast.show('Error saving Wi-Fi network', { message: res?.error?.message })
                return null
            }

            const saved: WifiNetwork = { key: keyName, ssid: form.ssid.trim(), password: form.password }
            setNetworks(prev => {
                const others = prev.filter(n => n.key !== keyName)
                return [...others, saved].sort((a, b) => a.ssid.localeCompare(b.ssid))
            })
            setSelectedKey(keyName)
            setForm({ ssid: saved.ssid, password: saved.password, key: keyName })
            setShowForm(false)
            toast.show('Wi-Fi saved', { message: saved.ssid })
            onClearError?.()
            return saved
        } catch (e) {
            toast.show('Error saving Wi-Fi network')
            return null
        } finally {
            setSaving(false)
        }
    }

    const startNew = () => {
        setSelectedKey(null)
        setForm({ ssid: '', password: '', key: undefined })
        setError('')
        setShowForm(true)
        onClearError?.()
    }

    useImperativeHandle(ref, () => ({
        ensureSelection: async () => {
            if (!selectedKey && networks.length > 0) {
                // Fallback to first network to avoid stalled create flow
                const first = networks[0]
                setSelectedKey(first.key)
                setForm({ ssid: first.ssid, password: first.password, key: first.key })
            }

            if (selectedKey) {
                const selected = networks.find(n => n.key === selectedKey)
                if (selected) {
                    if (selected.ssid !== form.ssid || selected.password !== form.password) {
                        return await upsertNetwork()
                    }
                    return selected
                }
            }
            if (!form.ssid && !form.password) {
                return null
            }
            return await upsertNetwork()
        }
    }))

    const handleDelete = async (key: string) => {
        setSaving(true)
        try {
            const res = await API.get(`/api/core/v1/settings/${encodeURIComponent(key)}/delete`)
            if (res?.isError) throw new Error(res?.error || 'Delete failed')
            setNetworks(prev => prev.filter(n => n.key !== key))
            if (selectedKey === key) {
                setSelectedKey(null)
                setForm({ ssid: '', password: '', key: undefined })
                setShowForm(false)
            }
        } catch (e) {
            toast.show('Error deleting Wi-Fi')
        } finally {
            setSaving(false)
        }
    }

    return (
        <YStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$4" gap="$3" width="100%" maxWidth={820} alignSelf="center">
            {wifiError ? <Text color="$red9" fontSize="$2" marginBottom="$1">{wifiError}</Text> : null}
            {loading ? (
                <XStack alignItems="center" gap="$2">
                    <Spinner size="small" /> <Text color="$gray10">Loading saved Wi-Fi networks…</Text>
                </XStack>
            ) : (
                <>
                    <YStack gap="$3" boc="$color6" bw={1} br="$5" p="$3" bc="$bg">
                        <XStack justifyContent="space-between" alignItems="center" paddingBottom="$2">
                            <Text fontWeight="700" fontSize="$6">Saved networks</Text>
                            <Tinted>
                                <Button size="$3" onPress={startNew}>Add Wi-Fi</Button>
                            </Tinted>
                        </XStack>
                        {networks.length > 0 ? (
                            <ScrollView maxHeight={240} paddingHorizontal="$2" paddingVertical="$2">
                                <YStack gap="$3">
                                    {networks.map(net => {
                                        const isSelected = selectedKey === net.key
                                        return (
                                            <Tinted key={net.key} tint={isSelected ? 'primary' : undefined}>
                                                <YStack
                                                    padding="$3"
                                                    borderWidth={1}
                                                    borderColor={isSelected ? '$color9' : '$color6'}
                                                    borderRadius="$4"
                                                    backgroundColor={isSelected ? '$color2' : '$bg'}
                                                    gap="$2"
                                                    cursor="pointer"
                                                    hoverStyle={{ borderColor: '$color9' }}
                                                    onPress={() => handleSelect(net.key)}
                                                >
                                                    <XStack justifyContent="space-between" alignItems="center" gap="$3">
                                                        <YStack gap="$1">
                                                            <Text fontWeight="700" color="$color11">{net.ssid}</Text>
                                                        </YStack>
                                                        <Popover
                                                            allowFlip
                                                            placement="bottom-end"
                                                            open={openMenu === net.key}
                                                            onOpenChange={(open) => setOpenMenu(open ? net.key : null)}
                                                        >
                                                            <Popover.Trigger>
                                                                <Button
                                                                    size="$2"
                                                                    circular
                                                                    icon={<MoreVertical size={16} />}
                                                                    onPress={(e) => { e?.stopPropagation?.(); setOpenMenu(net.key) }}
                                                                />
                                                            </Popover.Trigger>
                                                            <Popover.Content padding="$2" br="$4" bw={1} boc="$color6" bc="$color1" onPress={(e) => e?.stopPropagation?.()}>
                                                                <YStack gap="$2" minWidth={160}>
                                                                    <Button
                                                                        size="$3"
                                                                        icon={<Pencil size={16} />}
                                                                        onPress={(e) => { e?.stopPropagation?.(); handleSelect(net.key, { keepForm: true }) }}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Tinted tint="red">
                                                                        <Button
                                                                            size="$3"
                                                                            icon={<Trash2 size={16} />}
                                                                            onPress={(e) => { e?.stopPropagation?.(); handleDelete(net.key) }}
                                                                            disabled={saving}
                                                                        >
                                                                            Delete
                                                                        </Button>
                                                                    </Tinted>
                                                                </YStack>
                                                            </Popover.Content>
                                                        </Popover>
                                                    </XStack>
                                                </YStack>
                                            </Tinted>
                                        )
                                    })}
                                </YStack>
                            </ScrollView>
                        ) : (
                            <YStack gap="$2">
                                <Text color="$gray11">No Wi-Fi credentials found yet.</Text>
                                <Text color="$gray10" fontSize="$2">Add one to speed up provisioning.</Text>
                            </YStack>
                        )}
                    </YStack>

                    {showForm && (
                        <YStack gap="$3" boc="$color6" bw={1} br="$5" p="$3" bc="$bg">
                            <Text fontWeight="700" fontSize="$6">{form.key ? 'Edit Wi-Fi' : 'New Wi-Fi'}</Text>
                            <YStack gap="$2">
                                <Text fontSize="$3" fontWeight="600" color="$gray11">SSID</Text>
                                <Input
                                    placeholder="SSID"
                                    value={form.ssid}
                                    onChangeText={(text) => setForm({ ...form, ssid: text })}
                                />
                            </YStack>
                            <YStack gap="$2">
                                <Text fontSize="$3" fontWeight="600" color="$gray11">Password</Text>
                                <FormInput
                                    placeholder="Password"
                                    secureTextEntry
                                    value={form.password}
                                    onChangeText={(text) => setForm({ ...form, password: text })}
                                />
                            </YStack>
                            {error ? <Text color="$red9" fontSize="$2">{error}</Text> : <Text height="$1" />}
                            <XStack gap="$2" justifyContent="flex-end" marginTop="$2">
                                <Button width={180} onPress={upsertNetwork} disabled={saving}>
                                    {form.key ? 'Update Wi-Fi' : 'Save Wi-Fi'}
                                </Button>
                            </XStack>
                        </YStack>
                    )}
                </>
            )}
        </YStack>
    )
})
WifiStep.displayName = 'WifiStep'

const DevicesWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const [data, setData] = useState({ template: '__none__', name: '' })
    const [error, setError] = useState('')
    const [wifiError, setWifiError] = useState('')
    const [definitions, setDefinitions] = useState(getPendingResult('pending'))
    const [boards, setBoards] = useState(getPendingResult('pending'))
    const [step, setStep] = useState(0)
    const [selectedBoard, setSelectedBoard] = useState<string | null>(null)
    const [boardError, setBoardError] = useState('')
    const wifiStepRef = useRef<WifiStepHandle>(null)
    
    // State for the new flow
    const [createdTemplateName, setCreatedTemplateName] = useState<string | null>(null)
    const [savedWifi, setSavedWifi] = useState<WifiNetwork | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [createdDevice, setCreatedDevice] = useState<DevicesModel | null>(null)
    
    // Device actions for upload
    const { flashDevice, ui: deviceActionsUi } = useEsphomeDeviceActions()
    
    // Template editor
    const templateEditor = useTemplateEditor()

    const isBlankDevice = data.template === '__none__'
    const slides = [
        { id: 'basics', name: "Basics", title: "Device Basics" },
        { id: 'template', name: "Template", title: "Select a Template (optional)" },
        ...(isBlankDevice ? [{ id: 'board', name: "Board", title: "Select the board for your device" }] : []),
        ...(isBlankDevice ? [{ id: 'edit-template', name: "Edit Template", title: "Edit your Device Template" }] : []),
        { id: 'upload', name: "Upload", title: "Upload Firmware" }
    ]

    const totalSlides = slides.length
    const currentSlide = slides[step]

    const titlesUpToCurrentStep = slides
        .filter((_, index) => index <= step)
        .map(slide => slide.name)
        .join(" / ")

    usePendingEffect((s) => { API.get({ url: definitionsSourceUrl }, s) }, setDefinitions, undefined)
    usePendingEffect((s) => { API.get({ url: boardsSourceUrl }, s) }, setBoards, undefined)

    useEffect(() => {
        if (!isBlankDevice) {
            setSelectedBoard(null)
            setBoardError('')
            return
        }
        if (boards?.isLoaded) {
            const items = boards?.data?.items ?? []
            if (!selectedBoard && items.length) {
                setSelectedBoard(items[0].name)
            }
        }
    }, [isBlankDevice, boards?.isLoaded])

    useEffect(() => {
        if (step > slides.length - 1) {
            setStep(slides.length - 1)
        }
    }, [slides.length])

    const handleBack = () => {
        if (step === 0 && onBack) {
            onBack()
        } else if (step > 0) {
            setStep(step - 1)
        }
    }

    // Helper to build components string for templates
    const buildComponents = (boardInfo: any, wifi: WifiNetwork, mqttUrl?: string | null) => {
        const entries: string[] = [`"mydevice"`, `"${selectedBoard}"`]
        const ports = boardInfo?.ports || []
        const wifiComponent = `wifi("${wifi.ssid}", "${wifi.password}", "none")`
        const mqttComponent = mqttUrl ? `mqtt("${mqttUrl}")` : null

        const normalizeType = (t: any) => (typeof t === 'string' ? t.toLowerCase() : '')
        const isIoCapable = (t: string) => t === 'io' || t === 'i' || t === 'o'

        const virtualIndexes = ports
            .map((p: any, idx: number) => ({ idx, type: normalizeType(p?.type) }))
            .filter((p: any) => p.type === 'virtual')
            .map((p: any) => p.idx)

        const ioIndexes = ports
            .map((p: any, idx: number) => ({ idx, type: normalizeType(p?.type) }))
            .filter((p: any) => isIoCapable(p.type))
            .map((p: any) => p.idx)

        const pickIndex = (list: number[], exclude: number | null) => {
            for (const idx of list) {
                if (exclude === null || idx !== exclude) return idx
            }
            return null
        }

        const wifiIdx = virtualIndexes[0] ?? ioIndexes[0] ?? null
        const mqttIdx = mqttComponent
            ? (pickIndex(virtualIndexes, wifiIdx) ?? pickIndex(ioIndexes, wifiIdx) ?? null)
            : null

        const totalPorts = Math.max(ports.length, (wifiIdx !== null ? wifiIdx + 1 : 0), (mqttIdx !== null ? mqttIdx + 1 : 0), 2)

        for (let i = 0; i < totalPorts; i++) {
            if (i === wifiIdx) {
                entries.push(wifiComponent)
            } else if (i === mqttIdx && mqttComponent) {
                entries.push(mqttComponent)
            } else {
                entries.push('null')
            }
        }

        entries.push('null')
        return `[\n  ${entries.join(',\n  ')}\n];`
    }

    // Helper to get MQTT host from network address API
    const getMqttHost = async (): Promise<string> => {
        try {
            const resp = await API.get('/api/core/v1/netaddr/vento')
            const baseUrl = resp?.data?.baseUrl
            if (baseUrl) {
                const parsed = new URL(baseUrl)
                return parsed.hostname
            }
        } catch (err) {
            // fall back to localhost
        }
        return 'localhost'
    }

    // Create template only (for blank devices)
    const createTemplateOnly = async (wifi: WifiNetwork): Promise<boolean> => {
        if (!selectedBoard) {
            setBoardError('Please select a board')
            return false
        }

        setIsCreating(true)
        setError('')

        try {
            const templateName = `${data.name}_template`

            // Load board details and MQTT host in parallel
            const [boardResp, mqttHost] = await Promise.all([
                API.get(`/api/core/v1/deviceboards/${encodeURIComponent(selectedBoard)}`),
                getMqttHost()
            ])
            
            if (boardResp?.isError || !boardResp?.data) {
                setBoardError('Unable to load selected board')
                setIsCreating(false)
                return false
            }
            const boardData = boardResp.data

            // Create template with WiFi and actual MQTT host
            const definitionPayload = {
                name: templateName,
                sdk: 'esphome-idf',
                board: boardData,
                description: `ESPHome template for ${data.name}`,
                config: {
                    components: buildComponents(boardData, wifi, mqttHost),
                    sdkConfig: boardData?.config?.['esphome-idf'] ?? {}
                }
            }

            let definitionResult = await API.post('/api/core/v1/devicedefinitions', definitionPayload)
            if (definitionResult?.isError) {
                definitionResult = await API.post(`/api/core/v1/devicedefinitions/${encodeURIComponent(templateName)}`, definitionPayload)
            }
            if (definitionResult?.isError) {
                const apiError = definitionResult?.error?.message || definitionResult?.error || 'Error creating template'
                setError(typeof apiError === 'string' ? apiError : 'Error creating template')
                setIsCreating(false)
                return false
            }

            setCreatedTemplateName(templateName)
            setSavedWifi(wifi)
            setIsCreating(false)
            return true
        } catch (e: any) {
            setError(e?.message || 'Error creating template')
            setIsCreating(false)
            return false
        }
    }

    // Create device with template
    const createDeviceWithTemplate = async (templateName: string): Promise<boolean> => {
        if (!savedWifi) {
            setError('WiFi credentials not found')
            return false
        }

        setIsCreating(true)
        setError('')

        try {
            const deviceData = {
                name: data.name,
                platform: 'esphome',
                credentials: {
                    wifi: {
                        ssid: savedWifi.ssid,
                        password: savedWifi.password
                    }
                },
                deviceDefinition: templateName
            }

            const obj = DevicesModel.load(deviceData)
            const result = await API.post(sourceUrl, obj.create().getData())

            if (result.isError) {
                throw result.error
            }

            // Store created device (config.yaml is generated by backend automatically)
            const deviceResult = await API.get(`/api/core/v1/devices/${encodeURIComponent(data.name)}`)
            if (!deviceResult.isError && deviceResult.data) {
                setCreatedDevice(DevicesModel.load(deviceResult.data))
            }

            toast.show('Device created', { message: data.name })
            setIsCreating(false)
            return true
        } catch (e: any) {
            setError(e?.message || 'Error creating device')
            setIsCreating(false)
            return false
        }
    }

    // Create device with existing template (for non-blank devices)
    const createDeviceWithExistingTemplate = async (wifi: WifiNetwork): Promise<boolean> => {
        setIsCreating(true)
        setError('')

        try {
            const deviceData = {
                name: data.name,
                platform: 'esphome',
                credentials: {
                    wifi: {
                        ssid: wifi.ssid,
                        password: wifi.password
                    }
                },
                deviceDefinition: data.template
            }

            const obj = DevicesModel.load(deviceData)
            const result = await API.post(sourceUrl, obj.create().getData())

            if (result.isError) {
                throw result.error
            }

            // Store created device (config.yaml is generated by backend automatically)
            const deviceResult = await API.get(`/api/core/v1/devices/${encodeURIComponent(data.name)}`)
            if (!deviceResult.isError && deviceResult.data) {
                setCreatedDevice(DevicesModel.load(deviceResult.data))
            }

            setSavedWifi(wifi)
            toast.show('Device created', { message: data.name })
            setIsCreating(false)
            return true
        } catch (e: any) {
            setError(e?.message || 'Error creating device')
            setIsCreating(false)
            return false
        }
    }

    // Track if save was successful (to distinguish between save-close and cancel-close)
    const templateSavedRef = useRef(false)

    // Delete template (on cancel)
    const deleteTemplate = async () => {
        if (createdTemplateName) {
            try {
                await API.get(`/api/core/v1/devicedefinitions/${encodeURIComponent(createdTemplateName)}/delete`)
            } catch (err) {
                // ignore
            }
        }
    }

    // Handle template editor save - create device and go to upload
    const handleTemplateSaved = async (templateName: string) => {
        templateSavedRef.current = true
        const success = await createDeviceWithTemplate(templateName)
        if (success) {
            // Close the editor first, then move to upload step
            templateEditor.closeEditor()
            setStep(slides.findIndex(s => s.id === 'upload'))
        }
    }

    // Handle template editor close - only cancel if not saved
    const handleTemplateClose = () => {
        // Always close the editor state
        templateEditor.closeEditor()
        
        // If not saved, user cancelled - delete template and close wizard
        if (!templateSavedRef.current) {
            deleteTemplate()
            onBack?.()
        }
        // Reset for next use
        templateSavedRef.current = false
    }

    const handleNext = async () => {
        // Step 1: Basics - validate name and WiFi
        if (currentSlide.id === 'basics') {
            // Validate name
            if (!isNameValid(data.name)) {
                setError('Name is required and must use only lowercase letters, numbers or underscores')
                return
            }
            setError('')
            
            // Validate WiFi
            let wifi: WifiNetwork | null = null
            if (wifiStepRef.current) {
                wifi = await wifiStepRef.current.ensureSelection()
            }
            if (!wifi) {
                setWifiError('Wi-Fi is required. Please select or add a network.')
                return
            }
            setWifiError('')
            setSavedWifi(wifi)
            setStep(step + 1)
            return
        }

        // Step 2: Template - create device or continue to board
        if (currentSlide.id === 'template') {
            if (!isBlankDevice) {
                // Create device with existing template, go directly to upload
                if (!savedWifi) {
                    setError('WiFi credentials not found')
                    return
                }
                const success = await createDeviceWithExistingTemplate(savedWifi)
                if (!success) return
                setStep(slides.findIndex(s => s.id === 'upload'))
            } else {
                // Blank device - go to board selection
                setStep(step + 1)
            }
            return
        }

        // Step 4: Board - validate and create template
        if (currentSlide.id === 'board') {
            if (!selectedBoard) {
                setBoardError('Please select a board')
                return
            }
            setBoardError('')
            
            if (!savedWifi) {
                setError('WiFi credentials not found')
                return
            }
            
            // Create template only, then go to edit step
            const success = await createTemplateOnly(savedWifi)
            if (!success) return

            toast.show('Template created', { message: `${data.name}_template` })
            
            // Open template editor and move to edit-template step
            templateEditor.openDefinition(`${data.name}_template`)
            setStep(step + 1)
            return
        }

        // Step 5: Edit template - handled by template editor buttons
        if (currentSlide.id === 'edit-template') {
            return
        }

        // Step 6: Upload - finish wizard
        if (currentSlide.id === 'upload') {
            onCreated({ name: data.name, wifi: savedWifi })
            return
        }

        // Default: move to next step
        if (step < totalSlides - 1) {
            setStep(step + 1)
        }
    }

    // Handle upload button
    const handleUpload = () => {
        if (createdDevice) {
            flashDevice(createdDevice)
        }
    }

    // Get button text
    const getNextButtonText = () => {
        if (currentSlide.id === 'template') {
            if (isCreating) return 'Creating...'
            return isBlankDevice ? 'Next' : 'Create Device'
        }
        if (currentSlide.id === 'board') {
            if (isCreating) return 'Creating...'
            return 'Create Template'
        }
        if (currentSlide.id === 'upload') return 'Done'
        return 'Next'
    }

    return (
        <YStack id="admin-dataview-create-dlg" padding="$3" paddingTop="$0" width={currentSlide.id === 'edit-template' ? 1200 : 800} flex={1}>
            <XStack id="admin-eo" justifyContent="space-between" width="100%">
                <Stack flex={1}>
                    <Text fontWeight={"500"} fontSize={16} color="$gray9">{titlesUpToCurrentStep}</Text>
                </Stack>
                <Stack flex={1} alignItems="flex-end">
                    <Text fontWeight={"500"} fontSize={16} color="$gray9">[{step + 1}/{totalSlides}]</Text>
                </Stack>
            </XStack>

            <Tinted>
                <Stack>
                    {currentSlide.title && <Text fontWeight={"500"} fontSize={30} color="$color">{currentSlide.title}</Text>}
                </Stack>
            </Tinted>

            <Stack flex={1} marginTop={"$2"}>
                {/* Basics Step - Name + WiFi combined */}
                {currentSlide.id === 'basics' && (
                    <ScrollView style={{ width: '100%' }}>
                        <YStack gap="$2" width="100%">
                            <ConfigureSlide data={data} setData={setData} errorMessage={error} />
                            <WifiStep ref={wifiStepRef} active={currentSlide.id === 'basics'} wifiError={wifiError} onClearError={() => setWifiError('')} />
                        </YStack>
                    </ScrollView>
                )}
                {currentSlide.id === 'template' && <TemplateSlide selected={data.template} setSelected={(tpl) => setData({ ...data, template: tpl })} definitions={definitions} />}
                {currentSlide.id === 'board' && <BoardSlide boards={boards} selectedBoard={selectedBoard} setSelectedBoard={(board) => { setSelectedBoard(board); setBoardError('') }} error={boardError} />}
                
                {/* Edit Template Step - shows TemplateEditor modal */}
                {currentSlide.id === 'edit-template' && (
                    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
                        <Text color="$gray10">Edit your device template in the editor...</Text>
                        <Text color="$gray9" fontSize="$2">Click Save (green button) when done, or X to cancel</Text>
                    </YStack>
                )}
                
                {/* Upload Step */}
                {currentSlide.id === 'upload' && (
                    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
                        {deviceActionsUi}
                        <YStack 
                            gap="$4" 
                            alignItems="center"
                            padding="$6"
                            borderWidth={1}
                            borderColor="$color6"
                            borderRadius="$5"
                            backgroundColor="$bg"
                            maxWidth={500}
                            width="100%"
                        >
                            <YStack alignItems="center" gap="$2">
                                <Text fontSize="$7" fontWeight="700" color="$color11">
                                    Device "{data.name}" is ready!
                                </Text>
                                <Text color="$gray10" textAlign="center" fontSize="$4">
                                    Click the button below to upload the firmware to your ESP32 device.
                                </Text>
                            </YStack>
                            <Tinted>
                                <Button
                                    size="$5"
                                    icon={UploadCloud}
                                    onPress={handleUpload}
                                    marginTop="$2"
                                >
                                    Upload Firmware
                                </Button>
                            </Tinted>
                        </YStack>
                    </YStack>
                )}
            </Stack>

            {/* Navigation buttons - hide on edit-template step */}
            {currentSlide.id !== 'edit-template' && (
                <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
                    {currentSlide.id !== 'upload' && (
                        <Button width={250} onPress={handleBack}>
                            Back
                        </Button>
                    )}
                    <Tinted>
                        <Button
                            id={"admin-devices-add-btn"}
                            width={250}
                            onPress={handleNext}
                            disabled={isCreating || (currentSlide.id === 'basics' && !isNameValid(data.name)) || (currentSlide.id === 'template' && !isBlankDevice && !savedWifi)}
                        >
                            {getNextButtonText()}
                        </Button>
                    </Tinted>
                </XStack>
            )}
            
            {/* Template Editor Modal */}
            <TemplateEditor
                {...templateEditor.editorProps}
                onSaved={handleTemplateSaved}
                onClose={handleTemplateClose}
            />
        </YStack>
    )
}

export const devicesOption: NetworkOption = {
    id: 'devices',
    name: 'ESP32 Device',
    description: 'Remote sensing and control using ESP32 based devices',
    icon: 'cpu',
    Component: DevicesWizard
}
