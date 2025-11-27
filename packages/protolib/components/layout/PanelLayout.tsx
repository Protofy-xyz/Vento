import { YStack, ScrollView, XStack } from '@my/ui'
import { AppBar } from '../AppBar'
import { Panel, PanelGroup } from "react-resizable-panels";
import CustomPanelResizeHandle from '../MainPanel/CustomPanelResizeHandle';

export const PanelLayout = ({ panelBgColor = undefined, menuContent, children, SideMenu, Layout, headerContents, HeaderMenu, panelBottom = false }) => {
  const appBarHeight = 0
  const _panelBgColor = '$bgPanel'
  const panel = <Panel>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'auto' }}>
      <XStack mt={appBarHeight} f={1} paddingBottom={panelBottom ? '20px' : '0px'} style={{ flex: 1 }}>
        <YStack f={1} style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </YStack>
      </XStack>
    </div>
  </Panel>

  return (
    <Layout
      header={<></>}
      sideMenu={<SideMenu mt={appBarHeight} sideBarColor={_panelBgColor}>{menuContent}</SideMenu>}
      footer={
        null
        // <AppBar dettached={false} translucid={false} position="bottom">
        //   <HeaderContents menuPlacement={"top"} />
        // </AppBar>
      }>
      {/* <Theme name={tint as any}> */}
      <XStack f={1} $xs={{ px: "$0" }}>
        {!panelBottom ? panel :
          <PanelGroup direction="vertical" style={{ height: '100%', width: '100%' }}>
            {panel}
            <> <CustomPanelResizeHandle
              direction="horizontal"
            />
              <Panel>
                <div style={{ display: 'flex', flex: 1, height: '100%', backgroundColor: 'grey' }}>
                  <p>Contenido del panel inferior</p>
                </div>
              </Panel>
            </>
          </PanelGroup>
        }
      </XStack>
    </Layout>
  )
}
