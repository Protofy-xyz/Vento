import React from "react"
import { Panel, PanelGroup } from "react-resizable-panels"
import SPanel from 'react-sliding-side-panel'
import CustomPanelResizeHandle from './CustomPanelResizeHandle'

type Props = {
    actionContent?: React.Component | any
    rightPanelContent: React.Component | any
    leftPanelContent?: React.Component | any
    centerPanelContent: React.Component | any
    height?: React.Component | any
    rightPanelResizable?: boolean
    rightPanelVisible?: boolean
    openPanel?: boolean
    setOpenPanel?: any
    rightPanelWidth?: number
    rightPanelStyle?: any
    rightPanelSize?: number
    setRightPanelSize?: any
    borderLess?: boolean
    onResizeDragging?: (isDragging: boolean) => void
}

export const MainPanel = ({
    borderLess,
    rightPanelSize = 15,
    setRightPanelSize,
    rightPanelStyle = {},
    rightPanelWidth = 0,
    actionContent,
    rightPanelContent,
    leftPanelContent,
    centerPanelContent,
    rightPanelResizable = false,
    rightPanelVisible = true,
    openPanel,
    setOpenPanel = () => { },
    height = "100vh",
    onResizeDragging,
}: Props) => {
    // Fixed sidebar width for left panel
    const sidebarWidth = 25; // 25% for left sidebar

    return (
        <div style={{ flex: 1, display: 'flex', maxWidth: '100%' }}>
            {leftPanelContent && (
                <div
                    id="sidebar-panel-container"
                    style={{
                        flex: 1,
                        display: openPanel ? 'flex' : 'none',
                        position: 'absolute',
                        width: `${sidebarWidth}%`,
                        zIndex: 99999999,
                    }}
                >
                    <SPanel
                        key="sidebar"
                        type={'left'}
                        isOpen={true}
                        size={sidebarWidth}
                        backdropClicked={() => setOpenPanel(false)}
                    >
                        {leftPanelContent}
                    </SPanel>
                </div>
            )}
            {actionContent && (
                <div
                    id="left-actions-container"
                    style={{
                        display: openPanel ? "none" : "flex",
                        position: 'fixed',
                        zIndex: 99999999999999999999,
                        flexDirection: 'column',
                        left: '20px',
                        top: 'calc(50vh - 80px)',
                    }}
                >
                    {actionContent}
                </div>
            )}
            <PanelGroup 
                direction="horizontal" 
                style={{ height: '100%', display: 'flex' }}
                autoSaveId="vento-chat-layout"
            >
                <Panel defaultSize={100 - rightPanelSize}>
                    <div style={{ display: 'flex', flex: 1, height: height }}>
                        {centerPanelContent}
                    </div>
                </Panel>
                <CustomPanelResizeHandle
                    direction="vertical"
                    borderLess={borderLess}
                    visible={rightPanelVisible}
                    resizable={rightPanelResizable}
                    onDragging={onResizeDragging}
                />
                <Panel
                    defaultSize={rightPanelSize}
                    maxSize={80}
                    style={{
                        position: rightPanelVisible ? "relative" : "absolute",
                        zIndex: rightPanelVisible ? 100000 : -10,
                        display: 'flex',
                        ...rightPanelStyle,
                    }}
                >
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
                        {rightPanelContent}
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    )
}

export default MainPanel