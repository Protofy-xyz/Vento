import { Spinner, XStack, YStack, useTheme, Button, Text, Input, TextArea, Label } from '@my/ui'
import React, { useEffect, useRef, useCallback, useState, useContext, useMemo } from 'react';
import { useSearchParams, usePathname } from 'solito/navigation';
import { DataCard } from 'protolib/components/DataCard'
import AsyncView from 'protolib/components/AsyncView'
import { useFileFromAPI } from 'protolib/lib/useFileFromAPI'
import { IconContainer } from 'protolib/components/IconContainer'
import { Save, Workflow, Code, Ban, Check, X, Sparkles, AlertTriangle } from '@tamagui/lucide-icons';
import { useThemeSetting } from '@tamagui/next-theme'
// import GLTFViewer from 'protolib/adminpanel/features/components/ModelViewer'
import { Monaco } from 'protolib/components/Monaco'
import { IntentType } from 'protolib/lib/Intent'
import Center from 'protolib/components/Center'
import dynamic from 'next/dynamic'
import { API } from 'protobase';
import { usePrompt, promptCmd } from 'protolib/context/PromptAtom';
import { useInterval, useUpdateEffect } from 'usehooks-ts';
import Flows from 'protolib/adminpanel/features/components/Flows';
import { getDefinition, toSourceFile } from 'protonode/dist/lib/code'
import { ArrowFunction } from 'ts-morph';
import parserTypeScript from "prettier/parser-typescript.js";
import prettier from "prettier/standalone.js";
import { useEventEffect } from '@extensions/events/hooks'
import { useTint } from 'protolib/lib/Tints'
import { AppConfContext, SiteConfigType } from 'protolib/providers/AppConf';
import { Tinted } from 'protolib/components/Tinted';
import { useToastController } from '@my/ui';
import { getFlowsCustomSnippets } from "app/bundles/snippets"
import { getFlowsMenuConfig } from "app/bundles/flows"
import { getFlowMasks, getFlowsCustomComponents } from "app/bundles/masks"
import { Rules } from 'protolib/components/autopilot/Rules'
import { Panel, PanelGroup } from "react-resizable-panels";
import CustomPanelResizeHandle from 'protolib/components/MainPanel/CustomPanelResizeHandle'
import { useSettingValue } from '@extensions/settings/hooks';
import ESPHomeViewer from '@extensions/esphome/viewers'
import { SaveButtonWarning } from './saveButtonWarning'

const GLTFViewer = dynamic(() => import('protolib/adminpanel/features/components/ModelViewer'), {
  loading: () => <Center>
    <Spinner size={'large'} scale={3} top={-50} />
    Loading
  </Center>,
  ssr: false
})

const onGenerateSnippset = async (name, code, cb, onError) => {
  if (!code || !name) {
    onError("")
    return
  };
  const res = await API.post("/api/v1/flow/snippet", { name, code });
  if (res?.error) {
    onError(res?.error?.error)
    return
  }
  cb()
}

const JSONViewer = ({ extraIcons, name, path }) => {
  const [fileContent, setFileContent] = useFileFromAPI(path)
  console.log('file content: ', fileContent)
  const data = fileContent.isLoaded ? JSON.parse(fileContent.data) : ''
  return <AsyncView waitForLoading={1000} key={path} atom={fileContent}>
    <XStack f={1} width={'100%'}>
      <DataCard
        extraIcons={extraIcons}
        hideDeleteIcon={true}
        itemCardProps={{ topBarProps: { top: -10, backgroundColor: 'transparent' } }}
        minimal={true}
        f={1}
        backgroundColor={'transprent'}
        onDelete={() => { }}
        onSave={(content) => { }}
        json={data}
        name={name}
      />
    </XStack>
  </AsyncView>
}

type SaveButtonStates = "available" | "unavailable" | "loading" | "error"

const SaveButton = ({
  checkStatus = () => true,
  defaultState = 'available',
  path,
  getContent,
  positionStyle,
  onSave = () => { },
  warning,
}: {
  checkStatus?: () => boolean;
  defaultState?: SaveButtonStates;
  path: string;
  getContent: () => string;
  positionStyle?: any;
  onSave?: () => void;
  warning?: SaveButtonWarning;
}) => {
  const [state, setState] = useState(defaultState)
  const [isHovering, setIsHovering] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningActive = warning?.isActive ?? false;
  const warningColor = warning?.color ?? "var(--yellow10)";
  const warningTitle = warning?.title ?? "Resolve validation errors before saving.";
  const warningMessages = warning?.messages ?? [];
  const displayState: SaveButtonStates = warningActive && state !== "loading" ? "error" : state;

  const onEvent = (event) => {
    setState(defaultState)
    onSave()
  }

  const onEventCrash = () => {
    setState("error")
  }

  useEventEffect(onEvent, { path: 'services/api-dev/start' })
  useEventEffect(onEventCrash, { path: 'services/api-dev/crash' })

  useInterval(() => {
    if (checkStatus() && state == 'unavailable') setState('available')
  }, 250)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => setIsHovering(false), 200)
  }

  const _onSave = async () => {
    setState("loading")
    const content = getContent();
    await API.post('/api/core/v1/files/' + path.replace(/\/+/g, '/'), { content });
    if (!path.startsWith('/packages/app/apis/') && !path.startsWith('/data/automations/')) {
      setState(defaultState)
      onSave()
    }
  };

  return (
    <XStack
      position="absolute"
      {...positionStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <IconContainer
        disabled={state == 'unavailable'}
        onPress={_onSave}
      >
        {displayState == "loading" && <Spinner color={"$color"} opacity={0.5} size={17} />}
        {displayState == 'error' && displayState !== "loading" && (
          <Ban color={warningActive ? warningColor : "var(--red10)"} size={"$1"} />
        )}
        {displayState !== 'error' && displayState !== "loading" && (
          <Save color="var(--color)" size={"$1"} />
        )}
      </IconContainer>
      {warningActive && isHovering && (
        <XStack
          position="absolute"
          paddingHorizontal={"$3"}
          paddingVertical={"$2"}
          ai="flex-start"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            backgroundColor: "rgba(255, 196, 0, 0.15)",
            borderRadius: 6,
            border: "1px solid rgba(255, 196, 0, 0.5)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            top: "calc(100% + 8px)",
            maxWidth: 400,
            width: "clamp(250px, 50vw, 400px)",
            right: 0,
            left: "auto",
            whiteSpace: "normal",
            wordBreak: "break-word",
            zIndex: 20,
          }}
        >
          <YStack gap="$2" width="100%">
            <XStack gap="$2" ai="center" width="100%">
              <AlertTriangle color={warningColor} size={"$1"} />
              <Text
                fontSize={"$2"}
                color="$color"
                style={{
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  flexShrink: 1,
                }}
              >
                {warningTitle}
              </Text>
            </XStack>
            <YStack gap="$1" width="100%">
              {warningMessages.length === 0 && (
                <Text
                  fontSize={"$2"}
                  color="$color"
                  style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  Validation failed with unknown error.
                </Text>
              )}
              {warningMessages.slice(0, 3).map((message, index) => (
                <Text
                  key={index}
                  fontSize={"$2"}
                  color="$color"
                  style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  • {message}
                </Text>
              ))}
              {warningMessages.length > 3 && (
                <Text
                  fontSize={"$2"}
                  color="$color"
                  style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  • {warningMessages.length - 3} more error(s)…
                </Text>
              )}
            </YStack>
          </YStack>
        </XStack>
      )}
    </XStack>
  );
};

export const FlowsViewer = ({ extraIcons, path, isModified, setIsModified, masksPath = undefined , codeviewProps = {}, monacoProps = {}, saveButtonWarning }: {
  extraIcons?: React.ReactNode,
  path: string,
  isModified?: any,
  setIsModified?: any,
  masksPath?: string,
  codeviewProps?: any,
  monacoProps?: any,
  saveButtonWarning?: SaveButtonWarning
}) => {
  const [fileContent, setFileContent] = useFileFromAPI(path)
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const sourceCode = useRef('')
  const isPartial = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const originalSourceCode = useRef('')
  const defaultMode = useRef('code')
  useEffect(() => {
    if (fileContent.isLoaded) {
      if (fileContent.data.startsWith('//@flows')) {
        defaultMode.current = 'flow'
      }
      const sourceFile = toSourceFile(fileContent.data)
      const definition = getDefinition(sourceFile, '"code"')
      if (definition && ArrowFunction.isArrowFunction(definition)) {
        sourceCode.current = definition.getBodyText()
        isPartial.current = true
      } else {
        isPartial.current = false
        sourceCode.current = fileContent.data
      }
      originalSourceCode.current = sourceCode.current
      setLoaded(true)
    }
  }, [fileContent]);

  return <AsyncView ready={loaded}>
    <Tinted>
      <CodeView 
        disableAIPanels={true} 
        masksPath={masksPath} 
        defaultMode={defaultMode.current} 
        path={path} 
        extraIcons={extraIcons} 
        sourceCode={sourceCode} 
        fileContent={fileContent} 
        isModified={isModified} 
        setIsModified={setIsModified}
        monacoProps={monacoProps}
        query={query}
        {...codeviewProps}
        >
        <SaveButton
          onSave={() => originalSourceCode.current = sourceCode.current}
          checkStatus={() => sourceCode.current != originalSourceCode.current}
          defaultState={"unavailable"}
          path={path}
          getContent={() => {
            if (isPartial.current) {
              const sourceFile = toSourceFile(fileContent.data)
              const definition = getDefinition(sourceFile, '"code"').getBody()
              definition.replaceWithText("{\n" + sourceCode.current + "\n}");
              const code = prettier.format(sourceFile.getFullText(), {
                quoteProps: "consistent",
                plugins: [parserTypeScript],
                parser: "typescript"
              })
              if (code) {
                return code
              }
            }
            return sourceCode.current
          }}
          positionStyle={{ position: "relative" }}
          warning={saveButtonWarning}
        />
        {extraIcons}
      </CodeView>
    </Tinted>
  </AsyncView>
}

export const CodeView = ({
  rulesConfig = {},
  pathname = undefined,
  disableAIPanels = false,
  disableFlowMode = false,
  extraPanels = [],
  leftIcons = <></>,
  rightIcons = <></>,
  icons = <></>,
  masksPath = undefined,
  defaultMode = 'flow',
  rulesProps = {},
  flowsProps = {},
  monacoOnMount = (editor, monaco) => { },
  monacoInstance = null,
  monacoProps = {},
  monacoOptions = {},
  onCodeChange = (code) => { },
  onFlowChange = (code) => { },
  fileContent = null,
  path,
  flowsPath = undefined,
  rules = [],
  onApplyRules = async (rules) => { },
  sourceCode,
  isModified = false,
  setIsModified = (x) => { },
  query = {},
  children = <></>,
  viewPort = undefined,
  onModeChange = (mode) => { }
}) => {
  pathname = pathname ?? usePathname();
  const theme = useTheme()
  const tint = useTint().tint
  const toast = useToastController();
  const { resolvedTheme } = useThemeSetting()
  const [mode, setMode] = useState(disableAIPanels ? 'code' : defaultMode)
  const [savedRules, setSavedRules] = useState(rules)
  const codeVisibleSetting: any = useSettingValue('code.visible', true);
  const isCodeVisible = codeVisibleSetting != "false"

  console.log('sourceCode: ', sourceCode)
  const monaco = useMemo(() => {
    return monacoInstance ?? <Monaco
      key={path}
      path={path}
      onMount={(editor, monaco) => {
        monacoOnMount(editor, monaco)
      }}
      options={monacoOptions}
      darkMode={resolvedTheme == 'dark'}
      sourceCode={sourceCode.current}
      onChange={(code) => { onCodeChange(code); sourceCode.current = code }}
      {...monacoProps}
    />
  }, [sourceCode.current, path, resolvedTheme])

  useEffect(() => {
    onModeChange(mode)
  }, [mode])

  const getFlows = () => {
    return <Flows
      nodeMenu={({ nodeId, dumpFragment, closeMenu, updateFragment }) => {
        const [snippetName, setSnippetName] = useState();
        const [fragmentText, setFragmentText] = useState(dumpFragment());
        return (
          <YStack w={350} bg="$backgroundStrong" br="$6" p="$4" gap="$4" onPress={(e) => e.stopPropagation()}>
            <XStack f={1} jc="space-between" ai="center">
              <Tinted>
                <Text color={"$color7"} fontWeight={"500"}>Edit from code</Text>
              </Tinted>
              <XStack gap="$2">
                <Button
                  backgroundColor={"transparent"}
                  hoverStyle={{
                    backgroundColor: "$color2",
                    borderColor: "$color8"
                  }}
                  color="$color8"
                  borderColor="$color8"
                  size="$3"
                  onPress={() => closeMenu()}
                >
                  <X size={16} />
                </Button>
                <Tinted>
                  <Button disabled={!fragmentText} size="$3" onPress={() => { updateFragment(fragmentText); closeMenu() }}>
                    <Check size={16} fillOpacity={0} />
                  </Button>
                </Tinted>
              </XStack>
            </XStack>
            <YStack height={300}>
              <Monaco
                path={path}
                darkMode={resolvedTheme == 'dark'}
                sourceCode={fragmentText}
                options={{
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  lineNumbers: false,
                  minimap: { enabled: false }
                }}
                onChange={(code) => { setFragmentText(code); }}
              />
            </YStack>
            <XStack gap="$2">
              <Input f={1} value={snippetName} size="$3" placeholder='Snippet name required to export...' onChange={(e) => {
                // Only accepts alphabetical characters
                const regex = /^[a-zA-Z]+$/;
                // @ts-ignore 
                const value = e.target?.value
                if (regex.test(value) || value == '') {
                  setSnippetName(value);
                }
              }} />
              <Tinted>
                <Button
                  disabled={!snippetName}
                  size="$3"
                  color={!snippetName ? "$gray8" : "$color7"}
                  backgroundColor={"transparent"}
                  disabledStyle={{
                    borderColor: "$gray8",
                  }}
                  hoverStyle={{
                    backgroundColor: "$color2",
                    borderColor: "$color7"
                  }}
                  borderColor="$color7"
                  onPress={() => {
                    onGenerateSnippset(snippetName, fragmentText, closeMenu, (err = "") => {
                      toast.show("Error generating snippet", { message: err, duration: 3000 })
                    });
                  }}
                >
                  Export
                </Button>
              </Tinted>
            </XStack>
          </YStack>
        )
      }}
      config={{ menu: getFlowsMenuConfig(pathname, query) }}
      isModified={isModified}
      rawCodeFromMenu={true}
      customComponents={getFlowsCustomComponents(masksPath ? masksPath : pathname, query)}
      customSnippets={getFlowsCustomSnippets(pathname, query)}
      onEdit={(code) => { onFlowChange(code); sourceCode.current = code }}
      setIsModified={setIsModified}
      defaultViewPort={viewPort}
      setSourceCode={(sourceCode) => {
        sourceCode.current = sourceCode
      }}
      sourceCode={sourceCode.current}
      path={flowsPath ?? path}
      themeMode={resolvedTheme}
      primaryColor={resolvedTheme == 'dark' ? theme[tint + '10'].val : theme[tint + '7'].val} 
      {...flowsProps}
      />
  }

  const getBody = () => {
    const extraPanel = extraPanels.find(v => v.id == mode);
    if (extraPanel) {
      if (typeof extraPanel.content === 'function') {
        return extraPanel.content({code: sourceCode.current, setCode: (code) => { sourceCode.current = code } });
      }
      return extraPanel.content;
    }
    if (mode == 'rules') {
      return <PanelGroup direction="vertical">
        <Panel defaultSize={50}>
          <YStack flex={1} height="100%" alignItems="center" justifyContent="center" borderRadius="$3">
            <Rules
              rules={savedRules}
              onReloadRules={async (rules) => {
                setSavedRules(rules)
                await onApplyRules(rules)
              }}
              onAddRule={async (e, rule) => {
                const newRules = [...(savedRules ?? []), rule]
                await onApplyRules(newRules)
                setSavedRules(newRules)
              }}
              onDeleteRule={async (index) => {
                setSavedRules(savedRules.filter((_, i) => i != index))
                await onApplyRules(savedRules.filter((_, i) => i != index))
              }}
              onEditRule={async (index, rule) => {
                const newRules = [...savedRules]
                newRules[index] = rule
                await onApplyRules(newRules)
                setSavedRules(newRules)
              }}
              loadingIndex={-1}
              disabledConfig={rulesConfig}
              availableParams={rulesProps["availableParams"] ?? []}
              allowParams={!!rulesProps["allowParams"]}
            />
          </YStack>
        </Panel>
        <CustomPanelResizeHandle direction="horizontal" borderLess={false} borderColor="var(--gray4)" />
        <Panel defaultSize={isCodeVisible ? 50 : 0} minSize={0}>
          <YStack flex={1} h="100%" paddingTop="$3">
            {monaco}
          </YStack>
        </Panel>
      </PanelGroup>
    }
    if (mode == 'code') return monaco
    if (mode == 'flow') return getFlows()
  }

  const content = <YStack f={1} width={"100%"}>
    {/* <Theme name={tint as any}> */}
    <XStack justifyContent="space-between" alignItems="center">
      <XStack>
        <Label paddingLeft="$3" fontSize="$5" color="$gray9">{rulesProps["title"] ?? "Rules"}</Label>
        {leftIcons}
      </XStack>
      <XStack alignItems="center" mb="$2">

        {extraPanels.map(v => {
          const LICon = v.icon;
          return <IconContainer selected={mode == v.id} key={v.id} onPress={() => setMode(v.id)}>
            <LICon color="var(--color)" size={"$1"} />
          </IconContainer>
        })}
        {!disableAIPanels && <IconContainer selected={mode == 'rules'} onPress={() => setMode('rules')} style={{ padding: "10px", borderRadius: "5px" }} hoverStyle={{ backgroundColor: "$gray6" }}>
          {/* <SizableText mr={"$2"}>Save</SizableText> */}
          <Sparkles color="var(--color)" size={"$1"} />
        </IconContainer>}
        {!disableFlowMode && <IconContainer selected={mode == 'flow'} onPress={() => setMode('flow')} style={{ padding: "10px", borderRadius: "5px" }} hoverStyle={{ backgroundColor: "$gray6" }}>
          {/* <SizableText mr={"$2"}>Save</SizableText> */}
          <Workflow color="var(--color)" size={"$1"} />
        </IconContainer>}
        <IconContainer selected={mode == 'code'} onPress={() => setMode('code')} style={{ padding: "10px", borderRadius: "5px" }} hoverStyle={{ backgroundColor: "$gray6" }}>
          {/* <SizableText mr={"$2"}>Save</SizableText> */}
          <Code color="var(--color)" size={"$1"} />
        </IconContainer>
        {rightIcons && <XStack pl="$3">{rightIcons}</XStack>}

        {icons}
        {children}
      </XStack>
    </XStack>
    {getBody()}
    <XStack opacity={0} top={-200000} position={"absolute"}>
      <Flows preload={true} primary={"#f00"} />
    </XStack>
    {/* </Theme> */}
  </YStack>

  return fileContent ? <AsyncView atom={fileContent}>
    {content}
  </AsyncView> : content
}

export const MonacoViewer = ({ path, extraIcons, ...props }) => {
  const [fileContent] = useFileFromAPI(path);
  const sourceCode = useRef('');
  const { resolvedTheme } = useThemeSetting();

  useEffect(() => {
    if (fileContent.isLoaded) {
      sourceCode.current = fileContent.data;
    }
  }, [fileContent]);

  const handleChange = useCallback((code) => {
    sourceCode.current = code;
  }, []);

  return (
    <AsyncView waitForLoading={1000} key={path} atom={fileContent}>
      <XStack mt={30} f={1} width={"100%"} position="relative">
        <SaveButton
          path={path}
          getContent={() => sourceCode.current}
          positionStyle={{ right: 55, top: -33, zIndex: 2 }}
        />
        {!!extraIcons && (
          <XStack position="absolute" right={10} top={-33} gap="$2" zIndex={2}>
            {extraIcons}
          </XStack>
        )}
        <Monaco
          path={path}
          darkMode={resolvedTheme === 'dark'}
          sourceCode={fileContent.data}
          onChange={handleChange}
          {...props}
        />
      </XStack>
    </AsyncView>
  );
};

const TopRightIcons = ({ children }) => (
  <XStack position="absolute" right={10} top={-33} gap="$2" zIndex={2}>
    {children}
  </XStack>
)

const ImageViewer = ({ path, extraIcons }) => {
  const url = ('/api/core/v1/files/' + path).replace(/\/+/g, '/')
  return (
    <YStack f={1} w="100%" position="relative" p="$4" alignItems="center" justifyContent="center">
      {!!extraIcons && <TopRightIcons>{extraIcons}</TopRightIcons>}
      <XStack ai="center" jc="center" f={1} h="100%" p="$2">
        <img
          src={url}
          style={{ maxWidth: '100%', maxHeight: '84vh', objectFit: 'contain', borderRadius: 8 }}
        />
      </XStack>
    </YStack>
  )
}


const VideoViewer = ({ path, extraIcons }) => {
  const url = ('/api/core/v1/files/' + path).replace(/\/+/g, '/')
  return (
    <YStack f={1} w="100%" position="relative" p="$4" alignItems="center" justifyContent="center">
      {!!extraIcons && <TopRightIcons>{extraIcons}</TopRightIcons>}
      <XStack ai="center" jc="center" f={1} h="100%" p="$2">
        <video src={url} controls style={{ maxWidth: '100%', maxHeight: '84vh', borderRadius: 8 }} />
      </XStack>
    </YStack>
  )
}

const AudioViewer = ({ path, extraIcons }) => {
  const url = ('/api/core/v1/files/' + path).replace(/\/+/g, '/')
  return (
    <YStack f={1} w="100%" position="relative" p="$4" alignItems="center" justifyContent="center">
      {!!extraIcons && <TopRightIcons>{extraIcons}</TopRightIcons>}
      <audio src={url} controls style={{ maxWidth: '100%', maxHeight: '84vh', borderRadius: 8 }} />
    </YStack>
  )
}

export const processFilesIntent = ({ action, domain, data }: IntentType) => {
  const { mime } = data
  const type = mime ? mime.split('/')[0] : 'text'
  const url = ('/api/core/v1/files/' + data.path).replace(/\/+/g, '/')
  const isESPHomeFile = (mime && mime.includes("yaml") || data.path.endsWith("yaml") || data.path.endsWith("yml")) && data.path.startsWith("data/devices")
  if (mime == 'application/json') {
    return { component: <JSONViewer {...data} />, supportIcons: true }
  } else if (mime == 'application/javascript' || mime == 'video/mp2t') {
    return { component: <FlowsViewer {...data} />, supportIcons: true }
  } else if (isESPHomeFile) {
    return {
      component: <ESPHomeViewer {...data} />,
      widget: 'text',
      supportIcons: true
    }
  } else if ((data.path).endsWith(".tsx")) {
    return {
      component: <MonacoViewer {...data} />,
      widget: 'text',
      supportIcons: true
    }
  } else if (mime == 'model/gltf-binary') {
    return {
      component: <GLTFViewer path={url} />,
      widget: 'text'
    }
  } else if (type == 'text' || type == 'application') {
    return {
      component: <MonacoViewer {...data} />,
      widget: 'text',
      supportIcons: true
    }
  } else if (type == 'image') {
    return { component: <ImageViewer {...data} />, widget: 'image', supportIcons: true }
  } else if (type == 'video') {
    return { component: <VideoViewer {...data} />, widget: 'video', supportIcons: true }
  } else if (type == 'audio') {
    return { component: <AudioViewer {...data} />, widget: 'audio', supportIcons: true }
  }
}
