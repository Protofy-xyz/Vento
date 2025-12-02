import React, { useEffect, useState } from 'react'
import { getPendingResult, API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, useToastController, Button, Text, Stack, Input } from "@my/ui"
import { TemplateCard } from '../apis/TemplateCard'
import { DevicesModel } from '../devices/devices/devicesSchemas'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { Tinted } from 'protolib/components/Tinted'
import { useRouter } from 'solito/navigation'
import type { NetworkOption } from '../network/options'

const sourceUrl = '/api/core/v1/devices'
const definitionsSourceUrl = '/api/core/v1/deviceDefinitions?all=1'

const SelectGrid = ({ children }) => {
    return <XStack justifyContent="center" alignItems="center" gap={25} flexWrap='wrap'>
        {children}
    </XStack>
}

const TemplateSlide = ({ selected, setSelected, definitions }) => {
    const templates = [
        { id: '__none__', name: 'Blank Device', description: 'Create a device without a template', icon: 'cpu' },
        ...(definitions?.data?.items || []).map(def => ({
            id: def.name,
            name: def.name,
            description: `Board: ${def.board?.name || 'Unknown'}`,
            icon: 'circuit-board'
        }))
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

const DevicesWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const router = useRouter()
    const [data, setData] = useState({ template: '__none__', name: '' })
    const [error, setError] = useState('')
    const [definitions, setDefinitions] = useState(getPendingResult('pending'))
    const [step, setStep] = useState(0)

    const slides = [
        { name: "Select Template", title: "Select a Template (optional)" },
        { name: "Configure", title: "Configure your Device" }
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
            setStep(step + 1)
        } else {
            // Finish - create device
            if (!isNameValid(data.name)) {
                setError('Name is required and must use only lowercase letters, numbers or underscores')
                return
            }

            try {
                const deviceData: any = {
                    name: data.name,
                    platform: 'esphome'
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

                if (hasTemplate) {
                    try {
                        const yaml = await obj.getYaml()
                        if (!yaml) {
                            throw new Error('Template did not generate a config.yaml')
                        }
                    } catch (yamlErr: any) {
                        toast.show('Config.yaml generation failed', {
                            message: yamlErr?.message || 'Device created but config.yaml could not be generated'
                        })
                        console.error('Error generating config.yaml from template', yamlErr)
                    }
                }

                toast.show('Device created', {
                    message: data.name
                })
                onCreated({ name: data.name })
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
            </Stack>

            <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
                <Button width={250} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button id={"admin-devices-add-btn"} width={250} onPress={handleNext}>
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

