import { YStack, XStack, Label, Button, Input, Popover, Text, TextArea } from '@my/ui'
import { Eye, Trash, Maximize2, Cable } from '@tamagui/lucide-icons'
import { useState, useCallback } from 'react'
import { InteractiveIcon } from '../InteractiveIcon'
import { nanoid } from 'nanoid'
import { useUpdateEffect } from 'usehooks-ts'
import { SelectList } from '../SelectList'
import { TextEditDialog } from '../TextEditDialog'
import { LinksEditor } from './LinksEditor'

const types = ["any", "string", "number", "boolean", "json", "array", "text", "path", "markdown", "html", "select"]
const inputDefProps = { backgroundColor: "$bgPanel", borderColor: "$gray6", placeholderTextColor: "$gray9", flex: 1, w: "100%" }
const selectTriggerDefProps = { ...inputDefProps, hoverStyle: { borderColor: "$color7", bc: "$gray1" } }

const InputTitle = ({ children, ...props }) => {
  return <Text
    color="$gray9"
    {...props}
  >{children}</Text>
}

const InputEditor = ({ onClose, show, addRow }) => {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("")
  const [defaultValue, setDefaultValue] = useState("")

  return <YStack
    onPress={() => onClose()}
    style={{
      position: "absolute",
      height: "100%",
      width: "100%",
      backgroundColor: "#00000051",
      zIndex: 200,
      top: "0px",
      right: "0px",
      visibility: show ? "visible" : "hidden",
      opacity: show ? 1 : 0,
      transition: "all 120ms ease-in-out",
    }}>
    <YStack
      bg={"$bgContent"}
      onPress={(e) => e.stopPropagation()}
      borderLeftColor={"$gray6"}
      borderLeftWidth="1px"
      jc='space-between'
      py="$5"
      px="$6"
      gap="$4"
      overflowBlock='scroll'
      style={{
        position: "absolute",
        height: "100%",
        minWidth: "400px",
        width: "fit-content",
        transform: show ? "" : "translateX(100%)",
        transition: "all 150ms ease-in-out",
        zIndex: 200,
        top: "0px",
        right: "0px"
      }}
    >
      <YStack gap="$5">
        <YStack>
          <Text
            h="fit-content"
            w="fit-content"
            fontSize={"$7"}
          >New input</Text>
          <InputTitle>Configure an input parameter to the card execution</InputTitle>
        </YStack>
        <YStack gap="$2">
          <InputTitle>Title</InputTitle>
          <Input
            placeholder={"Title"}
            bg="$bgPanel"
            borderColor="$colorTransparent"
            placeholderTextColor={"$gray9"}
            hoverStyle={{ borderColor: "$gray6" }}
            focusStyle={{ borderColor: "$gray6", outlineColor: "$gray6", outlineOffset: "2px", outlineWidth: "2px" }}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <InputTitle>Description</InputTitle>
          <Input
            placeholder={"Description"}
            bg="$bgPanel"
            borderColor="$colorTransparent"
            placeholderTextColor={"$gray9"}
            hoverStyle={{ borderColor: "$gray6" }}
            focusStyle={{ borderColor: "$gray6", outlineColor: "$gray6", outlineOffset: "2px", outlineWidth: "2px" }}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />

          <InputTitle>Input Type</InputTitle>
          <SelectList
            triggerProps={selectTriggerDefProps}
            title="Select type"
            selectorStyle={{ normal: { backgroundColor: "var(--bgPanel)" }, hover: { backgroundColor: "var(--bgContent)" } }}
            rowStyle={{ normal: { backgroundColor: "var(--bgPanel)" }, hover: { backgroundColor: "var(--bgContent)" } }}
            titleStyle={{ normal: { backgroundColor: "var(--bgPanel)" } }}
            elements={types}
            value={type}
            setValue={(value) => setType(value)}
          />


          <InputTitle>Default value</InputTitle>
          <TextArea
            placeholder={"write some default value"}
            height={"300px"}
            bg="$bgPanel"
            borderColor="$colorTransparent"
            placeholderTextColor={"$gray9"}
            hoverStyle={{ borderColor: "$gray6" }}
            focusStyle={{ borderColor: "$gray6", outlineColor: "$gray6", outlineOffset: "2px", outlineWidth: "2px" }}
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.currentTarget.value)}
          />

        </YStack>
      </YStack>
      <YStack>
        <Button
          style={{
            whiteSpace: "nowrap"
          }}
          h="fit-content"
          w="fit-content"
          px="$4"
          py="$2"
          bc="$bgPanel"
          hoverStyle={{ backgroundColor: "$bgPanel", border: "1px solid var(--gray8)" }}
          focusStyle={{ backgroundColor: "$bgPanel", border: "1px solid var(--gray8)" }}
          onPress={() => {
            onClose()
            addRow(title, description, type, defaultValue)
            setTitle("")
            setDescription("")
            setType("")
            setDefaultValue("")
          }}
        >Create input</Button>
      </YStack>
    </YStack>
  </YStack>
}

export const ParamsEditor = ({
  params = {},
  setParams,
  links,
  setLinks,
  configParams = {},
  setConfigParams = (x) => {},
  availableStates = [],
}) => {
  const [statesVisible, setStatesVisible] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [showInputEditor, setShowInputEditor] = useState(false)

  // Estructura base de filas
  const [rows, setRows] = useState(() => {
    const allKeys = new Set([...Object.keys(params), ...Object.keys(configParams)])

    return Array.from(allKeys).map((key) => ({
      rowId: nanoid(),
      paramKey: key,
      description: params[key] ?? '',
      visible: configParams[key]?.visible ?? true,
      defaultValue: configParams[key]?.defaultValue ?? '',
      type: configParams[key]?.type ?? 'string',
      data: configParams[key]?.data ?? [],
    }))
  })

  // Cuando cambian las filas, sincronizamos params y configParams
  // IMPORTANTE: aquí es donde preservamos propiedades desconocidas.
  useUpdateEffect(() => {
    const newParams: Record<string, any> = {}
    const newConfigParams: Record<string, any> = {}

    // console.log("rows", rows)
    rows.forEach(({ paramKey, description, visible, defaultValue, type, data }) => {
      if (!paramKey.trim()) return

      newParams[paramKey] = description

      const prevCfg = (configParams && configParams[paramKey]) ? configParams[paramKey] : {}

      // Merge superficial para conservar claves extra (p.ej. lol: 1)
      newConfigParams[paramKey] = {
        ...prevCfg,
        visible,
        defaultValue,
        type,
        ...(data && data.length > 0 ? { data } : {}),
      }
    })

    // console.log("params", newParams)
    setParams(newParams)
    // console.log("configParams", newConfigParams)
    setConfigParams(newConfigParams)
  }, [rows])

  const handleAddParam = useCallback(() => {
    setShowInputEditor(true)
  }, [])

  const handleRemoveParam = useCallback((rowIdToRemove) => {
    setRows((prev) => prev.filter((row) => row.rowId !== rowIdToRemove))
  }, [])

  const handleChangeParamKey = useCallback((rowId, newKey) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId ? { ...row, paramKey: newKey } : row
      )
    )
  }, [])

  const handleChangeDescription = useCallback((rowId, newDescription) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId ? { ...row, description: newDescription } : row
      )
    )
  }, [])

  const handleChangeDefaultValue = useCallback((rowId, newValue) => {
    if (typeof newValue === 'string' && (newValue.startsWith('board.') || newValue.startsWith('#'))) {
      setStatesVisible(rowId)
    } else {
      setStatesVisible(null)
    }

    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, defaultValue: newValue } : row))
    )
  }, [])

  const handleToggleVisible = useCallback((rowId) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, visible: !row.visible } : row))
    )
  }, [])

  const handleChangeType = useCallback((rowId, newType) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, type: newType } : row))
    )
  }, [])

  {/* <TabTitle tabname={"Inputs Configuration"} tabDescription='Configure all the dynamic inputs for your card' /> */}
  return (
    <YStack height={"100%"} width={"100%"} px="$8" py="$6" gap="$8" overflowBlock="scroll" overflowInline='hidden'>
      {/* INPUT EDITOR */}
      <InputEditor
        show={showInputEditor}
        onClose={() => setShowInputEditor(false)}
        addRow={(title, description, type, defaultValue) => {
          setRows((prev) => [
            ...prev,
            {
              rowId: nanoid(),
              paramKey: title,
              description: description,
              visible: true,
              defaultValue: defaultValue,
              type: type ?? "string",
            },
          ])
        }}
      />

      {/* PARAMS */}
      <YStack gap="$5">
        <XStack justifyContent='space-between' ai="flex-end">
          <YStack>
            <Text h={"fit-content"} lineHeight={"fit-content"} color="$color" fontSize="$7" fontWeight={500}>
              Parameters
            </Text>
            <Text h={"fit-content"} lineHeight={"fit-content"} color="$gray9" fontSize="$5" fontWeight={500}>
              Input parameter for the card execution
            </Text>
          </YStack>
          <Button
            style={{ whiteSpace: "nowrap" }}
            h="fit-content"
            w="fit-content"
            px="$4"
            py="$2"
            bc="$bgPanel"
            hoverStyle={{ backgroundColor: "$bgPanel", border: "1px solid var(--gray8)" }}
            focusStyle={{ backgroundColor: "$bgPanel", border: "1px solid var(--gray8)" }}
            onPress={handleAddParam}
          >
            Add param
          </Button>
        </XStack>

        <YStack gap="$3" borderRadius="$3" ai="flex-end" w="100%" px="$3" overflow='visible'>
          {rows.map(({ rowId, paramKey, description, visible, defaultValue, type }) => (
            <XStack key={rowId} gap="$2" alignItems="center" justifyContent="center" w="100%" h="fit-content">
              <YStack>
                <InteractiveIcon Icon={Eye} h="fit-content" IconColor={visible ? 'var(--color10)' : 'var(--gray9)'} onPress={() => handleToggleVisible(rowId)} />
              </YStack>

              <Input
                {...inputDefProps}
                placeholder={"Param Key"}
                value={paramKey}
                onChange={(e) => handleChangeParamKey(rowId, e.target.value)}
              />

              <Input
                {...inputDefProps}
                placeholder={"Description"}
                value={description}
                onChange={(e) => handleChangeDescription(rowId, e.target.value)}
              />

              <XStack width="150px">
                <SelectList
                  triggerProps={selectTriggerDefProps}
                  title="Select type"
                  selectorStyle={{ normal: { backgroundColor: "var(--bgPanel)" }, hover: { border: "1px solid var(--gray8)" } }}
                  rowStyle={{ normal: { backgroundColor: "var(--bgPanel)" }, hover: { backgroundColor: "var(--bgContent)" } }}
                  titleStyle={{ normal: { backgroundColor: "var(--bgPanel)" } }}
                  elements={types}
                  value={type ?? "any"}
                  setValue={(value) => handleChangeType(rowId, value)}
                />
              </XStack>

              <TextEditDialog key={rowId}>
                <Popover
                  placement='bottom-start'
                  open={statesVisible === rowId}
                  onOpenChange={(next) => {
                    setStatesVisible(next ? rowId : null)
                    setSelectedIndex(0)
                  }}
                >
                  <Popover.Trigger disabled={true}>
                    <TextEditDialog.Trigger bc="$backgroundColor" pos="absolute" r={0} m="$3" bottom={0} cursor='pointer'>
                      <Maximize2 size={20} color={"var(--gray8)"} />
                    </TextEditDialog.Trigger>

                    <Input
                      {...inputDefProps}
                      placeholder="Default Value"
                      bg="$bgPanel"
                      value={String(defaultValue ?? '')}
                      pr="$7"
                      onChange={(e) => handleChangeDefaultValue(rowId, e.target.value)}
                      onKeyDown={(e) => {
                        if (statesVisible === rowId) {
                          if (e.key === "ArrowDown") {
                            setSelectedIndex((prev) => Math.min(prev + 1, availableStates.length - 1))
                            e.preventDefault()
                          } else if (e.key === "ArrowUp") {
                            setSelectedIndex((prev) => Math.max(prev - 1, 0))
                            e.preventDefault()
                          } else if (e.key === "Enter") {
                            if (selectedIndex >= 0 && selectedIndex < availableStates.length) {
                              handleChangeDefaultValue(rowId, "board." + availableStates[selectedIndex])
                              setStatesVisible(null)
                              setSelectedIndex(0)
                              e.preventDefault()
                            }
                          }
                        }
                      }}
                    />
                  </Popover.Trigger>

                  <Popover.Content ai="flex-start" miw="200px" f={1} px={0} w={"100%"} bc={"$gray1"} py="$2" gap={"$2"}>
                    <Label lineHeight={"$2"} pl="$3" color="$gray10">States</Label>
                    <YStack overflow="auto" maxHeight={200} f={1} w="100%">
                      {(availableStates && availableStates.length > 0)
                        ? availableStates.map((s, i) => (
                          <XStack
                            key={s}
                            px="$3"
                            w="100%"
                            bc={i === selectedIndex ? "var(--gray5)" : "transparent"}
                            onHoverIn={e => e.currentTarget.style.backgroundColor = "var(--gray4)"}
                            onHoverOut={e => e.currentTarget.style.backgroundColor = "transparent"}
                            hoverStyle={{ bc: "$gray4" }}
                            gap={"$2"}
                            alignItems="center"
                            justifyContent="space-between"
                            width="100%"
                            onPress={() => { handleChangeDefaultValue(rowId, "board." + s); setStatesVisible(null) }}
                          >
                            <Label maw={300} whiteSpace='nowrap' overflow='hidden' textOverflow='ellipsis'>{s}</Label>
                          </XStack>
                        ))
                        : <Label px="$3" opacity={0.6}>No available states</Label>}
                    </YStack>
                  </Popover.Content>

                  <InteractiveIcon
                    ml="$2"
                    mt="4px"
                    Icon={Cable}
                    onPress={() =>
                      statesVisible === rowId ? setStatesVisible(null) : setStatesVisible(rowId)
                    }
                  />
                </Popover>

                <TextEditDialog.Editor
                  textAreaProps={{ bc: "$gray4" }}
                  placeholder={paramKey}
                  value={String(defaultValue ?? '')}
                  readValue={() => String(defaultValue ?? '')}
                  onChange={(value) => handleChangeDefaultValue(rowId, value)}
                />
              </TextEditDialog>

              <YStack>
                <InteractiveIcon Icon={Trash} IconColor="var(--red10)" onPress={() => handleRemoveParam(rowId)} />
              </YStack>
            </XStack>
          ))}
        </YStack>
      </YStack>

      {/* ACTIONS */}
      <YStack gap="$3">
        <XStack justifyContent='space-between' ai="flex-end">
          <YStack>
            <Text h={"fit-content"} lineHeight={"fit-content"} color="$color" fontSize="$7" fontWeight={500}>
              Actions before run
            </Text>
            <Text h={"fit-content"} lineHeight={"fit-content"} color="$gray9" fontSize="$5" fontWeight={500}>
              Link actions to be executed before running the card
            </Text>
          </YStack>
        </XStack>
        <YStack borderRadius="$3" p="$3">
          <LinksEditor
            mode={"pre"}
            links={links}
            setLinks={setLinks}
            selectProps={inputDefProps}
          />
        </YStack>
      </YStack>
    </YStack>
  )
}
