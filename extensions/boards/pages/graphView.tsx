import { Tinted } from 'protolib/components/Tinted';
import { memo, useCallback, useLayoutEffect, useMemo, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { computeDirectedLayout } from '../utils/graph';
import { useThemeSetting } from '@tamagui/next-theme';
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    applyNodeChanges,
    getBezierPath,
    MiniMap,
    NodeResizer,
    MarkerType,
    BaseEdge,
    addEdge,
    Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const CFG = {
    GROUP_PADDING: 100,
    GROUP_HEADER_HEIGHT: 60,
    GROUP_BG: 'rgba(0,0,0,0.04)',
    LAYER_VERTICAL_GAP: 200,
    BASE_LAYER_IN_GROUP: true,
    RIGHT_MARGIN_EXTRA: 60,
    GROUP_EXTRA_BOTTOM: 20,
    VIEWPORT: { x: -150, y: 0, zoom: 0.35 },
    FITVIEW_PADDING: 0.2,
    NODE_DEFAULT_SIZE: { width: 300, height: 210 },
    LAYOUT: { hPixelRatio: 200, vPixelRatio: 50, marginX: 120, marginY: 60 },
} as const;

const GROUP_PAD_TOP = CFG.GROUP_PADDING + CFG.GROUP_HEADER_HEIGHT;

type Link = { name: string; type?: 'pre' | 'post' | 'code' };
type Card = { name: string; layer?: string; links?: Link[]; rulesCode?: string; content?: ReactNode; type?: 'action' | 'value' };
// 4 fixed handles: pre and post, each with input and output
type Ports = { 
    hasPreOut: boolean;   // Left - Pre output (I have dependencies)
    hasPostIn: boolean;   // Left - Post input (someone triggers me)
    hasPreIn: boolean;    // Right - Pre input (I am a dependency of someone)
    hasPostOut: boolean;  // Right - Post output (I trigger someone)
};
type RFNode = any;
type RFEdge = any;
type GraphLayout = Record<string, { x: number; y: number; width?: number; height?: number; layer?: string; parent?: string; type?: 'group' | 'node' }>;

const NODE_STYLE_BASE: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    display: 'flex',
    backgroundColor: 'var(--bgPanel)',
    textAlign: 'left',
    alignItems: 'flex-start',
    color: 'var(--color)',
    position: 'relative',
    transition: 'border 0.2s ease, box-shadow 0.2s ease',
};

const NODE_STYLE_SELECTED: CSSProperties = {
    ...NODE_STYLE_BASE,
    border: '2px solid var(--color9)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 0 0 2px var(--color9)',
    zIndex: 1000,
};

const NODE_STYLE_DEFAULT: CSSProperties = {
    ...NODE_STYLE_BASE,
    border: '1px solid var(--gray6)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    zIndex: 1,
};

const GROUP_STYLE: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    background: CFG.GROUP_BG,
    position: 'relative',
    zIndex: 0,
    pointerEvents: 'none',
};

const GROUP_HEADER_STYLE: CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: CFG.GROUP_HEADER_HEIGHT,
    display: 'flex',
    padding: '0 12px',
    fontSize: CFG.GROUP_HEADER_HEIGHT * 0.4,
    fontWeight: 600,
    color: 'var(--gray11)',
    background: 'var(--bgPanel)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    pointerEvents: 'auto',
    alignItems: 'center',
    cursor: 'auto',
};

const FLOW_STYLES = `
.react-flow__node { border: none !important; background: transparent !important; box-shadow: none !important; }
.react-flow__node-layerGroup { pointer-events: none !important; }
.react-flow__node-layerGroup .layer-group-header { pointer-events: auto; }
.react-flow__nodesselection, .react-flow__nodesselection-rect { pointer-events: none !important; background: transparent !important; border: none !important; }
.rf-selecting .react-flow__node, .rf-selecting .react-flow__handle, .rf-selecting .layer-group-header { pointer-events: none !important; }
body.rf-noselect, body.rf-noselect * { user-select: none !important; }
.react-flow__node.selected { z-index: 1000 !important; }
.react-flow__edge { cursor: pointer; }
.react-flow__edge.selected { z-index: 1000 !important; }
.react-flow__edge-interaction { pointer-events: all; }
`;

const LINK_PRE_COLOR = "purple"
const LINK_POST_COLOR = "color"

const getNodeSize = (n: RFNode) => ({
    // v12: measured contains actual dimensions after resize
    width: n?.measured?.width ?? parseFloat(n?.style?.width) ?? CFG.NODE_DEFAULT_SIZE.width,
    height: n?.measured?.height ?? parseFloat(n?.style?.height) ?? CFG.NODE_DEFAULT_SIZE.height,
});

const groupByLayer = (cards: Card[]): Map<string, Card[]> => {
    const grouped = new Map<string, Card[]>();
    for (const c of cards) {
        const layer = c.layer || 'base';
        (grouped.get(layer) ?? grouped.set(layer, []).get(layer)!).push(c);
    }
    return grouped;
};

const buildPortsFor = (cardName: string, edges: RFEdge[], cardType?: string): Ports => {
    // Pre: source has preOut (left), target has preIn (right)
    const hasPreOutFromEdges = edges.filter(e => e.source === cardName && e.data?.linkType === 'pre').length > 0;
    const hasPreInFromEdges = edges.filter(e => e.target === cardName && e.data?.linkType === 'pre').length > 0;
    // Post/Code: source has postOut (right), target has postIn (left)
    const hasPostOutFromEdges = edges.filter(e => e.source === cardName && (e.data?.linkType === 'post' || e.data?.linkType === 'code')).length > 0;
    const hasPostInFromEdges = edges.filter(e => e.target === cardName && (e.data?.linkType === 'post' || e.data?.linkType === 'code')).length > 0;
    
    // Action cards always show post-in (execution input) and post-out (execution output) handlers
    const isActionCard = cardType === 'action';
    
    return {
        hasPreOut: hasPreOutFromEdges,
        hasPreIn: hasPreInFromEdges,
        hasPostOut: isActionCard || hasPostOutFromEdges,
        hasPostIn: isActionCard || hasPostInFromEdges,
    };
};

const buildEdgesFromCards = (cards: Card[]): RFEdge[] => {
    const nodeIds = new Set(cards.map(c => c.name));
    const edges: RFEdge[] = [];
    const dupCounter = new Map<string, number>();

    for (const card of cards) {
        const links = [...(card.links || [])];
        // Extract executeAction calls from rulesCode
        const regex = /executeAction\(\s*\{\s*name:\s*["']([\w-]+)["']/g;
        let match;
        while ((match = regex.exec(card.rulesCode ?? '')) !== null) {
            if (match[1] && nodeIds.has(match[1])) links.push({ name: match[1], type: 'code' });
        }

        for (const link of links) {
            if (!link?.name || !nodeIds.has(link.name)) continue;
            const key = `${card.name}->${link.name}`;
            const dup = dupCounter.get(key) ?? 0;
            dupCounter.set(key, dup + 1);

            const isPre = link.type === 'pre';
            const isCode = link.type === 'code';
            const strokeColor = isPre ? `var(--${LINK_PRE_COLOR}9)` : `var(--${LINK_POST_COLOR}9)`;

            // Pre: exits from left of source (pre-out), enters right of target (pre-in)
            // Post/Code: exits from right of source (post-out), enters left of target (post-in)
            // All edges of the same type use the same handle
            const sourceHandle = isPre ? 'pre-out' : 'post-out';
            const targetHandle = isPre ? 'pre-in' : 'post-in';

            edges.push({
                id: dup ? `${key}#${dup}` : key,
                source: card.name,
                target: link.name,
                sourceHandle,
                targetHandle,
                type: 'curvy',
                data: { linkType: link.type || 'pre' },
                // Code edges cannot be selected/deleted (they come from rulesCode)
                selectable: !isCode,
                focusable: !isCode,
                // Pre: arrow at end pointing backward (custom marker)
                // Post: arrow at end pointing forward (default marker)
                ...(isPre ? {
                    markerEnd: 'arrow-pre-backward',
                } : {
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 12,
                        height: 12,
                        color: strokeColor,
                    },
                }),
                style: {
                    stroke: strokeColor,
                    strokeWidth: 2,
                    strokeDasharray: isPre ? '6 3' : undefined,
                    opacity: isCode ? 0.4 : 1,
                },
            });
        }
    }
    return edges;
};

const readViewportFromURL = () => {
    try {
        const sp = new URLSearchParams(window.location.search);
        if (!sp.has('x') || !sp.has('y') || !sp.has('zoom')) return null;
        const x = Number(sp.get('x')), y = Number(sp.get('y')), zoom = Number(sp.get('zoom'));
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) ? { x, y, zoom } : null;
    } catch { return null; }
};

const writeViewportToURL = (vp: { x: number; y: number; zoom: number }) => {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('x', (Math.round(vp.x * 100) / 100).toString());
        url.searchParams.set('y', (Math.round(vp.y * 100) / 100).toString());
        url.searchParams.set('zoom', (Math.round(vp.zoom * 1000) / 1000).toString());
        window.history.replaceState({}, '', url.toString());
    } catch { /* noop */ }
};

const layoutsEqual = (a?: GraphLayout, b?: GraphLayout): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every(k => {
        const av = a[k], bv = b[k];
        return bv && av.x === bv.x && av.y === bv.y && av.width === bv.width && av.height === bv.height && av.layer === bv.layer && av.parent === bv.parent && av.type === bv.type;
    });
};

// Handle styles: square=output, circle=input
const handleStyle = (color: string, isOutput: boolean): CSSProperties => ({
    width: 10,
    height: 10,
    backgroundColor: `var(--${color}${isOutput ? 7 : 4})`,
    border: `2px solid var(--${color}${isOutput ? 9 : 7})`,
    borderRadius: isOutput ? 2 : '50%',
});

const HANDLE_PRE_OUT_STYLE = handleStyle(LINK_PRE_COLOR, true);
const HANDLE_PRE_IN_STYLE = handleStyle(LINK_PRE_COLOR, false);
const HANDLE_POST_OUT_STYLE = handleStyle(LINK_POST_COLOR, true);
const HANDLE_POST_IN_STYLE = handleStyle(LINK_POST_COLOR, false);

const DefaultNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
    const ports = data?.ports as Ports | undefined;
    const hasPreOut = ports?.hasPreOut ?? false;
    const hasPostIn = ports?.hasPostIn ?? false;
    const hasPreIn = ports?.hasPreIn ?? false;
    const hasPostOut = ports?.hasPostOut ?? false;

    // Calculate positions based on how many handles are on each side
    const leftCount = (hasPreOut ? 1 : 0) + (hasPostIn ? 1 : 0);
    const rightCount = (hasPreIn ? 1 : 0) + (hasPostOut ? 1 : 0);

    // Check if target is an interactive element that should not trigger card selection
    const isInteractiveElement = useCallback((target: HTMLElement): boolean => {
        const tagName = target.tagName.toLowerCase();
        // Direct interactive elements - these always block selection
        if (tagName === 'input' || tagName === 'button' || tagName === 'select' || 
            tagName === 'textarea' || tagName === 'a') {
            return true;
        }
        // Check for interactive ancestors - only direct interactive elements
        const interactive = target.closest('button, a, input, select, textarea, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="combobox"], [role="menuitem"], [role="tab"]');
        if (interactive) {
            return true;
        }
        // Check for elements explicitly marked as clickable
        if (target.hasAttribute('data-clickable') || target.closest('[data-clickable="true"]')) {
            return true;
        }
        // Check for contenteditable
        if (target.isContentEditable) {
            return true;
        }
        return false;
    }, []);

    // Stop propagation for all pointer events on interactive elements to prevent card selection
    const handleInteractiveEvent = useCallback((e: React.MouseEvent | React.PointerEvent) => {
        const target = e.target as HTMLElement;
        // If clicking on interactive element, stop propagation to prevent card selection
        if (isInteractiveElement(target)) {
            e.stopPropagation();
        }
    }, [isInteractiveElement]);

    return (
        <>
            <NodeResizer 
                minWidth={180} 
                minHeight={120}
                isVisible={true}
                color="transparent"
                handleStyle={{ 
                    width: 30, 
                    height: 30, 
                    borderRadius: 3,
                    backgroundColor: 'transparent',
                    opacity: 0,
                }}
            />
            <div 
                style={selected ? NODE_STYLE_SELECTED : NODE_STYLE_DEFAULT}
                onMouseDown={handleInteractiveEvent}
                onPointerDown={handleInteractiveEvent}
                onClick={handleInteractiveEvent}
            >
                {data.content}
                
                {/* Left side - Pre Out */}
                {hasPreOut && (
                    <Handle 
                        id="pre-out"
                        type="source" 
                        position={Position.Left}
                        style={{ 
                            ...HANDLE_PRE_OUT_STYLE, 
                            top: leftCount === 2 ? '30%' : '50%'
                        }} 
                    />
                )}
                
                {/* Left side - Post In */}
                {hasPostIn && (
                    <Handle 
                        id="post-in"
                        type="target" 
                        position={Position.Left}
                        style={{ 
                            ...HANDLE_POST_IN_STYLE, 
                            top: leftCount === 2 ? '70%' : '50%'
                        }} 
                    />
                )}
                
                {/* Right side - Pre In */}
                {hasPreIn && (
                    <Handle 
                        id="pre-in"
                        type="target" 
                        position={Position.Right}
                        style={{ 
                            ...HANDLE_PRE_IN_STYLE, 
                            top: rightCount === 2 ? '30%' : '50%'
                        }} 
                    />
                )}
                
                {/* Right side - Post Out */}
                {hasPostOut && (
                    <Handle 
                        id="post-out"
                        type="source" 
                        position={Position.Right}
                        style={{ 
                            ...HANDLE_POST_OUT_STYLE, 
                            top: rightCount === 2 ? '70%' : '50%'
                        }} 
                    />
                )}
            </div>
        </>
    );
});

const LayerGroupNode = memo(({ data }: { data: any }) => {
    const [hovered, setHovered] = useState(false);
    const borderColor = hovered ? 'color8' : data?.isActiveLayer ? 'gray8' : 'gray6';

    return (
        <div className="layer-group" style={{ ...GROUP_STYLE, border: `3px solid var(--${borderColor})` }}>
            <div style={GROUP_HEADER_STYLE} className="layer-group-header"
                onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                {data?.label}
            </div>
        </div>
    );
});

const CurvyEdge = memo((props: any) => {
    const [edgePath] = getBezierPath({ ...props, curvature: 0.4 });
    const isSelected = props.selected;
    const isCode = props.data?.linkType === 'code';
    const baseStroke = props.style?.stroke || 'var(--edgeDefault, var(--color5))';
    const baseWidth = props.style?.strokeWidth || 2;
    
    // Code edges are not selectable/deletable
    if (isCode) {
        return (
            <path 
                id={props.id} 
                className="react-flow__edge-path" 
                d={edgePath} 
                markerEnd={props.markerEnd}
                markerStart={props.markerStart}
                style={{ 
                    stroke: baseStroke, 
                    strokeWidth: baseWidth, 
                    strokeDasharray: props.style?.strokeDasharray,
                    opacity: props.style?.opacity ?? 1,
                    fill: 'none', 
                    pointerEvents: 'none',
                }} 
            />
        );
    }
    
    return (
        <BaseEdge
            id={props.id}
            path={edgePath}
            markerEnd={props.markerEnd}
            markerStart={props.markerStart}
            interactionWidth={20}
            style={{ 
                stroke: baseStroke, 
                strokeWidth: baseWidth, 
                strokeDasharray: isSelected ? undefined : '6 4',
                opacity: props.style?.opacity ?? 1,
                transition: 'stroke-dasharray 0.15s ease',
            }}
        />
    );
});

const nodeTypes = { default: DefaultNode, layerGroup: LayerGroupNode };
const edgeTypes = { curvy: CurvyEdge };


const computeLayerLayout = (cards: Card[], edges: RFEdge[]) =>
    computeDirectedLayout({ cards, edges, ...CFG.LAYOUT }) as {
        positions: Record<string, { x: number; y: number }>;
        sizes: Map<string, { width: number; height: number }>;
    };

const computeBounds = (cards: Card[], positions: Record<string, { x: number; y: number }>, sizes: Map<string, { width: number; height: number }>) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cards) {
        const sz = sizes.get(c.name)!, pos = positions[c.name]!;
        minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + sz.width); maxY = Math.max(maxY, pos.y + sz.height);
    }
    return { minX, minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
};

const materializeNodes = (
    cards: Card[],
    positions: Record<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>,
    edges: RFEdge[],
    savedLayout?: GraphLayout,
    layerName?: string,
    groupId?: string,
    offset = { x: 0, y: 0 }
): RFNode[] => {
    // Find rightmost X from saved positions for fallback positioning
    const savedBounds = cards.reduce((b, c) => {
        const saved = savedLayout?.[c.name];
        if (!saved || (saved.layer && layerName && saved.layer !== layerName)) return b;
        const sz = sizes.get(c.name)!;
        return { maxX: Math.max(b.maxX, saved.x + sz.width), valid: true };
    }, { maxX: -Infinity, valid: false });
    const rightmostX = savedBounds.valid ? savedBounds.maxX : null;

    return cards.map(c => {
        const sz = sizes.get(c.name)!;
        const pos = positions[c.name]!;
        const saved = savedLayout?.[c.name];
        const savedValid = saved && (!saved.layer || !layerName || saved.layer === layerName);

        let x: number, y: number;
        if (savedValid) {
            x = saved.x; y = saved.y;
        } else if (rightmostX !== null) {
            x = rightmostX + CFG.LAYOUT.marginX * 0.6;
            y = groupId ? (pos.y - offset.y) + GROUP_PAD_TOP : pos.y + offset.y;
        } else {
            x = groupId ? (pos.x - offset.x) + CFG.GROUP_PADDING : pos.x;
            y = groupId ? (pos.y - offset.y) + GROUP_PAD_TOP : pos.y + offset.y;
        }

        // Use saved dimensions if available, otherwise use computed size
        const width = saved?.width ?? sz.width;
        const height = saved?.height ?? sz.height;

        return {
            id: c.name,
            type: 'default',
            parentId: groupId,  // v12: parentNode renamed to parentId
            position: { x, y },
            data: { ...c, ports: buildPortsFor(c.name, edges, c.type) },
            style: { width: `${width}px`, height: `${height}px`, background: 'transparent' },
        };
    });
};

const materializeLayer = (
    layerName: string,
    cards: Card[],
    edges: RFEdge[],
    yOffset: number,
    savedLayout?: GraphLayout
): { groupNode?: RFNode; contentNodes: RFNode[]; yIncrement: number } => {
    const { positions, sizes } = computeLayerLayout(cards, edges);
    const { minX, minY, width, height } = computeBounds(cards, positions, sizes);
    const isFlat = !CFG.BASE_LAYER_IN_GROUP && layerName === 'base';

    if (isFlat) {
        return {
            contentNodes: materializeNodes(cards, positions, sizes, edges, savedLayout, layerName, undefined, { x: 0, y: yOffset }),
            yIncrement: height + CFG.LAYER_VERTICAL_GAP,
        };
    }

    const groupWidth = width + CFG.GROUP_PADDING * 2 + CFG.RIGHT_MARGIN_EXTRA;
    const groupHeight = height + CFG.GROUP_HEADER_HEIGHT + CFG.GROUP_PADDING * 2 + CFG.GROUP_EXTRA_BOTTOM;
    const saved = savedLayout?.[`group-${layerName}`];
    const groupNode: RFNode = {
        id: `group-${layerName}`,
        type: 'layerGroup',
        position: saved ? { x: saved.x, y: saved.y } : { x: 0, y: yOffset },
        data: { label: layerName, layer: layerName },
        style: { width: groupWidth, height: groupHeight },
        draggable: true,
        dragHandle: '.layer-group-header',
        selectable: false,
    };

    return {
        groupNode,
        contentNodes: materializeNodes(cards, positions, sizes, edges, savedLayout, layerName, groupNode.id, { x: minX, y: minY }),
        yIncrement: groupHeight + CFG.LAYER_VERTICAL_GAP,
    };
};

export type EdgeDeleteInfo = {
    source: string;      // Card name that has the link
    target: string;      // Target card name
    linkType: 'pre' | 'post' | 'code';
};

export type EdgeCreateInfo = {
    source: string;      // Card name that initiates the connection
    target: string;      // Target card name
    linkType: 'pre' | 'post';
};

const normalizeGroupNodes = (nodes: RFNode[]): RFNode[] => {
    const next = nodes.map(n => ({ ...n, style: { ...n.style } }));
    const groups = next.filter(n => n.type === 'layerGroup');

    for (const g of groups) {
        const children = next.filter(n => n.parentId === g.id);
        if (!children.length) continue;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of children) {
            const { width, height } = getNodeSize(c);
            minX = Math.min(minX, c.position.x); minY = Math.min(minY, c.position.y);
            maxX = Math.max(maxX, c.position.x + width); maxY = Math.max(maxY, c.position.y + height);
        }

        const targetTop = GROUP_PAD_TOP;
        const shiftX = minX - CFG.GROUP_PADDING;
        const shiftY = minY - targetTop;

        if (shiftX !== 0 || shiftY !== 0) {
            g.position = { x: (g.position?.x || 0) + shiftX, y: (g.position?.y || 0) + shiftY };
            for (const c of children) c.position = { x: c.position.x - shiftX, y: c.position.y - shiftY };
            maxX -= shiftX; maxY -= shiftY;
        }

        g.style.width = (maxX - CFG.GROUP_PADDING) + CFG.GROUP_PADDING * 2 + CFG.RIGHT_MARGIN_EXTRA;
        g.style.height = (maxY - targetTop) + CFG.GROUP_HEADER_HEIGHT + CFG.GROUP_PADDING * 2 + CFG.GROUP_EXTRA_BOTTOM;
    }
    return next;
};

const Flow = memo(({
    initialNodes,
    initialEdges,
    initialLayout,
    onLayoutChange,
    activeLayer,
    onSelectLayer,
    onDeleteNodes,
    onSelectionChange,
    selectedIds,
    onDeleteEdges,
    onCreateEdge,
    linksKey,
}: {
    initialNodes: RFNode[];
    initialEdges: RFEdge[];
    initialLayout?: GraphLayout | null;
    onLayoutChange?: (layout: GraphLayout) => void;
    activeLayer?: string;
    onSelectLayer?: (layer: string) => void;
    onDeleteNodes?: (ids: string[]) => void;
    onSelectionChange?: (ids: string[]) => void;
    selectedIds?: string[];
    onDeleteEdges?: (edges: EdgeDeleteInfo[]) => void;
    onCreateEdge?: (edge: EdgeCreateInfo) => void;
    linksKey?: string;
}) => {
    const layoutRef = useRef<GraphLayout | null | undefined>(initialLayout);
    const lastSelectionRef = useRef<string[]>([]);
    const initialNodesKeyRef = useRef('');
    const [selectionActive, setSelectionActive] = useState(false);
    const { resolvedTheme } = useThemeSetting();
    const darkMode = resolvedTheme === 'dark';

    // Normalize and add layer data
    const processedNodes = useMemo(() => {
        const normalized = normalizeGroupNodes(initialNodes);
        return normalized.map(node => ({
            ...node,
            data: {
                ...node.data,
                isActiveLayer: node.type === 'layerGroup' ? (!activeLayer || node.data.layer === activeLayer) : node.data?.isActiveLayer,
            },
        }));
    }, [initialNodes, activeLayer]);

    const [nodes, setNodes] = useNodesState(processedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Calculate viewport once
    const defaultViewport = useMemo(() => {
        const urlVp = typeof window !== 'undefined' ? readViewportFromURL() : null;
        if (urlVp) return urlVp;

        const nodesMap = new Map(nodes.map(n => [n.id, n]));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
            const { width, height } = getNodeSize(n);
            const parent = n.parentId ? nodesMap.get(n.parentId) : null;
            const absX = (parent?.position?.x || 0) + n.position.x;
            const absY = (parent?.position?.y || 0) + n.position.y;
            minX = Math.min(minX, absX); minY = Math.min(minY, absY);
            maxX = Math.max(maxX, absX + width); maxY = Math.max(maxY, absY + height);
        }
        const hasNodes = Number.isFinite(minX);
        const centerX = hasNodes ? (minX + maxX) / 2 : 0;
        const centerY = hasNodes ? (minY + maxY) / 2 : 0;
        const zoom = CFG.VIEWPORT.zoom;
        return {
            x: (window.innerWidth / 2) - centerX * zoom + CFG.VIEWPORT.x,
            y: (window.innerHeight / 2) - centerY * zoom + CFG.VIEWPORT.y,
            zoom,
        };
    }, []); // Only compute once on mount

    const exportLayout = useCallback((nds: RFNode[]): GraphLayout => {
        const layout: GraphLayout = {};
        for (const n of nds) {
            const width = n.measured?.width ?? n.width ?? parseFloat(n.style?.width) ?? undefined;
            const height = n.measured?.height ?? n.height ?? parseFloat(n.style?.height) ?? undefined;
            layout[n.id] = {
                x: n.position.x,
                y: n.position.y,
                ...(width ? { width } : {}),
                ...(height ? { height } : {}),
                layer: n.data.layer,
                parent: n.parentId,
                type: n.type === 'layerGroup' ? 'group' : 'node',
            };
        }
        return layout;
    }, []);

    const onNodesChange = useCallback((changes: any[]) => {
        const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
        if (removedIds.length) {
            setEdges(eds => eds.filter(e => !removedIds.includes(e.source) && !removedIds.includes(e.target)));
        }

        const shouldPersist = changes.some(c => 
            (c.type === 'position' && c.dragging === false) || 
            (c.type === 'dimensions' && c.resizing === false)
        ) || removedIds.length > 0;

        setNodes(nds => {
            const next = normalizeGroupNodes(applyNodeChanges(changes, nds));

            if (removedIds.length && onDeleteNodes) {
                const deletable = removedIds.filter(id => nds.find(n => n.id === id)?.type !== 'layerGroup');
                if (deletable.length) onDeleteNodes(deletable);
            }

            if (shouldPersist && onLayoutChange) {
                const exported = exportLayout(next);
                if (!layoutsEqual(exported, layoutRef.current)) {
                    layoutRef.current = exported;
                    onLayoutChange(exported);
                }
            }
            return next;
        });
    }, [setNodes, setEdges, onLayoutChange, exportLayout, onDeleteNodes]);

    const handleMoveEnd = useCallback((_: any, vp: { x: number; y: number; zoom: number }) => writeViewportToURL(vp), []);

    const handleNodeClick = useCallback((_: any, node: RFNode) => {
        if (onSelectLayer && node.data.layer) onSelectLayer(node.data.layer);
    }, [onSelectLayer]);

    const handleSelectionChange = useCallback((selection: { nodes: RFNode[] }) => {
        const ids = (selection?.nodes || []).filter(n => n.type !== 'layerGroup').map(n => n.id).sort();
        if (lastSelectionRef.current.join() !== ids.join()) {
            lastSelectionRef.current = ids;
            onSelectionChange?.(ids);
        }
    }, [onSelectionChange]);

    const handlePaneClick = useCallback(() => {
        lastSelectionRef.current = [];
        onSelectionChange?.([]);
    }, [onSelectionChange]);

    // Handle new connection creation
    const handleConnect = useCallback((connection: Connection) => {
        if (!connection.source || !connection.target) return;
        if (connection.source === connection.target) return; // No self-connections
        
        // Validate: source must be an output (-out), target must be an input (-in)
        const isSourceOutput = connection.sourceHandle?.endsWith('-out');
        const isTargetInput = connection.targetHandle?.endsWith('-in');
        if (!isSourceOutput || !isTargetInput) return;
        
        // Determine link type based on source handle
        // pre-out = pre link (dependency)
        // post-out = post link (execution flow)
        const isPre = connection.sourceHandle === 'pre-out';
        const linkType: 'pre' | 'post' = isPre ? 'pre' : 'post';
        
        // Determine target handle based on link type (enforce matching types for correct semantics)
        const targetHandle = isPre ? 'pre-in' : 'post-in';
        
        // Check if edge already exists
        const edgeExists = edges.some(e => 
            e.source === connection.source && 
            e.target === connection.target &&
            e.data?.linkType === linkType
        );
        if (edgeExists) return;
        
        // Create the visual edge
        const strokeColor = isPre ? `var(--${LINK_PRE_COLOR}9)` : `var(--${LINK_POST_COLOR}9)`;
        const newEdge: RFEdge = {
            id: `${connection.source}->${connection.target}`,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: targetHandle,
            type: 'curvy',
            data: { linkType },
            selectable: true,
            focusable: true,
            ...(isPre ? {
                markerEnd: 'arrow-pre-backward',
            } : {
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 12,
                    height: 12,
                    color: strokeColor,
                },
            }),
            style: {
                stroke: strokeColor,
                strokeWidth: 2,
                strokeDasharray: isPre ? '6 3' : undefined,
            },
        };
        
        setEdges(eds => addEdge(newEdge, eds));
        
        // Notify parent to persist the link
        if (onCreateEdge) {
            onCreateEdge({
                source: connection.source,
                target: connection.target,
                linkType,
            });
        }
    }, [edges, setEdges, onCreateEdge]);

    // Handle edge deletion via onEdgesChange
    const handleEdgesChange = useCallback((changes: any[]) => {
        const removedEdges = changes.filter(c => c.type === 'remove');
        if (removedEdges.length && onDeleteEdges) {
            const edgesToDelete: EdgeDeleteInfo[] = [];
            for (const change of removedEdges) {
                const edge = edges.find(e => e.id === change.id);
                if (edge && edge.data?.linkType !== 'code') {
                    edgesToDelete.push({
                        source: edge.source,
                        target: edge.target,
                        linkType: edge.data?.linkType || 'post',
                    });
                }
            }
            if (edgesToDelete.length) {
                onDeleteEdges(edgesToDelete);
            }
        }
        onEdgesChange(changes);
    }, [edges, onDeleteEdges, onEdgesChange]);

    // Handle keyboard delete for selected nodes and edges
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
                // Ignore if focus is on an input, textarea, or editable element
                const activeEl = document.activeElement;
                if (activeEl) {
                    const tagName = activeEl.tagName.toLowerCase();
                    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                        return;
                    }
                    if ((activeEl as HTMLElement).isContentEditable) {
                        return;
                    }
                    // Ignore if focus is inside a dialog, popover, or sidebar panel
                    if (activeEl.closest('[role="dialog"]') || 
                        activeEl.closest('[data-radix-popper-content-wrapper]') ||
                        activeEl.closest('.floating-window')) {
                        return;
                    }
                }

                // Check for selected nodes (cards) first
                const selectedNodes = nodes.filter(n => n.selected && n.type !== 'layerGroup');
                if (selectedNodes.length && onDeleteNodes) {
                    const nodeIds = selectedNodes.map(n => n.id);
                    onDeleteNodes(nodeIds);
                    return; // Don't also delete edges when deleting nodes
                }

                // Check for selected edges
                const selectedEdges = edges.filter(edge => edge.selected);
                // Filter out 'code' type edges (they can't be deleted as they come from rulesCode)
                const deletableEdges = selectedEdges.filter(e => e.data?.linkType !== 'code');
                if (deletableEdges.length && onDeleteEdges) {
                    const edgesToDelete: EdgeDeleteInfo[] = deletableEdges.map(edge => ({
                        source: edge.source,
                        target: edge.target,
                        linkType: edge.data?.linkType || 'post',
                    }));
                    onDeleteEdges(edgesToDelete);
                    // Remove edges from local state
                    setEdges(eds => eds.filter(e => !deletableEdges.find(d => d.id === e.id)));
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, edges, onDeleteNodes, onDeleteEdges, setEdges]);

    // Sync nodes when initial data changes
    // linksKey dependency ensures ports (handles) update when links change
    useLayoutEffect(() => {
        const structuralKey = processedNodes
            .map(n => `${n.id}:${n.parentId || ''}:${n.data?.layer || ''}:${n.position?.x ?? 0}:${n.position?.y ?? 0}`)
            .sort().join('|');

        // Include linksKey in the comparison to force port updates
        const fullKey = `${structuralKey}::${linksKey || ''}`;

        if (initialNodesKeyRef.current !== fullKey) {
            initialNodesKeyRef.current = fullKey;
            setNodes(processedNodes);
        } else {
            // Only update data, preserve positions
            setNodes(current => {
                const dataMap = new Map(processedNodes.map(n => [n.id, n.data]));
                let changed = false;
                const updated = current.map(node => {
                    const newData = dataMap.get(node.id);
                    if (newData && newData !== node.data) {
                        changed = true;
                        return { ...node, data: newData };
                    }
                    return node;
                });
                return changed ? updated : current;
            });
        }
    }, [processedNodes, setNodes, linksKey]);

    // Sync edges while preserving selection state
    // linksKey dependency ensures edges update when links change
    useEffect(() => { 
        setEdges(currentEdges => {
            // Create a map of current selection states
            const selectionMap = new Map(currentEdges.map(e => [e.id, e.selected]));
            // Apply selection state to new edges
            return initialEdges.map(edge => ({
                ...edge,
                selected: selectionMap.get(edge.id) ?? edge.selected ?? false
            }));
        });
    }, [initialEdges, setEdges, linksKey]);

    // Sync layout ref
    useEffect(() => { layoutRef.current = initialLayout; }, [initialLayout]);

    // Persist layout for new/removed nodes
    useEffect(() => {
        if (!onLayoutChange) return;
        const nodeIds = new Set(processedNodes.map(n => n.id));
        const missingNode = !initialLayout || processedNodes.some(n => !initialLayout[n.id]);
        const hasStale = initialLayout && Object.keys(initialLayout).some(id => !nodeIds.has(id));
        if (missingNode || hasStale) {
            const nextLayout = exportLayout(processedNodes);
            if (!layoutsEqual(nextLayout, layoutRef.current)) {
                layoutRef.current = nextLayout;
                onLayoutChange(nextLayout);
            }
        }
    }, [processedNodes, onLayoutChange, initialLayout, exportLayout]);

    // Selection sync
    useEffect(() => {
        if (!selectedIds) return;
        const sorted = [...selectedIds].sort();
        if (lastSelectionRef.current.join() !== sorted.join()) {
            lastSelectionRef.current = sorted;
            setNodes(nds => nds.map(n => ({ ...n, selected: sorted.includes(n.id) })));
        }
    }, [selectedIds, setNodes]);

    // Lasso selection class toggle
    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('rf-noselect', selectionActive);
        if (selectionActive) window.getSelection?.()?.removeAllRanges?.();
        return () => { document.body.classList.remove('rf-noselect'); };
    }, [selectionActive]);


    return (
        <Tinted>
            <ReactFlow
                edgeTypes={edgeTypes}
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onMoveEnd={handleMoveEnd}
                fitViewOptions={{ padding: CFG.FITVIEW_PADDING }}
                defaultViewport={defaultViewport}
                minZoom={0.03}
                maxZoom={2}
                selectionOnDrag
                selectNodesOnDrag
                selectionKeyCode={['Control', 'Meta', 'Shift']}
                multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
                onSelectionChange={handleSelectionChange}
                onSelectionStart={() => setSelectionActive(true)}
                onSelectionEnd={() => setSelectionActive(false)}
                onPaneClick={handlePaneClick}
                onNodeClick={handleNodeClick}
                className={selectionActive ? 'rf-selecting' : undefined}
                nodesDraggable
                nodesConnectable
                elementsSelectable
                edgesFocusable
                zoomOnScroll
                zoomOnPinch
                panOnDrag
                proOptions={{ hideAttribution: true }}
                elevateEdgesOnSelect
                elevateNodesOnSelect
                style={{ zIndex: 0 }}
                translateExtent={[[-25000, -25000], [25000, 25000]]}
                deleteKeyCode={null}
            >
                {/* Custom marker for pre links: arrow at end pointing backward */}
                <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                        <marker
                            id="arrow-pre-backward"
                            markerWidth="12"
                            markerHeight="12"
                            refX="12"
                            refY="6"
                            orient="auto"
                            markerUnits="userSpaceOnUse"
                        >
                            <path d="M 12 0 L 0 6 L 12 12 z" fill={`var(--${LINK_PRE_COLOR}9)`} />
                        </marker>
                    </defs>
                </svg>
                <style>{FLOW_STYLES}</style>
                <Background gap={20} />
                <MiniMap
                    position="bottom-left"
                    maskColor={`rgba(0,0,0,${darkMode ? '0.4' : '0.05'})`}
                    nodeStrokeColor={n => n.style?.borderColor || 'black'}
                    nodeColor={n => n.type !== 'layerGroup' ? 'var(--bgPanel)' : 'var(--bgContent)'}
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                />
            </ReactFlow>
        </Tinted>
    );
});

export const GraphView = memo(({
    cards,
    layout,
    onLayoutChange,
    activeLayer,
    onSelectLayer,
    onDeleteNodes,
    onSelectionChange,
    selectedIds,
    onDeleteEdges,
    onCreateEdge,
}: {
    cards: Card[];
    layout?: GraphLayout;
    onLayoutChange?: (layout: GraphLayout) => void;
    activeLayer?: string;
    onSelectLayer?: (layer: string) => void;
    onDeleteNodes?: (ids: string[]) => void;
    onSelectionChange?: (ids: string[]) => void;
    selectedIds?: string[];
    onDeleteEdges?: (edges: EdgeDeleteInfo[]) => void;
    onCreateEdge?: (edge: EdgeCreateInfo) => void;
}) => {
    // Create a stable key for links to detect changes
    const linksKey = useMemo(() => {
        return (cards || []).map(c => 
            `${c.name}:${(c.links || []).map(l => `${l.name}:${l.type}`).join(',')}`
        ).join('|');
    }, [cards]);

    // Memoize heavy computations
    const { initialNodes, initialEdges } = useMemo(() => {
        const safeCards = cards || [];
        const edges = buildEdgesFromCards(safeCards);
        const grouped = groupByLayer(safeCards);
        const groupNodes: RFNode[] = [];
        const contentNodes: RFNode[] = [];
        let yOffset = 0;

        for (const [layerName, layerCards] of Array.from(grouped.entries())) {
            const { groupNode, contentNodes: layerNodes, yIncrement } = materializeLayer(layerName, layerCards, edges, yOffset, layout);
            if (groupNode) groupNodes.push(groupNode);
            contentNodes.push(...layerNodes);
            yOffset += yIncrement;
        }

        return { initialNodes: [...groupNodes, ...contentNodes], initialEdges: edges };
    }, [cards, layout, linksKey]);

    return (
        <Flow
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            initialLayout={layout}
            onLayoutChange={onLayoutChange}
            activeLayer={activeLayer}
            onSelectLayer={onSelectLayer}
            onDeleteNodes={onDeleteNodes}
            onSelectionChange={onSelectionChange}
            selectedIds={selectedIds}
            onDeleteEdges={onDeleteEdges}
            onCreateEdge={onCreateEdge}
            linksKey={linksKey}
        />
    );
});
