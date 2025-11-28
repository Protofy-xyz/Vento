import { YStack, ScrollView, XStack } from '@my/ui'
import { AppBar } from '../AppBar'
import { Panel, PanelGroup } from "react-resizable-panels";
import CustomPanelResizeHandle from '../MainPanel/CustomPanelResizeHandle';

export const PanelLayout = ({ panelBgColor = undefined, menuContent, children, SideMenu, Layout, headerContents, HeaderMenu, panelBottom = false }) => {
  const appBarHeight = 0
  const _panelBgColor = '$bgPanel'
  
  // Content without Panel wrapper (for use outside PanelGroup)
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'auto' }}>
      <XStack mt={appBarHeight} f={1} paddingBottom={panelBottom ? '20px' : '0px'} style={{ flex: 1 }}>
        <YStack f={1} style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </YStack>
      </XStack>
    </div>
  )

  return (
    <Layout
      header={<></>}
      sideMenu={<SideMenu mt={appBarHeight} sideBarColor={_panelBgColor}>{menuContent}</SideMenu>}
      footer={null}>
      <XStack f={1} $xs={{ px: "$0" }}>
        {!panelBottom ? content :
          <PanelGroup direction="vertical" style={{ height: '100%', width: '100%' }}>
            <Panel>
              {content}
            </Panel>
            <CustomPanelResizeHandle direction="horizontal" />
            <Panel>
              <div style={{ display: 'flex', flex: 1, height: '100%', backgroundColor: 'grey' }}>
                <p>Contenido del panel inferior</p>
              </div>
            </Panel>
          </PanelGroup>
        }
      </XStack>
    </Layout>
  )
}
