import { Braces, ClipboardList, FileCode, Info, Save, Settings, ArrowDownRight, ArrowUpRight, Check, History } from '@tamagui/lucide-icons'
import { Text, YStack, Paragraph, XStack, Input, Popover, Spinner } from '@my/ui'
import { useState, useRef } from 'react'
import { Tinted } from '../Tinted'
import { RuleEditor } from './RuleEditor'
import { ParamsEditor } from './ParamsEditor'
import { useThemeSetting } from '@tamagui/next-theme';
import { Markdown } from '../Markdown'
import { Panel, PanelGroup } from "react-resizable-panels";
import { SettingsEditor } from './SettingsEditor'
import { ViewEditor } from './ViewEditor'
import { DisplayEditor } from './DisplayEditor'
import { useUpdateEffect } from 'usehooks-ts'
import { TabBar } from 'protolib/components/TabBar';
import { OutputEditor } from './OutputEditor'
import { HistoryEditor } from './HistoryEditor'
import { TabContainer } from './Tab'

function getAllPaths(obj, prefix = "", includeIntermediate = true) {
  if (obj === null || typeof obj !== "object") {
    return prefix ? [prefix] : [];
  }

  let out = [];
  if (includeIntermediate && prefix) out.push(prefix);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return includeIntermediate && prefix ? [prefix] : [];
    for (let i = 0; i < obj.length; i++) {
      const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
      out = out.concat(getAllPaths(obj[i], p, includeIntermediate));
    }
    return out;
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return includeIntermediate && prefix ? [prefix] : [];
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    out = out.concat(getAllPaths(obj[k], p, includeIntermediate));
  }
  return out;
}

// Center tabs
const MAIN_TAB_IDS = ['params', 'rules', 'output', 'history'];
// Settings menu tabs
const SETTINGS_MENU_TABS = [
  { id: 'config', label: 'Settings', icon: Settings },
  { id: 'view', label: 'View', icon: FileCode },
  { id: 'raw', label: 'Raw JSON', icon: Braces },
];

export const ActionCardSettings = ({ board, actions, states, card, icons, onEdit = (data) => { }, onSave = () => { }, onClose = () => { }, errors, mode = "edit", tab = "rules" }) => {

  const [cardData, setCardData] = useState(card);
  const originalNameRef = useRef(card?.name ?? null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isCreateMode = mode === "create";
  const [selectedTab, setSelectedTab] = useState(isCreateMode ? "config" : tab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { resolvedTheme } = useThemeSetting();

  useUpdateEffect(() => {
    const payload = { ...cardData }
    const original = originalNameRef.current
    if (!isCreateMode && original && payload?.name && payload.name !== original) {
      payload.previousName = original
    } else {
      delete payload.previousName
    }
    onEdit(payload);
  }, [cardData]);

  const setHTMLCode = (code) => {
    setCardData({
      ...cardData,
      html: code,
    })
  }

  const allTabs = [
    {
      id: 'info',
      label: '',
      icon: <Info size={"$1"} />,
      content: (
        <TabContainer px="$4" py="$4">
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50}>
              <YStack flex={1} height="100%" backgroundColor="$bgPanel" borderRadius="$3" p="$3">
                <Markdown
                  autoSaveOnBlur={true}
                  editOnDoubleClick={true}
                  data={cardData.description}
                  setData={(newCode) => {
                    setCardData({ ...cardData, description: newCode })
                  }}
                />
              </YStack>
            </Panel>
          </PanelGroup>
        </TabContainer>
      )
    },
    {
      id: 'params',
      label: 'Inputs',
      icon: <ArrowDownRight size={"$1"} />,
      content: (
        <TabContainer px="0px" py="0px">
          <ParamsEditor
            params={cardData.params || {}}
            setParams={(newParams) => {
              setCardData((prev) => ({ ...prev, params: newParams }))
            }}
            links={cardData.links || []}
            setLinks={(newLinks) => {
              setCardData((prev) => ({ ...prev, links: newLinks }))
            }}
            configParams={cardData.configParams || {}}
            setConfigParams={(newConfigParams) => {
              setCardData((prev) => ({ ...prev, configParams: newConfigParams }))
            }}
            availableStates={getAllPaths(states?.boards?.[board.name] ?? {}).filter(s => s !== cardData.name)}
          />
        </TabContainer>
      )
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: <ClipboardList size={"$1"} />,
      content: (
        <TabContainer px="$4" py="$4">
          <RuleEditor
            board={board}
            extraCompilerData={{ userParams: cardData.params, actions: actions?.boards?.[board.name] }}
            onCodeChange={() => "rules processed"}
            actions={actions.boards || {}}
            compiler={cardData.type == 'value' ? 'getValueCode' : 'getActionCode'}
            states={states?.boards || {}}
            cardData={cardData}
            setCardData={setCardData}
          />
        </TabContainer>
      )
    },
    {
      id: 'output',
      label: 'Output',
      icon: <ArrowUpRight size={"$1"} />,
      content: (
        <TabContainer px="$4" py="$4">
          <OutputEditor
            card={cardData}
            setCardData={setCardData}
            links={cardData.links || []}
            setLinks={(newLinks) => {
              setCardData((prev) => ({ ...prev, links: newLinks }))
            }}
          />
        </TabContainer>
      )
    },
    ...(cardData.keepHistory ? [{
      id: 'history',
      label: 'History',
      icon: <History size={"$1"} />,
      content: (
        <TabContainer px="$4" py="$4">
          <HistoryEditor
            boardId={board.name}
            cardId={cardData.key || cardData.name}
            cardName={cardData.name}
          />
        </TabContainer>
      )
    }] : []),
    {
      id: 'config',
      label: 'Settings',
      icon: <Settings size={"$1"} />,
      content: (
        <TabContainer px="0px" py="0px">
          <DisplayEditor style={{ width: "100%", height: "fit-content" }} board={board} icons={icons} card={card} cardData={cardData} setCardData={setCardData} />
        </TabContainer>
      )
    },
    {
      id: 'view',
      label: 'View',
      icon: <FileCode size={"$1"} />,
      content: (
        <TabContainer px="$4" py="$4">
          <ViewEditor cardData={cardData} setHTMLCode={setHTMLCode} />
        </TabContainer>
      )
    },
    {
      id: 'raw',
      label: 'Raw',
      icon: <Braces size={"$1"} />,
      content: <SettingsEditor cardData={cardData} setCardData={setCardData} resolvedTheme={resolvedTheme} />
    },
  ]

  const mainTabs = allTabs.filter(t => MAIN_TAB_IDS.includes(t.id))
  const isInSettingsTab = SETTINGS_MENU_TABS.some(t => t.id === selectedTab)

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
    } catch (e) {
      console.error("Error saving:", e);
    } finally {
      setIsSaving(false);
    }
  };

  useUpdateEffect(() => {
    setCardData(card);
  }, [card]);

  useUpdateEffect(() => {
    setHasChanges(JSON.stringify(cardData) !== JSON.stringify(card));
  }, [cardData, card]);

  const isTabVisible = (t) => {
    return cardData.editorOptions?.hiddenTabs?.includes(t.id) ? false : true;
  }

  const currentTab = allTabs.find(t => t.id === selectedTab);

  return (
    <YStack f={1}>
      <Tinted>
        <YStack f={1}>
          <XStack
            borderBottomColor="$gray6"
            borderBottomWidth="1px"
            ai="center"
            px="$3"
            py="$1"
            position="relative"
          >
            <XStack 
              position="absolute" 
              left={0} 
              right={0} 
              top={0}
              bottom={0}
              ai="center" 
              jc="center"
              zIndex={0}
            >
              <TabBar
                tabs={mainTabs.filter(isTabVisible)}
                selectedId={MAIN_TAB_IDS.includes(selectedTab) ? selectedTab : null}
                onSelect={(id) => setSelectedTab(id)}
                borderBottomColor="transparent"
              />
            </XStack>

            {!isCreateMode && (
              <XStack ai="center" gap="$2" zIndex={1}>
                <XStack
                  padding="$2"
                  borderRadius="$2"
                  cursor="pointer"
                  backgroundColor={selectedTab === 'info' ? "$color5" : "transparent"}
                  hoverStyle={{ backgroundColor: selectedTab === 'info' ? "$color5" : "$gray4" }}
                  onPress={() => setSelectedTab(selectedTab === 'info' ? 'rules' : 'info')}
                >
                  <Info size={18} color={selectedTab === 'info' ? "var(--color)" : "var(--gray9)"} />
                </XStack>
                <Input
                  fontSize="$5"
                  fontWeight="600"
                  color="$gray11"
                  maxWidth="200px"
                  value={cardData.name}
                  placeholder="Card name"
                  borderWidth={0}
                  backgroundColor="$bgPanel"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  hoverStyle={{ backgroundColor: "$gray3" }}
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  height="30px"
                  autoFocus={false}
                  tabIndex={-1}
                  borderRadius="$2"
                  onChangeText={(t) => {
                    const regex = /^[a-zA-Z0-9-_ ]*$/
                    if (regex.test(t)) {
                      setCardData({ ...cardData, name: t })
                    }
                  }}
                />
              </XStack>
            )}
            
            {/* Spacer to push right */}
            <XStack flex={1} />
            
            {!isCreateMode && (
              <XStack ai="center" gap="$2" zIndex={1}>
                <Popover placement="bottom-end" open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <Popover.Trigger asChild>
                    <XStack
                      padding="$2"
                      borderRadius="$2"
                      cursor="pointer"
                      backgroundColor={isInSettingsTab ? "$color5" : "transparent"}
                      hoverStyle={{ backgroundColor: isInSettingsTab ? "$color5" : "$gray4" }}
                    >
                      <Settings size={18} color={isInSettingsTab ? "var(--color)" : "var(--gray9)"} />
                    </XStack>
                  </Popover.Trigger>
                  <Popover.Content
                    backgroundColor="var(--bgPanel)"
                    borderColor="$gray6"
                    borderWidth={1}
                    borderRadius="$3"
                    padding="$2"
                    elevate
                    animation="quick"
                    enterStyle={{ opacity: 0, scale: 0.95 }}
                    exitStyle={{ opacity: 0, scale: 0.95 }}
                  >
                    <YStack gap="$1" minWidth={150}>
                      {SETTINGS_MENU_TABS.map((menuItem, index) => {
                        const Icon = menuItem.icon;
                        return (
                          <YStack key={menuItem.id}>
                            <XStack
                              padding="$2"
                              paddingHorizontal="$3"
                              borderRadius="$2"
                              cursor="pointer"
                              hoverStyle={{ opacity: 0.8 }}
                              backgroundColor={selectedTab === menuItem.id ? "$bgContent" : "transparent"}
                              onPress={() => {
                                setSelectedTab(menuItem.id)
                                setSettingsOpen(false)
                              }}
                              ai="center"
                              gap="$2"
                            >
                              <Icon size={16} color="var(--gray11)" />
                              <Text color="$gray11" fontSize="$4">{menuItem.label}</Text>
                            </XStack>
                          </YStack>
                        )
                      })}
                    </YStack>
                  </Popover.Content>
                </Popover>
                
                <XStack ai="center" gap="$2" p="$1">
                  <XStack
                    cursor={hasChanges && !isSaving ? "pointer" : "default"}
                    padding="$2"
                    borderRadius="$2"
                    width="32px"
                    height="32px"
                    hoverStyle={hasChanges && !isSaving ? { backgroundColor: "$gray4" } : {}}
                    onPress={hasChanges && !isSaving ? handleSave : undefined}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    {isSaving ? (
                      <Spinner size="small" color="var(--color8)" />
                    ) : (
                      <Save size={18} color={hasChanges ? "var(--color8)" : "var(--gray7)"} />
                    )}
                  </XStack>
                </XStack>
              </XStack>
            )}
          </XStack>
          <Tinted>
            {allTabs.map((tabItem) => (
              <YStack display={tabItem.id === selectedTab ? "flex" : "none"} key={tabItem.id} f={1} gap="$4">
                {tabItem.content || (
                  <YStack f={1} ai="center" jc="center">
                    <Text color="$gray11">No content available for this tab</Text>
                  </YStack>
                )}
              </YStack>
            ))}
          </Tinted>
        </YStack>
      </Tinted >
      {errors?.length > 0 ?
        <YStack>
          {errors.map((error, index) => (
            <Paragraph key={"err" + index} color="$red9" fontSize="$4">{error}</Paragraph>
          ))}
        </YStack>
        : <></>
      }
    </YStack >
  );
};
