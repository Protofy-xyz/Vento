import React, { useEffect, useState } from 'react'
import { API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, Input, Text, Button, Stack } from "@my/ui"
import { TemplateCard } from '../apis/TemplateCard'
import { useRouter } from 'solito/navigation'
import { Tinted } from 'protolib/components/Tinted'
import type { NetworkOption } from '../network/options'

const SelectGrid = ({ children }) => {
  return <XStack justifyContent="center" alignItems="center" gap={25} flexWrap='wrap'>
    {children}
  </XStack>
}

const TemplateSlide = ({ selected, setSelected }) => {
  const [boardTemplates, setBoardTemplates] = useState([]);
  
  const reloadBoardTemplates = async () => {
    const templates = await API.get(`/api/core/v2/templates/boards`);
    let templatesData = templates.data || [];
    setBoardTemplates(templatesData);
  };

  useEffect(() => {
    reloadBoardTemplates()
  }, []);

  return <YStack>
    <ScrollView maxHeight={"500px"}>
      <SelectGrid>
        {Object.entries(boardTemplates).map(([templateId, template]) => (
          <TemplateCard
            key={templateId}
            template={template}
            isSelected={selected?.id === template?.id}
            onPress={() => setSelected(template)}
          />
        ))}
      </SelectGrid>
    </ScrollView>
    <Spacer marginBottom="$8" />
  </YStack>
}

const isNameValid = (text) => {
  return text == '' ? false : /^[a-z_]*$/.test(text)
}

const NameSlide = ({ selected, setName, errorMessage = '' }) => {
  const [error, setError] = useState('')
  
  useEffect(() => setError(errorMessage), [errorMessage])
  
  const handleChange = (text: string) => {
    if (!isNameValid(text)) {
      setError('Name is required and must use only lowercase letters and underscores')
    } else {
      setError('')
    }
    setName(text)
  }

  return <YStack minHeight={"200px"} justifyContent="center" alignItems="center">
    <YStack width="400px" gap="$2">
      <Input flex={1} value={selected?.name} onChangeText={handleChange} placeholder="Enter board name" />
      <Text marginLeft="$2" height={"$1"} fontSize="$2" color="$red8">{error}</Text>
    </YStack>
  </YStack>
}

const slides = [
  { name: "Select Template", title: "Select your Template" },
  { name: "Configure", title: "Board Name" }
]

const VirtualAgentsWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
  const router = useRouter()
  const defaultData = { template: { id: 'ai agent' }, name: '' }
  const [data, setData] = useState(defaultData)
  const [step, setStep] = useState(0)

  const totalSlides = slides.length
  const currentSlide = slides[step]

  const titlesUpToCurrentStep = slides
    .filter((_, index) => index <= step)
    .map(slide => slide.name)
    .join(" / ")

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
      const name = data.name
      if (!isNameValid(name)) return
      const template = data.template
      await API.post(`/api/core/v1/import/board`, { name, template })
      onCreated({ name, template })
      router.push(`/boards/view?board=${name}`)
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
        {step === 0 && <TemplateSlide selected={data?.template} setSelected={(template) => setData({ ...data, template })} />}
        {step === 1 && <NameSlide selected={data} setName={(name) => setData({ ...data, name })} />}
      </Stack>

      <XStack gap={40} justifyContent='center' marginBottom={"$1"} alignItems="flex-end">
        <Button width={250} onPress={handleBack}>
          Back
        </Button>
        <Tinted>
          <Button id={"admin-virtual-agents-add-btn"} width={250} onPress={handleNext}>
            {step === totalSlides - 1 ? "Create" : "Next"}
          </Button>
        </Tinted>
      </XStack>
    </YStack>
  )
}

export const virtualAgentsOption: NetworkOption = {
  id: 'virtualagents',
  name: 'Virtual Agent',
  description: 'AI-powered agents with customizable templates',
  icon: 'bot',
  Component: VirtualAgentsWizard
}
