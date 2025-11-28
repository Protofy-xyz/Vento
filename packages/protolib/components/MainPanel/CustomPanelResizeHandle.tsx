import React, { useRef } from "react"
import { PanelResizeHandle } from "react-resizable-panels"

type Props = {
    direction: 'horizontal' | 'vertical'
    borderLess?: boolean
    borderColor?: string
    visible?: boolean
    resizable?: boolean
    onDragging?: (isDragging: boolean) => void
}

const CustomPanelResizeHandle = ({ direction, borderLess = true, visible = true, resizable = true, borderColor = "#252526", onDragging }: Props) => {
    const resizerRef = useRef<any>()
    const resizerBarRef = useRef<any>()
    const hoverTimer = useRef<any>(null)

    const handleMouseEnter = () => {
        hoverTimer.current = setTimeout(() => {
            onHover()
        }, 50)
    }

    const onHover = () => {
        if (resizerRef.current) {
        }
        if (resizerBarRef.current) resizerBarRef.current.style.display = 'flex'
    }

    const onHoverLeave = () => {
        clearTimeout(hoverTimer.current)
        if (resizerRef.current) {
            if (resizerRef.current.isDragging) return
        }
        if (resizerBarRef.current) resizerBarRef.current.style.display = 'none'
    }

    return (
        <PanelResizeHandle
            onDragging={(isDragging) => {
                if (resizerRef.current) resizerRef.current.isDragging = isDragging
                if (!isDragging) onHoverLeave()
                onDragging?.(isDragging)
            }}
        >
            <div
                ref={resizerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={onHoverLeave}
                style={{
                    display: visible && resizable ? 'flex' : 'none',
                    width: direction === 'vertical' ? '6px' : '100%',
                    height: direction === 'vertical' ? '100%' : '6px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundImage:
                        direction === 'vertical'
                            ? `linear-gradient(to right, ${borderColor} 0px, ${borderColor} 1px, transparent 1px)`
                            : `linear-gradient(to bottom, ${borderColor} 0px, ${borderColor} 1px, transparent 1px)`,
                }}
            >
                <div
                    ref={resizerBarRef}
                    style={{
                        height: direction === 'vertical' ? '60px' : '4px',
                        width: direction === 'vertical' ? '4px' : '60px',
                        backgroundColor: 'white',
                        borderRadius: '20px',
                        display: 'none',
                    }}
                />
            </div>
        </PanelResizeHandle>
    )
}

export default CustomPanelResizeHandle
