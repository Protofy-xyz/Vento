import React, { useEffect, useState } from 'react'
import { API } from 'protobase'
import { YStack, XStack, Spacer, ScrollView, Input, Text } from "@my/ui"
import { Slides } from 'protolib/components/Slides'
import { TemplateCard } from '../apis/TemplateCard'
import { useRouter } from 'solito/navigation'
import type { NetworkOption } from '../network/options'

const SelectGrid = ({ children }) => {
  return <XStack jc="center" ai="center" gap={25} flexWrap='wrap'>
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
    <ScrollView mah={"500px"}>
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

  return <YStack minHeight={"200px"} jc="center" ai="center">
    <YStack width="400px" gap="$2">
      <Input f={1} value={selected?.name} onChangeText={handleChange} placeholder="Enter board name" />
      <Text ml="$2" h={"$1"} fos="$2" color="$red8">{error}</Text>
    </YStack>
  </YStack>
}

const VirtualAgentsWizard = ({ onCreated }: { onCreated: (data?: any) => void }) => {
  const router = useRouter()
  const defaultData = { template: { id: 'ai agent' }, name: '' }
  const [data, setData] = useState(defaultData)

  return (
    <Slides
      lastButtonCaption="Create"
      id='virtual-agents'
      onFinish={async () => {
        const name = data.name
        if (!isNameValid(name)) return
        const template = data.template
        await API.post(`/api/core/v1/import/board`, { name, template })
        onCreated({ name, template })
        router.push(`/boards/view?board=${name}`)
      }}
      slides={[
        {
          name: "Select Template",
          title: "Select your Template",
          component: <TemplateSlide selected={data?.template} setSelected={(template) => setData({ ...data, template })} />
        },
        {
          name: "Configure",
          title: "Board Name",
          component: <NameSlide selected={data} setName={(name) => setData({ ...data, name })} />
        }
      ]}
    />
  )
}

export const virtualAgentsOption: NetworkOption = {
  id: 'virtualagents',
  name: 'Virtual Agents',
  description: 'AI-powered agents with customizable templates',
  icon: 'bot',
  Component: VirtualAgentsWizard
}

