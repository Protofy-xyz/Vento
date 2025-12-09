import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react'
import { getPendingResult, API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, useToastController, Button, Text, Stack, Input, Spinner, Popover } from "@my/ui"
import { TemplateCard } from '../apis/TemplateCard'
import { DevicesModel } from '../devices/devices/devicesSchemas'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { Tinted } from 'protolib/components/Tinted'
import { FormInput } from 'protolib/components/FormInput'
import { useRouter } from 'solito/navigation'
import { MoreVertical, Pencil, Trash2, Search } from '@tamagui/lucide-icons'
import type { NetworkOption } from '../network/options'
import { PublicIcon } from 'protolib/components/IconSelect'

const sourceUrl = '/api/core/v1/devices'
const definitionsSourceUrl = '/api/core/v1/deviceDefinitions?all=1'
const boardsSourceUrl = '/api/core/v1/deviceboards?all=1'
const wifiPrefix = 'wifi.'

type WifiNetwork = {
    key: string
    ssid: string
    password: string
}

const SelectGrid = ({ children }) => {
    return <XStack justifyContent="center" alignItems="center" gap={25} flexWrap='wrap'>
        {children}
    </XStack>
}

const TemplateSlide = ({ selected, setSelected, definitions }) => {
    const [search, setSearch] = useState('')
    const templates = [
        { id: '__none__', name: 'Blank Device', description: 'Create a device from scratch!', boardIcon: 'cpu', boardImage: undefined },
        ...(definitions?.data?.items || []).map(def => {
            const boardName = typeof def.board === 'string' ? def.board : def.board?.name
            const boardIcon = typeof def.board === 'object' ? def.board?.icon : undefined
            const boardImage = typeof def.board === 'object' ? def.board?.image : undefined
            const description = (typeof def.description === 'string' && def.description.trim().length)
                ? def.description
                : `Board: ${boardName || 'Unknown'}`
            return {
                id: def.name,
                name: def.name,
                description,
                boardIcon,
                boardImage
            }
        })
    ]

    const normalizedQuery = search.trim().toLowerCase()
    const filteredTemplates = normalizedQuery
        ? templates.filter((tpl) => {
            const haystack = `${tpl.name ?? ''} ${tpl.description ?? ''}`.toLowerCase()
            return haystack.includes(normalizedQuery)
        })
        : templates
    const selectedTemplate =
        filteredTemplates.find((tpl) => tpl.id === selected) ||
        (filteredTemplates.length ? filteredTemplates[0] : undefined)

    return (
        <YStack gap="$3" width="100%">
            <XStack position="relative">
                <Search size={18} style={{ position: 'absolute', left: 12, top: 14, opacity: 0.7 }} />
                <Input
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search templates…"
                    size="$4"
                    paddingLeft={40}
                    backgroundColor="$gray3"
                    borderColor="$gray6"
                    borderWidth={1}
                    outlineColor="$gray8"
                />
            </XStack>

            <XStack gap="$4" alignItems="flex-start" width="100%" height={520}>
                {/* LEFT: list */}
                <YStack width={380} flexShrink={0} gap="$3" height="100%">
                    <ScrollView
                        style={{
                            width: '100%',
                            flexShrink: 0,
                            flexGrow: 0,
                            minHeight: 360
                        }}
                    >
                        <YStack gap="$2" padding="$1">
                            {filteredTemplates.length === 0 ? (
                                <YStack
                                    padding="$3"
                                    borderRadius="$4"
                                    borderWidth={1}
                                    borderColor="$gray5"
                                    backgroundColor="$gray2"
                                >
                                    <Text color="$gray10">No templates match your search.</Text>
                                </YStack>
                            ) : (
                                filteredTemplates.map((template) => {
                                    const active = selectedTemplate?.id === template.id
                                    return (
                                        <YStack
                                            key={template.id}
                                            onPress={() => setSelected(template.id)}
                                            cursor="pointer"
                                            padding="$3"
                                            borderRadius="$4"
                                            backgroundColor={active ? "$color3" : "$gray2"}
                                            borderWidth={1}
                                            borderColor={active ? "$color7" : "$gray5"}
                                            alignItems="flex-start"
                                            hoverStyle={{ borderColor: '$color7', backgroundColor: '$color2' }}
                                            transition="all 120ms ease"
                                        >
                                            <XStack gap="$3" alignItems="center">
                                                {template.boardIcon ? (
                                                    template.boardIcon.includes('/') || template.boardIcon.startsWith('http') ? (
                                                        <img
                                                            src={template.boardIcon}
                                                            alt={template.name}
                                                            style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
                                                        />
                                                    ) : (
                                                        <PublicIcon name={template.boardIcon} size={22} color="var(--color10)" />
                                                    )
                                                ) : null}
                                                <Text fontWeight="700" color="$color11">
                                                    {template.name}
                                                </Text>
                                            </XStack>
                                        </YStack>
                                    )
                                })
                            )}
                        </YStack>
                    </ScrollView>
                </YStack>

                {/* RIGHT: preview */}
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
                            {selectedTemplate ? (
                                <>
                                    <Text fontSize="$7" fontWeight="700" color="$color11">
                                        {selectedTemplate.name}
                                    </Text>
                                    {(selectedTemplate as any)?.boardImage || (selectedTemplate as any)?.image ? (
                                        <img
                                            src={(selectedTemplate as any).boardImage || (selectedTemplate as any).image}
                                            alt={selectedTemplate.name}
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
                                    ) : null}
                                    {selectedTemplate.description ? (
                                        <Text color="$gray10" fontSize="$4">
                                            {selectedTemplate.description}
                                        </Text>
                                    ) : (
                                        <Text color="$gray9">No description available.</Text>
                                    )}
                                </>
                            ) : (
                                <Text color="$gray9">Select a template to see details</Text>
                            )}
                        </YStack>
                    </ScrollView>
                </YStack>
            </XStack>
            <Spacer marginBottom="$8" />
        </YStack>
    )
}

const BoardSlide = ({ boards, selectedBoard, setSelectedBoard, error }: {
    boards: any,
    selectedBoard: string | null,
    setSelectedBoard: (value: string) => void,
    error?: string
}) => {
    const [search, setSearch] = useState('')
    const boardList = (boards?.data?.items || [])
        .map((board) => ({
            id: board.name,
            name: board.name,
            core: board.core,
            image: board.image,
            icon: board.icon
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

    const normalizedQuery = search.trim().toLowerCase()
    const filteredBoards = normalizedQuery
        ? boardList.filter((b) => b.name.toLowerCase().includes(normalizedQuery))
        : boardList

    const selected =
        filteredBoards.find((b) => b.id === selectedBoard) ||
        (filteredBoards.length ? filteredBoards[0] : undefined)

    return (
        <YStack gap="$3" mb="$4" width="100%">
            {error ? <Text color="$red9" fontSize="$2">{error}</Text> : null}
            {!boards?.isLoaded ? (
                <XStack alignItems="center" gap="$2">
                    <Spinner size="small" /> <Text color="$gray10">Loading boards…</Text>
                </XStack>
            ) : (
                <>
                    {boardList.length === 0 ? (
                        <Text color="$gray11">No boards found. Please create a board first.</Text>
                    ) : (
                        <XStack
                            gap="$4"
                            maxHeight={500}
                            alignItems="flex-start"
                            width="100%"
                        >
                            {/* LEFT: finder + list */}
                            <YStack width={380} flexShrink={0} gap="$3">
                                <XStack position="relative">
                                    <Search size={18} style={{ position: 'absolute', left: 12, top: 14, opacity: 0.7 }} />
                                    <Input
                                        value={search}
                                        onChangeText={setSearch}
                                        placeholder="Search boards…"
                                        size="$4"
                                        paddingLeft={40}
                                        backgroundColor="$gray3"
                                        borderColor="$gray6"
                                        borderWidth={1}
                                        outlineColor="$gray8"
                                    />
                                </XStack>
                                <ScrollView
                                    style={{
                                        width: '100%',
                                        flexShrink: 0,
                                        flexGrow: 0,
                                        minHeight: 360
                                    }}
                                >
                                    <YStack gap="$2" padding="$1">
                                        {filteredBoards.length === 0 ? (
                                            <YStack
                                                padding="$3"
                                                borderRadius="$4"
                                                borderWidth={1}
                                                borderColor="$gray5"
                                                backgroundColor="$gray2"
                                            >
                                                <Text color="$gray10">No boards match your search.</Text>
                                            </YStack>
                                        ) : (
                                            filteredBoards.map((board) => {
                                                const active = selected?.id === board.id
                                                return (
                                                    <YStack
                                                        key={board.id}
                                                        onPress={() => setSelectedBoard(board.id)}
                                                        cursor="pointer"
                                                        padding="$3"
                                                        borderRadius="$4"
                                                        backgroundColor={active ? "$color3" : "$gray2"}
                                                        borderWidth={1}
                                                        borderColor={active ? "$color7" : "$gray5"}
                                                        alignItems="flex-start"
                                                        hoverStyle={{ borderColor: '$color7', backgroundColor: '$color2' }}
                                                        transition="all 120ms ease"
                                                    >
                                                        <Text fontWeight="700" color="$color11">
                                                            {board.name}
                                                        </Text>
                                                    </YStack>
                                                )
                                            })
                                        )}
                                    </YStack>
                                </ScrollView>
                            </YStack>

                            {/* RIGHT: preview */}
                            <YStack
                                flex={1}
                                backgroundColor="$gray2"
                                borderWidth={1}
                                borderColor="$gray4"
                                borderRadius="$4"
                                padding="$4"
                                gap="$4"
                                justifyContent="flex-start"
                                alignItems="flex-start"
                            >
                                <YStack
                                    width="100%"
                                    gap="$3"
                                    alignItems="flex-start"
                                >
                                    {selected ? (
                                        <>
                                            <Text fontSize="$7" fontWeight="700" color="$color11">
                                                {selected.name}
                                            </Text>
                                            {selected.image ? (
                                                <img
                                                    src={selected.image}
                                                    alt={selected.name}
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
                                            ) : (
                                                <Text color="$gray9">No image available</Text>
                                            )}
                                            {selected.core ? (
                                                <Text color="$gray10" fontWeight="500">Core: {selected.core}</Text>
                                            ) : null}
                                        </>
                                    ) : (
                                        <Text color="$gray9">Select a board to see details</Text>
                                    )}
                                </YStack>
                            </YStack>
                        </XStack>
                    )}
                </>
            )}
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

    return <YStack minHeight={"200px"} justifyContent="center" alignItems="center">
        <YStack width="400px" gap="$2">
            <Text marginBottom="$2" fontSize="$4" color="$gray11">Device Name</Text>
            <Input flex={1} value={data?.name || ''} onChangeText={handleChange} placeholder="my_esp32_device" />
            <Text marginLeft="$2" height={"$1"} fontSize="$2" color="$red8">{error}</Text>
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
            const res = await API.get('/api/core/v1/keys?all=1')
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
        const payloadValue = JSON.stringify({ ssid: form.ssid.trim(), password: form.password })
        try {
            let res = await API.post(`/api/core/v1/keys/${keyName}`, { name: keyName, value: payloadValue })
            if (res.isError && !res.data) {
                res = await API.post('/api/core/v1/keys', { name: keyName, value: payloadValue })
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
            const res = await API.get(`/api/core/v1/keys/${encodeURIComponent(key)}/delete`)
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
        <YStack padding="$4" gap="$4" width="100%" maxWidth={820} alignSelf="center">
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
    const router = useRouter()
    const [data, setData] = useState({ template: '__none__', name: '' })
    const [error, setError] = useState('')
    const [wifiError, setWifiError] = useState('')
    const [definitions, setDefinitions] = useState(getPendingResult('pending'))
    const [boards, setBoards] = useState(getPendingResult('pending'))
    const [step, setStep] = useState(0)
    const [selectedBoard, setSelectedBoard] = useState<string | null>(null)
    const [boardError, setBoardError] = useState('')
    const wifiStepRef = useRef<WifiStepHandle>(null)

    const needsBoardStep = data.template === '__none__'
    const slides = [
        { id: 'template', name: "Select Template", title: "Select a Template (optional)" },
        { id: 'configure', name: "Configure", title: "Configure your Device" },
        ...(needsBoardStep ? [{ id: 'board', name: "Board", title: "Select the board for your device" }] : []),
        { id: 'wifi', name: "Wi-Fi", title: "Wi-Fi Setup" }
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
        if (!needsBoardStep) {
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
    }, [needsBoardStep, boards?.isLoaded])

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

    const handleNext = async () => {
        if (step < totalSlides - 1) {
            if (currentSlide.id === 'configure' && !isNameValid(data.name)) {
                setError('Name is required and must use only lowercase letters, numbers or underscores')
                return
            }
            if (currentSlide.id === 'board' && needsBoardStep && !selectedBoard) {
                setBoardError('Please select a board')
                return
            }
            setStep(step + 1)
        } else {
            // Finish - create device
            if (!isNameValid(data.name)) {
                setError('Name is required and must use only lowercase letters, numbers or underscores')
                return
            }

            let selectedWifi: WifiNetwork | null = null
            if (wifiStepRef.current) {
                selectedWifi = await wifiStepRef.current.ensureSelection()
            }
            if (!selectedWifi) {
                setWifiError('Wi-Fi is required. Please select or add a network.')
                setStep(2)
                return
            } else {
                setWifiError('')
            }

            try {
                const deviceData: any = {
                    name: data.name,
                    platform: 'esphome',
                    credentials: {
                        wifi: {
                            ssid: selectedWifi.ssid,
                            password: selectedWifi.password
                        }
                    }
                }

                let templateName: string | null = null
                let boardData: any = null
                const buildComponents = (boardInfo: any, mqttUrl?: string | null) => {
                    const entries: string[] = [`"mydevice"`, `"${selectedBoard}"`]
                    const ports = boardInfo?.ports || []
                    const wifiComponent = selectedWifi ? `wifi("${selectedWifi.ssid}", "${selectedWifi.password}", "none")` : null
                    const mqttComponent = mqttUrl ? `mqtt("${mqttUrl}")` : null

                    const normalizeType = (t: any) => (typeof t === 'string' ? t.toLowerCase() : '')
                    const isIoCapable = (t: string) => t === 'io' || t === 'i' || t === 'o'

                    const virtualIndexes = ports
                        .map((p, idx) => ({ idx, type: normalizeType(p?.type) }))
                        .filter(p => p.type === 'virtual')
                        .map(p => p.idx)

                    const ioIndexes = ports
                        .map((p, idx) => ({ idx, type: normalizeType(p?.type) }))
                        .filter(p => isIoCapable(p.type))
                        .map(p => p.idx)

                    const pickIndex = (list: number[], exclude: number | null) => {
                        for (const idx of list) {
                            if (exclude === null || idx !== exclude) return idx
                        }
                        return null
                    }

                    const wifiIdx = wifiComponent
                        ? (virtualIndexes[0] ?? ioIndexes[0] ?? null)
                        : null
                    const mqttIdx = mqttComponent
                        ? (pickIndex(virtualIndexes, wifiIdx) ?? pickIndex(ioIndexes, wifiIdx) ?? null)
                        : null

                    const totalPorts = Math.max(ports.length, (wifiIdx !== null ? wifiIdx + 1 : 0), (mqttIdx !== null ? mqttIdx + 1 : 0), 2)

                    for (let i = 0; i < totalPorts; i++) {
                        if (i === wifiIdx && wifiComponent) {
                            entries.push(wifiComponent)
                        } else if (i === mqttIdx && mqttComponent) {
                            entries.push(mqttComponent)
                        } else {
                            entries.push('null')
                        }
                    }

                    entries.push('null') // trailing null as in existing implementation
                    return `[\n  ${entries.join(',\n  ')}\n];`
                }
                const hasTemplate = data.template !== '__none__'
                if (hasTemplate) {
                    deviceData.deviceDefinition = data.template
                } else {
                    if (!selectedBoard) {
                        setBoardError('Please select a board')
                        return
                    }
                    templateName = `${data.name}_template`

                    // Load the board details because the API validator needs the full board object
                    const boardResp = await API.get(`/api/core/v1/deviceboards/${encodeURIComponent(selectedBoard)}`)
                    if (boardResp?.isError || !boardResp?.data) {
                        setBoardError('Unable to load selected board')
                        return
                    }
                    boardData = boardResp.data

                    const definitionPayload: any = {
                        name: templateName,
                        sdk: 'esphome-idf',
                        board: boardData,
                        description: `Blank ESPHome template for ${data.name}`,
                        config: {
                            components: buildComponents(boardData, null),
                            sdkConfig: boardData?.config?.['esphome-idf'] ?? {}
                        }
                    }
                    let definitionResult = await API.post('/api/core/v1/devicedefinitions', definitionPayload)
                    if (definitionResult?.isError) {
                        // Fallback to update if it already exists
                        definitionResult = await API.post(`/api/core/v1/devicedefinitions/${encodeURIComponent(templateName)}`, definitionPayload)
                    }
                    if (definitionResult?.isError) {
                        const apiError = definitionResult?.error?.message || definitionResult?.error || 'Error creating template'
                        setError(typeof apiError === 'string' ? apiError : 'Error creating template')
                        return
                    }
                    deviceData.deviceDefinition = templateName
                }

                const obj = DevicesModel.load(deviceData)
                const result = await API.post(sourceUrl, obj.create().getData())

                if (result.isError) {
                    throw result.error
                }

                // Update template with actual MQTT host/port once device credentials exist
                if (templateName) {
                    try {
                        const deviceResp = await API.get(`/api/core/v1/devices/${encodeURIComponent(data.name)}`)
                        if (!deviceResp?.isError && deviceResp?.data && boardData) {
                            const mqttCreds = deviceResp.data?.credentials?.mqtt
                            const host = mqttCreds?.host
                            const mqttUrl = host ? `${host}` : null
                            const updatedPayload = {
                                name: templateName,
                                sdk: 'esphome-idf',
                                board: boardData,
                                description: `Blank ESPHome template for ${data.name}`,
                                config: {
                                    components: buildComponents(boardData, mqttUrl),
                                    sdkConfig: boardData?.config?.['esphome-idf'] ?? {}
                                }
                            }
                            await API.post(`/api/core/v1/devicedefinitions/${encodeURIComponent(templateName)}`, updatedPayload)
                        }
                    } catch (err) {
                        // silently ignore; user can adjust manually in editor
                    }
                }
                toast.show('Device created', {
                    message: data.name
                })
                onCreated({ name: data.name, wifi: selectedWifi })
                const templateQuery = templateName ? `&editTemplate=${encodeURIComponent(templateName)}` : ''
                router.push(`/devices?created=${data.name}${templateQuery}`)
            } catch (e: any) {
                setError(e?.message || 'Error creating device')
            }
        }
    }

    return (
        <YStack id="admin-dataview-create-dlg" padding="$3" paddingTop="$0" width={800} flex={1}>
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
                {currentSlide.id === 'template' && <TemplateSlide selected={data.template} setSelected={(tpl) => setData({ ...data, template: tpl })} definitions={definitions} />}
                {currentSlide.id === 'configure' && <ConfigureSlide data={data} setData={setData} errorMessage={error} />}
                {currentSlide.id === 'board' && <BoardSlide boards={boards} selectedBoard={selectedBoard} setSelectedBoard={(board) => { setSelectedBoard(board); setBoardError('') }} error={boardError} />}
                {currentSlide.id === 'wifi' && <WifiStep ref={wifiStepRef} active={currentSlide.id === 'wifi'} wifiError={wifiError} onClearError={() => setWifiError('')} />}
            </Stack>

            <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
                <Button width={250} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button
                        id={"admin-devices-add-btn"}
                        width={250}
                        onPress={handleNext}
                        disabled={currentSlide.id === 'configure' && !isNameValid(data.name)}
                    >
                        {step === totalSlides - 1 ? "Create" : "Next"}
                    </Button>
                </Tinted>
            </XStack>
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
