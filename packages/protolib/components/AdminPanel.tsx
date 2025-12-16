import { XStack, YStack, Button, Text } from '@my/ui'
import { PanelMenu } from './PanelMenu';
import { atom, useAtom } from 'jotai';
import { useContext, useEffect, useState, useRef, useCallback } from 'react'
import { atomWithStorage } from 'jotai/utils'
import { API } from 'protobase'
import useSubscription from '../lib/mqtt/useSubscription'
import { AppConfContext, SiteConfigType } from "../providers/AppConf"
import { useWorkspace } from '../lib/useWorkspace';
import { useAgents } from '@extensions/boards/hooks/useAgents'
import { useThemeSetting } from '@tamagui/next-theme'
import { MessageCircle, X, Settings } from '@tamagui/lucide-icons'
import { settingsAtom } from '@extensions/settings/hooks'
import { useOpenAISetupWizard } from './AISetupProvider'
import { Tinted } from './Tinted'

const initialLevels = ['info', 'warn', 'error', 'fatal']

// Breakpoint for mobile view
const MOBILE_BREAKPOINT = 768

export const AppState = atomWithStorage("adminPanelAppState", {
  logsPanelOpened: false,
  chatPanelOpened: true, // Abierto por defecto
  chatExpanded: false, // Si el chat está expandido a pantalla completa
  mobileChatOpen: false, // Para controlar el chat en móvil
  levels: initialLevels
})

// Hook para detectar si es móvil
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

export const RightPanelAtom = atom(20)

// Atom to share the chat panel width with other components (like FloatingWindow)
export const ChatPanelWidthAtom = atom(0)

// Componente del Chat Panel con iframe
const ChatPanel = ({ isVisible }: { isVisible: boolean }) => {
  const { resolvedTheme } = useThemeSetting()
  const themeMode = resolvedTheme === 'dark' ? 'dark' : 'light'
  const [shouldLoad, setShouldLoad] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [settings] = useAtom(settingsAtom)
  const openAISetupWizard = useOpenAISetupWizard()
  
  // Check if AI is configured
  const aiProvider = settings?.['ai.provider']
  const isAIConfigured = aiProvider && aiProvider !== 'skip'
  
  // Solo cargar el iframe cuando el panel es visible por primera vez
  useEffect(() => {
    if (isVisible && !shouldLoad) {
      setShouldLoad(true)
    }
  }, [isVisible, shouldLoad])
  
  // Escuchar el postMessage de Cinny cuando esté listo
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'cinny-ready') {
        setIframeReady(true)
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])
  
  // Enviar postMessage al iframe cuando cambie el tema
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'vento-theme-change', theme: themeMode }, '*')
    }
  }, [themeMode, iframeReady])
  
  if (!shouldLoad) {
    return <YStack f={1} bg="$bgPanel" />
  }
  
  return (
    <YStack f={1} height="100%" width="100%" bg="$bgPanel" position="relative">
      {/* AI not configured overlay */}
      {!isAIConfigured && (
        <YStack 
          position="absolute" 
          top={0} 
          left={0} 
          right={0} 
          bottom={0} 
          bg="$background"
          zIndex={10}
          jc="center"
          ai="center"
          p="$4"
          gap="$3"
        >
          <Text fontSize="$5" fontWeight="600" textAlign="center" color="$color12">
            🤖 AI is not configured
          </Text>
          <Text fontSize="$3" textAlign="center" color="$color10" maxWidth={280}>
            Set up an AI provider to chat with your agents and enable AI-powered features.
          </Text>
          <Tinted>
            <Button
              size="$4"
              icon={Settings}
              onPress={openAISetupWizard}
              backgroundColor="$color8"
              color="white"
              hoverStyle={{ backgroundColor: '$color9' }}
              mt="$2"
            >
              Configure AI
            </Button>
          </Tinted>
        </YStack>
      )}
      {/* Loading placeholder - visible mientras Cinny carga */}
      {!iframeReady && isAIConfigured && (
        <YStack 
          position="absolute" 
          top={0} 
          left={0} 
          right={0} 
          bottom={0} 
          bg="$bgPanel"
          zIndex={1}
        />
      )}
      <iframe
        ref={iframeRef}
        src={`/chat/home/?theme=${themeMode}`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          opacity: iframeReady ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        title="Vento Chat"
      />
    </YStack>
  )
}

export const AdminPanel = ({ children }) => {
  const [appState, setAppState] = useAtom(AppState)
  const [, setChatPanelWidth] = useAtom(ChatPanelWidthAtom)
  const SiteConfig = useContext<SiteConfigType>(AppConfContext);
  const { PanelLayout } = SiteConfig.layout
  const isMobile = useIsMobile()

  const { message } = useSubscription('notifications/object/#')

  const [objects, setObjects] = useState()

  const { agents: boards, loading: boardsLoading, error: boardsError } = useAgents()

  const getObjects = async () => {
    const objects = await API.get('/api/core/v1/objects')
    if (objects.isLoaded) {
      setObjects(objects.data.items)
    }
  }

  useEffect(() => {
    getObjects()
  }, [message])

  const workspaceData = useWorkspace({ boards: boards, objects: objects })
  
  // Chat panel width from localStorage (tamaño guardado por el usuario)
  const [savedChatWidth, setSavedChatWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vento-chat-width')
      return saved ? parseInt(saved) : 350
    }
    return 350
  })
  
  // Ancho actual del chat (puede ser el guardado o expandido)
  const [chatWidth, setChatWidth] = useState(savedChatWidth)
  
  const chatWidthRef = useRef(chatWidth)
  const [isResizing, setIsResizing] = useState(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    chatWidthRef.current = chatWidth
  }, [chatWidth])
  
  // Calcular ancho expandido (ventana - sidebar width de 64px)
  const getExpandedWidth = () => {
    if (typeof window !== 'undefined') {
      const sidebarWidth = 64 // Ancho de la sidebar colapsada
      return window.innerWidth - sidebarWidth
    }
    return 1000
  }
  
  // Sincronizar chatWidth cuando cambia chatExpanded
  useEffect(() => {
    if (appState.chatExpanded) {
      setChatWidth(getExpandedWidth())
    } else {
      setChatWidth(savedChatWidth)
    }
  }, [appState.chatExpanded, savedChatWidth])
  
  // Track if settings triggered the expansion
  const settingsExpandedRef = useRef(false)
  
  // Listen for settings open/close messages from Cinny iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'cinny-settings-open') {
        // If chat is small, expand it temporarily
        if (chatWidthRef.current < 400 && !appState.chatExpanded) {
          settingsExpandedRef.current = true
          setAppState(prev => ({ ...prev, chatExpanded: true }))
        }
      } else if (event.data?.type === 'cinny-settings-close') {
        // If we expanded for settings, collapse back
        if (settingsExpandedRef.current) {
          settingsExpandedRef.current = false
          setAppState(prev => ({ ...prev, chatExpanded: false }))
        }
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [appState.chatExpanded, setAppState])
  
  // Save to localStorage when savedChatWidth changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('vento-chat-width', String(savedChatWidth))
    }, 100)
    return () => clearTimeout(timer)
  }, [savedChatWidth])
  
  const handleMouseDown = (e: React.MouseEvent) => {
    // No permitir resize cuando está expandido
    if (appState.chatExpanded) return
    
    e.preventDefault()
    const startX = e.clientX
    const startWidth = chatWidthRef.current
    
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX
      const newWidth = Math.max(200, startWidth + diff)
      setChatWidth(newWidth)
      setSavedChatWidth(newWidth) // Guardar el nuevo tamaño
      // Dispatch resize event so Grid components recalculate
      window.dispatchEvent(new Event('resize'))
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const toggleMobileChat = useCallback(() => {
    setAppState(prev => ({ ...prev, mobileChatOpen: !prev.mobileChatOpen }))
  }, [setAppState])
  
  // Calculate the total chat width (including the resize handle of 2px)
  const totalChatWidth = isMobile ? 0 : chatWidth + 2
  
  // Update the atom so other components (like FloatingWindow) can read it
  useEffect(() => {
    setChatPanelWidth(totalChatWidth)
  }, [totalChatWidth, setChatPanelWidth])
  
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', position: 'relative' }}>
      {/* Overlay to capture mouse events during resize */}
      {isResizing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          cursor: 'col-resize',
        }} />
      )}
      
      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {workspaceData && <PanelLayout
          menuContent={<PanelMenu workspace={workspaceData} boards={boards} />}
        >
          <XStack f={1} px={"$0"} flexWrap='wrap'>
            {children}
          </XStack>
        </PanelLayout>}
      </div>
      
      {/* Desktop: Resize handle and Chat panel */}
      {!isMobile && (
        <>
          <div
            onMouseDown={handleMouseDown}
            style={{
              width: '2px',
              cursor: appState.chatExpanded ? 'default' : 'col-resize',
              backgroundColor: 'var(--borderColor)',
              flexShrink: 0,
            }}
          />
          <div style={{ 
            width: chatWidth, 
            flexShrink: 0,
            height: '100vh',
            backgroundColor: 'var(--bgPanel)',
          }}>
            <ChatPanel isVisible={true} />
          </div>
        </>
      )}

      {/* Mobile: Floating chat button and overlay */}
      {isMobile && (
        <>
          {/* Floating button to toggle chat */}
          <Button
            size="$4"
            circular
            icon={appState.mobileChatOpen ? X : MessageCircle}
            onPress={toggleMobileChat}
            position="absolute"
            bottom={20}
            right={20}
            zIndex={100000}
            elevation={10}
            backgroundColor="$color8"
            pressStyle={{ scale: 0.95 }}
            animation="quick"
          />
          
          {/* Mobile chat overlay */}
          {appState.mobileChatOpen && (
            <>
              {/* Backdrop */}
              <div
                onClick={toggleMobileChat}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 99998,
                }}
              />
              {/* Chat panel */}
              <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'var(--bgPanel)',
                zIndex: 99999,
                boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
              }}>
                <ChatPanel isVisible={true} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
