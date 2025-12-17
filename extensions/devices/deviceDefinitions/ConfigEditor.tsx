import { useRef } from 'react'
import { Button, XStack, YStack, Text, Stack } from '@my/ui'
import Flows from 'protolib/adminpanel/features/components/Flows'
import { getFlowsCustomSnippets } from 'app/bundles/snippets'
import { getFlowsMenuConfig } from 'app/bundles/flows'
import { getFlowMasks, getFlowsCustomComponents } from 'app/bundles/masks'
import { useThemeSetting } from '@tamagui/next-theme'
import { useSearchParams, usePathname } from 'solito/navigation'
import layout from './DeviceLayout'
import { X, Save } from "@tamagui/lucide-icons"
import { Tinted } from 'protolib/components/Tinted'

const ActionButton = ({ ...props }) => {

  return <Tinted tint={props.tint}>
    <Button
      backgroundColor={"transparent"}
      hoverStyle={{
        backgroundColor: "$color4",
      }}
      color="$color8"
      size="$3"
      circular
      scaleIcon={1.5}
      {...props}
    />
  </Tinted>
}

export const ConfigEditor = ({ definition, onSave, onCancel }) => {

  const { resolvedTheme } = useThemeSetting()
  const searchParams = useSearchParams()
  
  // Always use deviceDefinitions path context for correct masks, regardless of current page
  // This ensures the editor works the same whether opened from /workspace/devices, 
  // /workspace/boards, or /workspace/deviceDefinitions
  const pathname = '/workspace/deviceDefinitions'
  const query = Object.fromEntries(searchParams.entries())
  
  const selectedSdk = definition?.sdk
  const selectedBoard = definition?.board
  const sourceCode = useRef(definition?.config?.components)


  return <YStack f={1}>
    <Stack style={{ flexDirection: "row" }} w={"100%"} gap={"$2"} jc={"space-between"} ai="center" px={"$3"} py="$2">
      <Text fow={"600"}>{definition?.name}</Text>
      <XStack>
        <ActionButton
          tint={"green"}
          onPress={() => onSave({ ...definition, config: { ...definition?.config, components: sourceCode.current } })}
          icon={Save}
        />
        <ActionButton
          tint={"red"}
          onPress={onCancel}
          icon={X}
        />
      </XStack>
    </Stack>
    <YStack f={1} minWidth={'100%'} className="device-config-flow">
      <Flows
        style={{ width: "100%" }}
        disableDots={false}
        hideBaseComponents={true}
        disableStart={true}
        autoFitView={true}
        getFirstNode={(nodes) => {
          return nodes.find(n => n.type == 'ArrayLiteralExpression')
        }}
        layout={layout}
        customComponents={getFlowsCustomComponents(pathname, query)}
        customSnippets={getFlowsCustomSnippets(pathname, query)}
        bridgeNode={false}
        setSourceCode={(sourceCode) => {
          sourceCode.current = sourceCode
        }}
        sourceCode={sourceCode.current ?? ''}
        themeMode={resolvedTheme}
        key={'flow'}
        config={{ masks: getFlowMasks(pathname, query), layers: [], menu: getFlowsMenuConfig(pathname, query) }}
        bgColor={'transparent'}
        dataNotify={(data: any) => {
          if (data.notifyId) {
            //mqttPub('datanotify/' + data.notifyId, JSON.stringify(data))
          }
        }}
        onEdit={(code) => sourceCode.current = code}
        positions={[]}
        disableSideBar={true}
        // store={uiStore}
        display={true}
        flowId={"flows-editor"}
        metadata={{ board: selectedBoard, sdk: selectedSdk }}
      />
    </YStack>
  </YStack>
}
