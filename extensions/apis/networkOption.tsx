import React, { useEffect, useState } from 'react'
import { z, getPendingResult, API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, useToastController, Button, Text, Stack } from "@my/ui"
import { TemplateCard } from './TemplateCard'
import { apiTemplates } from './templates'
import { APIModel } from './apisSchemas'
import { EditableObject } from 'protolib/components/EditableObject'
import { usePendingEffect } from 'protolib/lib/usePendingEffect'
import { Tinted } from 'protolib/components/Tinted'
import type { NetworkOption } from '../network/options'

const sourceUrl = '/api/core/v1/apis'
const objectsSourceUrl = '/api/core/v1/objects?all=1'
const defaultTemplateId = 'custom-api'

const resolveTemplate = (templateId?: string) => {
    const fallbackTemplate = apiTemplates[defaultTemplateId] ?? Object.values(apiTemplates)[0]
    if (templateId && apiTemplates[templateId]) return apiTemplates[templateId]
    return fallbackTemplate
}

const SelectGrid = ({ children }) => {
    return <XStack justifyContent="center" alignItems="center" gap={25} flexWrap='wrap'>
        {children}
    </XStack>
}

const TemplateSlide = ({ selected, setSelected }) => {
    return <YStack>
        <ScrollView maxHeight={"500px"}>
            <SelectGrid>
                {Object.entries(apiTemplates).map(([templateId, template]) => (
                    <TemplateCard
                        key={templateId}
                        template={template}
                        isSelected={selected === templateId}
                        onPress={() => setSelected(templateId)}
                    />
                ))}
            </SelectGrid>
        </ScrollView>
        <Spacer marginBottom="$8" />
    </YStack>
}

const ConfigureSlide = ({ data, setData, error, setError, objects, template }) => {
    const currentTemplate = template ?? resolveTemplate(data?.data?.template)
    const extraFields = currentTemplate?.extraFields ? currentTemplate.extraFields(objects) : {}

    return <ScrollView height={"250px"}>
        <EditableObject
            externalErrorHandling={true}
            error={error}
            setError={setError}
            data={data}
            setData={setData}
            numColumns={currentTemplate?.extraFields ? 2 : 1}
            mode={'add'}
            title={false}
            model={APIModel}
            extraFields={{
                ...extraFields
            }}
        />
    </ScrollView>
}

const TasksWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const defaultData = { data: { template: defaultTemplateId } }
    const [data, setData] = useState(defaultData)
    const [error, setError] = useState<any>('')
    const [objects, setObjects] = useState(getPendingResult('pending'))
    const [step, setStep] = useState(0)

    const selectedTemplateId = (data?.data?.template && apiTemplates[data.data.template]) ? data.data.template : defaultTemplateId
    const selectedTemplate = resolveTemplate(data?.data?.template)

    const slides = [
        { name: "Select Template", title: "Select your Template" },
        { name: selectedTemplate?.name ?? "Configure", title: "Configure your Task" }
    ]

    const totalSlides = slides.length
    const currentSlide = slides[step]

    const titlesUpToCurrentStep = slides
        .filter((_, index) => index <= step)
        .map(slide => slide.name)
        .join(" / ")

    useEffect(() => {
        const templateId = data?.data?.template
        if (!templateId || !apiTemplates[templateId]) {
            setData(prev => ({ ...prev, data: { ...prev.data, template: selectedTemplateId } }))
        }
    }, [data?.data?.template, selectedTemplateId])

    usePendingEffect((s) => { API.get({ url: objectsSourceUrl }, s) }, setObjects, undefined)

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
            // Finish
            try {
                const payload = { ...data, data: { ...data['data'], template: selectedTemplateId } }
                const obj = APIModel.load(payload['data'])
                if (selectedTemplate?.extraValidation) {
                    const check = selectedTemplate.extraValidation(payload['data'])
                    if (check?.error) {
                        throw check.error
                    }
                }
                const result = await API.post(sourceUrl, obj.create().getData())
                if (result.isError) {
                    throw result.error
                }
                toast.show('Task created', {
                    message: obj.getId()
                })
                onCreated({ name: obj.getId() })
            } catch (e) {
                setError(getPendingResult('error', null, e instanceof z.ZodError ? e.flatten() : e))
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
                {step === 0 && <TemplateSlide selected={selectedTemplateId} setSelected={(tpl) => setData({ ...data, data: { ...data['data'], template: tpl } })} />}
                {step === 1 && <ConfigureSlide error={error} objects={objects} setError={setError} data={data} setData={setData} template={selectedTemplate} />}
            </Stack>

            <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
                <Button width={250} onPress={handleBack}>
                    Back
                </Button>
                <Tinted>
                    <Button id={"admin-tasks-add-btn"} width={250} onPress={handleNext}>
                        {step === totalSlides - 1 ? "Create" : "Next"}
                    </Button>
                </Tinted>
            </XStack>
        </YStack>
    )
}

export const tasksOption: NetworkOption = {
    id: 'tasks',
    name: 'Tasks',
    description: 'Complex tasks with full programming environment',
    icon: 'list-checks',
    Component: TasksWizard
}
