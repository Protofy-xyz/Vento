import { XStack } from '@my/ui'
import { PanelMenu } from './PanelMenu';
import { MainPanel } from './MainPanel';
import { atom, useAtom } from 'jotai';
import { useContext, useEffect, useState } from 'react'
import { atomWithStorage } from 'jotai/utils'
import { API } from 'protobase'
import useSubscription from '../lib/mqtt/useSubscription'
import { AppConfContext, SiteConfigType } from "../providers/AppConf"
import { useWorkspace } from '../lib/useWorkspace';
import { useAgents } from '@extensions/boards/hooks/useAgents'


const initialLevels = ['info', 'warn', 'error', 'fatal']

export const AppState = atomWithStorage("adminPanelAppState", {
  logsPanelOpened: false,
  levels: initialLevels
})

export const RightPanelAtom = atom(20)

export const AdminPanel = ({ children }) => {
  const [appState, setAppState] = useAtom(AppState)
  const SiteConfig = useContext<SiteConfigType>(AppConfContext);
  const { PanelLayout } = SiteConfig.layout

  const [rightPanelSize, setRightPanelSize] = useAtom(RightPanelAtom)

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

  const getRightWidth = () => {
    const totalWidth = Math.max(400, window.innerWidth)
    let percentage = (400 / totalWidth) * 100;
    return percentage;
  }

  useEffect(() => {
    if (!rightPanelSize) {
      setRightPanelSize(getRightWidth())
    }
  }, [rightPanelSize])

  const workspaceData = useWorkspace({ boards: boards, objects: objects })
  // console.log('userSpaces: ', userSpaces, 'current Workspace: ', currentWorkspace)
  return rightPanelSize && <MainPanel
      borderLess={true}
      rightPanelSize={rightPanelSize}
      setRightPanelSize={setRightPanelSize}
      rightPanelStyle={{ marginRight: '20px', height: '100vh', padding: '20px', backgroundColor: 'var(--bgPanel)' }}
      rightPanelVisible={appState.logsPanelOpened}
      rightPanelResizable={true}
    centerPanelContent={workspaceData && <PanelLayout
          menuContent={<PanelMenu workspace={workspaceData} boards={boards} />}
        >
          <XStack f={1} px={"$0"} flexWrap='wrap'>
            {children}
          </XStack>
        </PanelLayout>
    } rightPanelContent={<></>}/>
}