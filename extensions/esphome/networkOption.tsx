import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react'
import { getPendingResult, API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, useToastController, Button, Text, Stack, Input, Spinner, Popover } from "@my/ui"
import { TemplateCard } from '../apis/TemplateCard'
import { DevicesModel } from '../devices/devices/devicesSchemas'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { Tinted } from 'protolib/components/Tinted'
import { FormInput } from 'protolib/components/FormInput'
import { useRouter } from 'solito/navigation'
import { MoreVertical, Pencil, Trash2 } from '@tamagui/lucide-icons'
import type { NetworkOption } from '../network/options'

const sourceUrl = '/api/core/v1/devices'
const definitionsSourceUrl = '/api/core/v1/deviceDefinitions?all=1'
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
    const templates = [
        { id: '__none__', name: 'Blank Device', description: 'Create a device without a template', icon: 'cpu' },
        ...(definitions?.data?.items || []).map(def => {
            const boardName = typeof def.board === 'string' ? def.board : def.board?.name
            const description = (typeof def.description === 'string' && def.description.trim().length)
                ? def.description
                : `Board: ${boardName || 'Unknown'}`
            return {
                id: def.name,
                name: def.name,
                description,
                icon: 'circuit-board'
            }
        })
    ]

    return <YStack>
        <ScrollView maxHeight={"500px"}>
            <SelectGrid>
                {templates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        isSelected={selected === template.id}
                        onPress={() => setSelected(template.id)}
                    />
                ))}
            </SelectGrid>
        </ScrollView>
        <Spacer marginBottom="$8" />
    </YStack>
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
        <YStack padding="$2" gap="$3" width="100%">
            {wifiError ? <Text color="$red9" fontSize="$2" marginBottom="$1">{wifiError}</Text> : null}
            {loading ? (
                <XStack alignItems="center" gap="$2">
                    <Spinner size="small" /> <Text color="$gray10">Loading saved Wi-Fi networks…</Text>
                </XStack>
            ) : (
                <>
                    {networks.length > 0 ? (
                        <YStack gap="$2">
                            <XStack justifyContent="space-between" alignItems="center">
                                <Text fontWeight="600" fontSize="$5">Saved networks</Text>
                                <Tinted>
                                    <Button size="$3" onPress={startNew}>Add</Button>
                                </Tinted>
                            </XStack>
                            <ScrollView maxHeight={220} paddingHorizontal="$2" paddingVertical="$4">
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
                                                        <XStack gap="$2" alignItems="center">
                                                            <Text fontWeight="700" color="$color11">{net.ssid}</Text>
                                                            {isSelected && (
                                                                <XStack
                                                                    paddingHorizontal="$2"
                                                                    paddingVertical="$1"
                                                                    borderRadius="$3"
                                                                    backgroundColor="$color9"
                                                                >
                                                                    <Text color="$color1" fontSize="$2">Selected</Text>
                                                                </XStack>
                                                            )}
                                                        </XStack>
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
                                                                <YStack gap="$2" minWidth={140}>
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
                        </YStack>
                    ) : (
                        <YStack gap="$2">
                            <XStack justifyContent="space-between" alignItems="center">
                                <Text fontWeight="600" fontSize="$5">Add a Wi-Fi network</Text>
                                <Tinted>
                                    <Button size="$3" onPress={startNew}>Add</Button>
                                </Tinted>
                            </XStack>
                            <Text color="$gray11">No Wi-Fi credentials found yet.</Text>
                        </YStack>
                    )}

                    {showForm && (
                        <YStack gap="$2">
                            <Text fontWeight="600">{form.key ? 'Edit Wi-Fi' : 'New Wi-Fi'}</Text>
                            <Input
                                placeholder="SSID"
                                value={form.ssid}
                                onChangeText={(text) => setForm({ ...form, ssid: text })}
                            />
                            <FormInput
                                placeholder="Password"
                                secureTextEntry
                                value={form.password}
                                onChangeText={(text) => setForm({ ...form, password: text })}
                            />
                            {error ? <Text color="$red9" fontSize="$2">{error}</Text> : <Text height="$1" />}
                            <XStack gap="$2" justifyContent="center" marginBottom="$4">
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
    const [step, setStep] = useState(0)
    const wifiStepRef = useRef<WifiStepHandle>(null)

    const slides = [
        { name: "Select Template", title: "Select a Template (optional)" },
        { name: "Configure", title: "Configure your Device" },
        { name: "Wi-Fi", title: "Wi-Fi Setup" }
    ]

    const totalSlides = slides.length
    const currentSlide = slides[step]

    const titlesUpToCurrentStep = slides
        .filter((_, index) => index <= step)
        .map(slide => slide.name)
        .join(" / ")

    usePendingEffect((s) => { API.get({ url: definitionsSourceUrl }, s) }, setDefinitions, undefined)

    const handleBack = () => {
        if (step === 0 && onBack) {
            onBack()
        } else if (step > 0) {
            setStep(step - 1)
        }
    }

    const handleNext = async () => {
        if (step < totalSlides - 1) {
            // Prevent moving forward from Configure without a valid name
            if (step === 1 && !isNameValid(data.name)) {
                setError('Name is required and must use only lowercase letters, numbers or underscores')
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

                const hasTemplate = data.template !== '__none__'
                if (hasTemplate) {
                    deviceData.deviceDefinition = data.template
                }

                const obj = DevicesModel.load(deviceData)
                const result = await API.post(sourceUrl, obj.create().getData())

                if (result.isError) {
                    throw result.error
                }
                toast.show('Device created', {
                    message: data.name
                })
                onCreated({ name: data.name, wifi: selectedWifi })
                router.push(`/devices?created=${data.name}`)
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
                {step === 0 && <TemplateSlide selected={data.template} setSelected={(tpl) => setData({ ...data, template: tpl })} definitions={definitions} />}
                {step === 1 && <ConfigureSlide data={data} setData={setData} errorMessage={error} />}
                {step === 2 && <WifiStep ref={wifiStepRef} active={step === 2} wifiError={wifiError} onClearError={() => setWifiError('')} />}
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
                        disabled={step === 1 && !isNameValid(data.name)}
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
