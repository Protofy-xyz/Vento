import { Tinted } from 'protolib/components/Tinted';
import React, { memo, useCallback, useLayoutEffect, useMemo, useEffect, useRef } from 'react';
import { computeDirectedLayout } from '../utils/graph';
import { useThemeSetting } from '@tamagui/next-theme'
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    applyNodeChanges,
    BezierEdge,
    getBezierPath,
    MiniMap
} from 'reactflow';

/* =========================================================
 *  Configuración centralizada (ajustable sin tocar más código)
 * ========================================================= */
const CFG = {
    GROUP_PADDING: 100,
    GROUP_HEADER_HEIGHT: 60,
    GROUP_BG: 'rgba(0,0,0,0.04)',
    GROUP_BORDER: '2px solid var(--gray6)',
    LAYER_VERTICAL_GAP: 200,
    BASE_LAYER_IN_GROUP: true,
    RIGHT_MARGIN_EXTRA: 60,
    GROUP_EXTRA_BOTTOM: 20,
    VIEWPORT: { x: -150, y: 0, zoom: 0.35 as number },
    FITVIEW_PADDING: 0.2,
    NODE_DEFAULT_SIZE: { width: 300, height: 210 },
    LAYOUT: {
        hPixelRatio: 200,
        vPixelRatio: 50,
        marginX: 120,
        marginY: 60,
    },
};

const GROUP_PAD_TOP = CFG.GROUP_PADDING + CFG.GROUP_HEADER_HEIGHT;

type Link = { name: string; type?: 'pre' | 'post' | 'code' };
type Card = {
    name: string;
    layer?: string;
    links?: Link[];
    rulesCode?: string;
    content?: React.ReactNode;
};

type Ports = { inputs: string[]; outputs: string[] };
type RFNode = any;
type RFEdge = any;
type GraphLayout = Record<string, { x: number; y: number; layer?: string; parent?: string; type?: 'group' | 'node' }>;

function getNodeNumericSize(n: RFNode): { width: number; height: number } {
    const w = typeof n?.style?.width === 'string'
        ? parseFloat(n.style.width)
        : (typeof n?.style?.width === 'number' ? n.style.width : undefined);
    const h = typeof n?.style?.height === 'string'
        ? parseFloat(n.style.height)
        : (typeof n?.style?.height === 'number' ? n.style.height : undefined);
    return {
        width: w ?? CFG.NODE_DEFAULT_SIZE.width,
        height: h ?? CFG.NODE_DEFAULT_SIZE.height,
    };
}

function getNodeLayerName(n: RFNode): string {
    if (n?.data?.layer) return n.data.layer;
    if (typeof n?.parentNode === 'string' && n.parentNode.startsWith('group-')) return n.parentNode.replace(/^group-/, '');
    if (n?.data?.label) return String(n.data.label);
    return 'base';
}

function groupByLayer(cards: Card[]): Map<string, Card[]> {
    const grouped = new Map<string, Card[]>();
    for (const c of cards || []) {
        const layer = c.layer || 'base';
        if (!grouped.has(layer)) grouped.set(layer, []);
        grouped.get(layer)!.push(c);
    }
    return grouped;
}

function computeLayerBounds(
    cards: Card[],
    positions: Record<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>
) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cards) {
        const sz = sizes.get(c.name)!;
        const pos = positions[c.name]!;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + sz.width);
        maxY = Math.max(maxY, pos.y + sz.height);
    }
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    return { minX, minY, width, height };
}

function buildPortsFor(cardName: string, edges: RFEdge[]): Ports {
    const inputs = edges.filter((e: RFEdge) => e.target === cardName).map((e: RFEdge) => e.source);
    const outputs = edges.filter((e: RFEdge) => e.source === cardName).map((e: RFEdge) => e.target);
    return { inputs, outputs };
}

function buildEdgesFromCards(cards: Card[]): RFEdge[] {
    const nodeIds = new Set(cards.map((c) => c.name));
    const edges: RFEdge[] = [];
    const duplicateCounter = new Map<string, number>();
    const seenOutIdx = new Map<string, number>();
    const seenInIdx = new Map<string, number>();

    for (const card of cards) {
        const baseLinks = Array.isArray(card.links) ? card.links : [];
        const links = [...baseLinks]; // no mutar card.links

        const regex = /executeAction\(\s*\{\s*name:\s*["']([\w-]+)["']/g;
        let match;
        while ((match = regex.exec(card.rulesCode ?? '')) !== null) {
            const targetName = match[1];
            if (targetName && nodeIds.has(targetName)) {
                links.push({ name: targetName, type: 'code' });
            }
        }

        for (const link of links) {
            const targetName = link?.name;
            if (!targetName || !nodeIds.has(targetName)) continue;
            const baseKey = `${card.name}->${targetName}`;
            const dup = duplicateCounter.get(baseKey) ?? 0;
            duplicateCounter.set(baseKey, dup + 1);
            const edgeId = dup === 0 ? baseKey : `${baseKey}#${dup}`;
            const outIdx = seenOutIdx.get(card.name) ?? 0;
            const inIdx = seenInIdx.get(targetName) ?? 0;
            seenOutIdx.set(card.name, outIdx + 1);
            seenInIdx.set(targetName, inIdx + 1);

            edges.push({
                id: edgeId,
                source: card.name,
                target: targetName,
                sourceHandle: `output-${outIdx}`,
                targetHandle: `input-${inIdx}`,
                type: 'curvy',
                data: { linkType: link.type || 'pre' },
                style: {
                    stroke: link.type === 'pre' ? 'var(--edgePre, var(--color9))'
                        : link.type === 'post' ? 'var(--edgePost, var(--color9))'
                            : 'var(--edgeDefault, var(--color5))',
                    strokeWidth: 2,
                },
            });
        }
    }
    return edges;
}

const DefaultNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
    const inCount = data?.ports?.inputs?.length ?? 0;
    const outCount = data?.ports?.outputs?.length ?? 0;
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                display: 'flex',
                backgroundColor: 'var(--bgPanel)',
                textAlign: 'left',
                alignItems: 'flex-start',
                color: 'var(--color)',
                position: 'relative',
                zIndex: 2,
                border: selected ? '2px solid var(--color9)' : '1px solid var(--gray6)',
                boxShadow: selected ? '0 0 0 4px rgba(0,0,0,0.05)' : '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'border 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
            }}
        >
            {data.content}
            {data?.ports?.inputs?.map((port: string, index: number) => (
                <Handle
                    key={`in-${port}-${index}`}
                    id={`input-${index}`}
                    type="target"
                    position={Position.Left}
                    style={{ top: `${((index + 1) * 100) / (inCount + 1)}%` }}
                />
            ))}
            {data?.ports?.outputs?.map((port: string, index: number) => (
                <Handle
                    key={`out-${port}-${index}`}
                    id={`output-${index}`}
                    type="source"
                    position={Position.Right}
                    style={{ top: `${((index + 1) * 100) / (outCount + 1)}%` }}
                />
            ))}
        </div>
    );
});

const CurvyEdge = (props: any) => {
    const [edgePath] = getBezierPath({ ...props, curvature: 0.4 }); // curva más orgánica
    return (
        <path
            id={props.id}
            className="react-flow__edge-path"
            d={edgePath}
            style={{
                stroke: props.style?.stroke || 'var(--edgeDefault, var(--color5))',
                strokeWidth: 5,
                fill: 'none',
                pointerEvents: 'none',   // 👈 no intercepta clics
                mixBlendMode: 'multiply' // opcional: mezcla estética
            }}
            markerEnd={props.markerEnd}
        />
    );
};

const edgeTypes = { curvy: CurvyEdge };

const LayerGroupNode = memo(({ data }: { data: any }) => (
    <div
        style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            borderRadius: 12,
            background: CFG.GROUP_BG,
            border: data?.isActiveLayer ? '3px solid var(--gray8)' : CFG.GROUP_BORDER,
            position: 'relative',
            zIndex: 0,
            transition: 'none',
            boxShadow: data?.isActiveLayer ? '0 0 0 3px var(--gray8)' : 'none',
        }}
    >
        <div
            style={{
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
                alignItems: 'center',
                cursor: 'grab',
                pointerEvents: 'auto',
            }}
            className="layer-group-header"
        >
            {data?.label}
        </div>
    </div>
));

const nodeTypes = { default: DefaultNode, layerGroup: LayerGroupNode };

/* ==== helpers mínimos para URL <-> viewport ==== */
function readViewportFromURL() {
    try {
        const sp = new URLSearchParams(window.location.search);
        // ✅ Solo consideramos la URL válida si están presentes las 3 claves
        if (!(sp.has('x') && sp.has('y') && sp.has('zoom'))) return null;
        const xStr = sp.get('x'); const yStr = sp.get('y'); const zoomStr = sp.get('zoom');
        if (xStr == null || yStr == null || zoomStr == null) return null;
        const x = Number(xStr); const y = Number(yStr); const zoom = Number(zoomStr);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
        return { x, y, zoom };
    } catch { /* noop */ }
    return null;
}

function writeViewportToURL(vp: { x: number; y: number; zoom: number }) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('x', (Math.round(vp.x * 100) / 100).toString());
        url.searchParams.set('y', (Math.round(vp.y * 100) / 100).toString());
        url.searchParams.set('zoom', (Math.round(vp.zoom * 1000) / 1000).toString());
        window.history.replaceState({}, '', url.toString());
    } catch { /* noop */ }
}

function normalizeGroupNodes(nds: RFNode[]) {
    const next = nds.map((n) => ({ ...n, style: { ...(n.style || {}) } }));
    const groups = next.filter((n) => n.type === 'layerGroup');
    if (!groups.length) return next;

    for (const g of groups) {
        const children = next.filter((n) => n.parentNode === g.id);
        if (!children.length) continue;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of children) {
            const { width, height } = getNodeNumericSize(c);
            minX = Math.min(minX, c.position.x);
            minY = Math.min(minY, c.position.y);
            maxX = Math.max(maxX, c.position.x + width);
            maxY = Math.max(maxY, c.position.y + height);
        }

        const targetTop = CFG.GROUP_PADDING + CFG.GROUP_HEADER_HEIGHT;
        const shiftX = minX - CFG.GROUP_PADDING;
        const shiftY = minY - targetTop;
        if (shiftX !== 0 || shiftY !== 0) {
            g.position = {
                x: (g.position?.x || 0) + shiftX,
                y: (g.position?.y || 0) + shiftY,
            };
            for (const c of children) {
                c.position = { x: c.position.x - shiftX, y: c.position.y - shiftY };
            }
            maxX -= shiftX; maxY -= shiftY;
            minX = CFG.GROUP_PADDING; minY = targetTop;
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        g.style.width = contentW + CFG.GROUP_PADDING * 2 + CFG.RIGHT_MARGIN_EXTRA;
        g.style.height = contentH + CFG.GROUP_HEADER_HEIGHT + CFG.GROUP_PADDING * 2 + CFG.GROUP_EXTRA_BOTTOM;
    }
    return next;
}

const Flow = ({
    initialNodes,
    initialEdges,
    initialLayout = null,
    onLayoutChange,
    activeLayer,
    onSelectLayer,
    onDeleteNodes,
}: {
    initialNodes: RFNode[];
    initialEdges: RFEdge[];
    initialLayout?: GraphLayout;
    onLayoutChange?: (layout: GraphLayout) => void;
    activeLayer?: string;
    onSelectLayer?: (layer: string) => void;
    onDeleteNodes?: (ids: string[]) => void;
}) => {
    const normalizedInitial = useMemo(() => normalizeGroupNodes(initialNodes), [initialNodes]);
    const layoutRef = useRef<GraphLayout | undefined | null>(initialLayout);

    const applyActiveLayerStyle = useCallback((nds: RFNode[]) => {
        return nds.map((n) => {
            const layerName = getNodeLayerName(n);
            const isActive = !activeLayer || layerName === activeLayer;
            const baseStyle = n.style || {};
            const nextStyle = n.type === 'layerGroup'
                ? {
                    ...baseStyle,
                    opacity: isActive ? 1 : 0.9,
                    transition: 'opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                }
                : baseStyle;
            return {
                ...n,
                data: { ...n.data, layer: layerName, isActiveLayer: n.type === 'layerGroup' ? isActive : n.data?.isActiveLayer },
                style: nextStyle,
            };
        });
    }, [activeLayer]);

    const decoratedInitial = useMemo(() => applyActiveLayerStyle(normalizedInitial), [normalizedInitial, applyActiveLayerStyle]);
    const [nodes, setNodes] = useNodesState(decoratedInitial);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const { resolvedTheme } = useThemeSetting()
    const darkMode = resolvedTheme == 'dark'

    const nodesMap = useMemo(() => new Map(nodes.map((n: RFNode) => [n.id, n])), [nodes]);
    const graphBounds = nodes.reduce((b, n) => {
        const { width, height } = getNodeNumericSize(n);
        const parent = n.parentNode ? nodesMap.get(n.parentNode) : null;
        const absX = (parent?.position?.x || 0) + n.position.x;
        const absY = (parent?.position?.y || 0) + n.position.y;
        b.minX = Math.min(b.minX, absX);
        b.minY = Math.min(b.minY, absY);
        b.maxX = Math.max(b.maxX, absX + width);
        b.maxY = Math.max(b.maxY, absY + height);
        return b;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const hasNodes = Number.isFinite(graphBounds.minX) && Number.isFinite(graphBounds.maxX);
    const graphCenterX = hasNodes ? (graphBounds.minX + graphBounds.maxX) / 2 : 0;
    const graphCenterY = hasNodes ? (graphBounds.minY + graphBounds.maxY) / 2 : 0;
    const zoom = CFG.VIEWPORT.zoom;

    // ✅ Si hay x,y,zoom en la URL, los usamos; si no, centramos como en tu versión que funciona
    const urlViewport = typeof window !== 'undefined' ? readViewportFromURL() : null;
    const initialX = (window.innerWidth / 2) - graphCenterX * zoom;
    const initialY = (window.innerHeight / 2) - graphCenterY * zoom;
    const defaultViewport = urlViewport ?? {
        x: initialX + CFG.VIEWPORT.x,
        y: initialY + CFG.VIEWPORT.y,
        zoom,
    };

    const isSameLayout = useCallback((a?: GraphLayout, b?: GraphLayout) => {
        if (a === b) return true;
        if (!a || !b) return false;
        const aKeys = Object.keys(a); const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (const k of aKeys) {
            const av = a[k]; const bv = b[k];
            if (!bv) return false;
            if (av.x !== bv.x || av.y !== bv.y || av.layer !== bv.layer || av.parent !== bv.parent || av.type !== bv.type) return false;
        }
        return true;
    }, []);


    const exportLayout = useCallback((nds: RFNode[]): GraphLayout => {
        const layout: GraphLayout = {};
        for (const n of nds) {
            const layerName = getNodeLayerName(n);
            layout[n.id] = {
                x: n.position.x,
                y: n.position.y,
                layer: layerName,
                parent: n.parentNode,
                type: n.type === 'layerGroup' ? 'group' : 'node',
            };
        }
        return layout;
    }, []);


    const onNodesChange = useCallback((changes) => {
        const removedIds = changes.filter((c: any) => c.type === 'remove').map((c: any) => c.id);
        if (removedIds.length) {
            setEdges((eds) => eds.filter((e: RFEdge) =>
                !removedIds.includes(e.source) && !removedIds.includes(e.target)
            ));
        }

        const shouldPersistPosition = changes.some((c: any) => c.type === 'position' && c.dragging === false);
        const shouldPersistRemoval = removedIds.length > 0;

        setNodes((nds) => {
            const next = applyActiveLayerStyle(normalizeGroupNodes(applyNodeChanges(changes, nds)));

            if (removedIds.length && onDeleteNodes) {
                const deletable = removedIds.filter((id) => {
                    const node = nds.find((n) => n.id === id);
                    return node && node.type !== 'layerGroup';
                });
                if (deletable.length) onDeleteNodes(deletable);
            }

            if ((shouldPersistPosition || shouldPersistRemoval) && onLayoutChange) {
                const exported = exportLayout(next);
                if (!isSameLayout(exported, layoutRef?.current)) {
                    layoutRef.current = exported;
                    onLayoutChange(exported);
                }
            }
            return next;
        });
    }, [setNodes, onLayoutChange, exportLayout, applyActiveLayerStyle, isSameLayout, onDeleteNodes, setEdges]);

    // Guardamos en la URL cuando terminas pan/zoom
    const handleMoveEnd = useCallback((_e: any, vp: { x: number; y: number; zoom: number }) => {
        writeViewportToURL(vp);
    }, []);

    const handleNodeClick = useCallback((_e: any, node: RFNode) => {
        if (!onSelectLayer) return;
        const layerName = getNodeLayerName(node);
        if (layerName) onSelectLayer(layerName);
    }, [onSelectLayer]);

    useLayoutEffect(() => {
        setNodes((prev) => {
            const sameIds = prev.length === decoratedInitial.length && prev.every((n, i) => n.id === decoratedInitial[i].id);
            if (sameIds) {
                return applyActiveLayerStyle(prev);
            }
            return decoratedInitial;
        });
    }, [decoratedInitial, setNodes, applyActiveLayerStyle]);

    useEffect(() => {
        layoutRef.current = initialLayout;
    }, [initialLayout]);

    useEffect(() => {
        setEdges((prev) => {
            const same = prev.length === initialEdges.length && prev.every((e, i) => e.id === initialEdges[i].id);
            return same ? prev : initialEdges;
        });
    }, [initialEdges, setEdges]);

    useEffect(() => {
        if (!onLayoutChange) return;
        const nodeIds = normalizedInitial.map((n) => n.id);
        const missingNode = !initialLayout
            || normalizedInitial.some((n) => !initialLayout[n.id]);
        const hasStale = initialLayout
            ? Object.keys(initialLayout).some((id) => !nodeIds.includes(id))
            : false;
        const nextLayout = exportLayout(normalizedInitial);
        if ((missingNode || hasStale) && !isSameLayout(nextLayout, layoutRef.current)) {
            layoutRef.current = nextLayout;
            onLayoutChange(nextLayout);
        }
    }, [normalizedInitial, onLayoutChange, initialLayout, exportLayout, isSameLayout]);

    return (
        <Tinted>
            <ReactFlow
                edgeTypes={edgeTypes}
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onMoveEnd={handleMoveEnd}
                fitViewOptions={{ padding: CFG.FITVIEW_PADDING }}
                defaultViewport={defaultViewport}
                minZoom={0.03}
                maxZoom={2}
                selectionOnDrag
                selectNodesOnDrag
                // selectionKeyCode="Shift"
                multiSelectionKeyCode={['Meta', 'Control']}
                nodesDraggable
                nodesConnectable
                elementsSelectable
                onNodeClick={handleNodeClick}
                zoomOnScroll
                zoomOnPinch
                panOnDrag
                proOptions={{ hideAttribution: true }}
                elevateEdgesOnSelect={false}   // 👈 edges nunca suben por encima
                elevateNodesOnSelect            // 👈 nodos sí pueden elevarse al seleccionar
                style={{ zIndex: 0 }}
                translateExtent={[
                    [-25000, -25000],           // esquina superior izquierda permitida
                    [25000, 25000],     // esquina inferior derecha permitida
                ]}
            >
                <style>{`
    .react-flow__node {
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
    }
  `}</style>
                <Background gap={20} />
                <MiniMap
                    position="bottom-left"
                    // zoomable
                    // pannable
                    maskColor={"rgba(0,0,0,0." + (darkMode ? "4" : "05") + ")"}
                    nodeStrokeColor={(n) => n.style?.borderColor || 'black'}
                    nodeColor={(n) => n.type != 'layerGroup' ? 'var(--bgPanel)' : 'var(--bgContent)'}
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',  // 👈 elimina el fondo blanco
                    }}
                />
            </ReactFlow>
        </Tinted>
    );
};

function computeLayerLayout(cardsGroup: Card[], edges: RFEdge[]) {
    const { hPixelRatio, vPixelRatio, marginX, marginY } = CFG.LAYOUT;
    return computeDirectedLayout({
        cards: cardsGroup,
        edges,
        hPixelRatio,
        vPixelRatio,
        marginX,
        marginY,
    }) as {
        positions: Record<string, { x: number; y: number }>;
        sizes: Map<string, { width: number; height: number }>;
    };
}

function createGroupNode(
    layerName: string,
    layerWidth: number,
    layerHeight: number,
    yOffset: number,
    savedLayout?: GraphLayout
): RFNode {
    const groupWidth = layerWidth + CFG.GROUP_PADDING * 2 + CFG.RIGHT_MARGIN_EXTRA;
    const groupHeight = layerHeight + CFG.GROUP_HEADER_HEIGHT + CFG.GROUP_PADDING * 2 + CFG.GROUP_EXTRA_BOTTOM;
    const saved = savedLayout?.[`group-${layerName}`];
    const hasSaved = !!saved;
    return {
        id: `group-${layerName}`,
        type: 'layerGroup',
        position: hasSaved ? { x: saved!.x, y: saved!.y } : { x: 0, y: yOffset },
        data: { label: layerName, layer: layerName },
        style: { width: groupWidth, height: groupHeight },
        draggable: true,
        dragHandle: '.layer-group-header',
        selectable: true,
    };
}

function materializeNodesInGroup(
    cardsGroup: Card[],
    positions: Record<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>,
    groupId: string,
    minX: number,
    minY: number,
    edges: RFEdge[],
    savedLayout?: GraphLayout,
    layerName?: string,
): RFNode[] {
    const savedBounds = cardsGroup.reduce((b, c) => {
        const saved = savedLayout?.[c.name];
        if (!saved || (saved.layer && layerName && saved.layer !== layerName)) return b;
        const sz = sizes.get(c.name)!;
        b.minX = Math.min(b.minX, saved.x);
        b.minY = Math.min(b.minY, saved.y);
        b.maxX = Math.max(b.maxX, saved.x + sz.width);
        b.maxY = Math.max(b.maxY, saved.y + sz.height);
        return b;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const hasSaved = Number.isFinite(savedBounds.minX);
    const rightmostX = hasSaved ? savedBounds.maxX : null;

    return cardsGroup.map((c) => {
        const sz = sizes.get(c.name)!;
        const pos = positions[c.name]!;
        const ports = buildPortsFor(c.name, edges);
        const saved = savedLayout?.[c.name];
        const savedValid = saved && (!saved.layer || !layerName || saved.layer === layerName);
        const fallbackX = savedValid ? saved.x
            : rightmostX != null
                ? rightmostX + CFG.LAYOUT.marginX * 0.6
                : (pos.x - minX) + CFG.GROUP_PADDING;
        const fallbackY = (pos.y - minY) + GROUP_PAD_TOP;
        return {
            id: c.name,
            type: 'default',
            parentNode: groupId,
            position: {
                x: fallbackX,
                y: savedValid ? saved.y : fallbackY,
            },
            data: { ...c, ports },
            style: {
                width: `${sz.width}px`,
                height: `${sz.height}px`,
                background: 'transparent',
            },
        };
    });
}

function materializeNodesFlat(
    cardsGroup: Card[],
    positions: Record<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>,
    yOffset: number,
    edges: RFEdge[],
    savedLayout?: GraphLayout,
    layerName?: string,
): RFNode[] {
    const savedBounds = cardsGroup.reduce((b, c) => {
        const saved = savedLayout?.[c.name];
        if (!saved || (saved.layer && layerName && saved.layer !== layerName)) return b;
        const sz = sizes.get(c.name)!;
        b.minX = Math.min(b.minX, saved.x);
        b.minY = Math.min(b.minY, saved.y);
        b.maxX = Math.max(b.maxX, saved.x + sz.width);
        b.maxY = Math.max(b.maxY, saved.y + sz.height);
        return b;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const hasSaved = Number.isFinite(savedBounds.minX);
    const rightmostX = hasSaved ? savedBounds.maxX : null;

    return cardsGroup.map((c) => {
        const sz = sizes.get(c.name)!;
        const pos = positions[c.name]!;
        const ports = buildPortsFor(c.name, edges);
        const saved = savedLayout?.[c.name];
        const savedValid = saved && (!saved.layer || !layerName || saved.layer === layerName);
        return {
            id: c.name,
            type: 'default',
            position: savedValid
                ? { x: saved.x, y: saved.y }
                : {
                    x: rightmostX != null ? rightmostX + CFG.LAYOUT.marginX * 0.6 : pos.x,
                    y: pos.y + yOffset,
                },
            data: { ...c, ports },
            style: {
                width: `${sz.width}px`,
                height: `${sz.height}px`,
                background: 'transparent'
            },
        };
    });
}

function materializeLayerNodes(
    layerName: string,
    cardsGroup: Card[],
    edges: RFEdge[],
    yOffsetLayer: number,
    savedLayout?: GraphLayout
): { groupNode?: RFNode; contentNodes: RFNode[]; yIncrement: number } {
    const { positions, sizes } = computeLayerLayout(cardsGroup, edges);
    const { minX, minY, width: layerWidth, height: layerHeight } = computeLayerBounds(cardsGroup, positions, sizes);
    const isBaseLayerFlat = !CFG.BASE_LAYER_IN_GROUP && layerName === 'base';
    if (isBaseLayerFlat) {
        const contentNodes = materializeNodesFlat(cardsGroup, positions, sizes, yOffsetLayer, edges, savedLayout, layerName);
        const yIncrement = layerHeight + CFG.LAYER_VERTICAL_GAP;
        return { contentNodes, yIncrement };
    }
    const groupNode = createGroupNode(layerName, layerWidth, layerHeight, yOffsetLayer, savedLayout);
    const contentNodes = materializeNodesInGroup(
        cardsGroup,
        positions,
        sizes,
        groupNode.id,
        minX,
        minY,
        edges,
        savedLayout,
        layerName
    );
    const yIncrement = groupNode.style.height + CFG.LAYER_VERTICAL_GAP;
    return { groupNode, contentNodes, yIncrement };
}

export const GraphView = ({
    cards,
    layout,
    onLayoutChange,
    activeLayer,
    onSelectLayer,
    onDeleteNodes,
}: {
    cards: Card[];
    layout?: GraphLayout;
    onLayoutChange?: (layout: GraphLayout) => void;
    activeLayer?: string;
    onSelectLayer?: (layer: string) => void;
    onDeleteNodes?: (ids: string[]) => void;
}) => {
    const initialEdges = buildEdgesFromCards(cards || []);
    const grouped = groupByLayer(cards || []);
    const groupNodes: RFNode[] = [];
    const contentNodes: RFNode[] = [];
    let yOffsetLayer = 0;
    for (const [layerName, cardsGroup] of grouped.entries()) {
        const { groupNode, contentNodes: nodesForLayer, yIncrement } =
            materializeLayerNodes(layerName, cardsGroup, initialEdges, yOffsetLayer, layout);
        if (groupNode) groupNodes.push(groupNode);
        contentNodes.push(...nodesForLayer);
        yOffsetLayer += yIncrement;
    }
    const initialNodes = [...groupNodes, ...contentNodes];
    return (
        <Flow
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            initialLayout={layout}
            onLayoutChange={onLayoutChange}
            activeLayer={activeLayer}
            onSelectLayer={onSelectLayer}
            onDeleteNodes={onDeleteNodes}
        />
    );
};
