/* ========== Directed Layout “orgánico” (Sugiyama + cruces mínimos + suavizado) ========== */

/** Mediana numérica (para baricentros) */
const median = (arr: number[]) => {
  if (!arr?.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Eliminación heurística de ciclos (Eades): genera un orden lineal y separa edges forward/back */
function greedyCycleRemoval(
  nodeIds: string[],
  edges: { source: string; target: string; data?: any }[],
  nodeSet: Set<string>,
  priority?: Map<string, number> // usa graphOrder si se pasa
) {
  // construimos in/out degree y adyacencias
  const inDeg = new Map(nodeIds.map((id) => [id, 0]));
  const outDeg = new Map(nodeIds.map((id) => [id, 0]));
  const adj = new Map(nodeIds.map((id) => [id, new Set<string>()]));
  const radj = new Map(nodeIds.map((id) => [id, new Set<string>()]));

  for (const e of edges) {
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue; // ahora incluye 'code'
    adj.get(e.source)!.add(e.target);
    radj.get(e.target)!.add(e.source);
    outDeg.set(e.source, (outDeg.get(e.source) || 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  }

  const S = new Set(nodeIds);
  const L: string[] = [];
  const R: string[] = [];

  const remove = (v: string) => {
    S.delete(v);
    for (const t of adj.get(v)!) {
      inDeg.set(t, (inDeg.get(t) || 0) - 1);
      radj.get(t)!.delete(v);
    }
    for (const s of radj.get(v)!) {
      outDeg.set(s, (outDeg.get(s) || 0) - 1);
      adj.get(s)!.delete(v);
    }
  };

  while (S.size) {
    let progress = false;

    // sumideros => a la derecha
    const sinks = [...S].filter((v) => (outDeg.get(v) || 0) === 0);
    if (sinks.length) {
      sinks.sort((a, b) => {
        const pa = priority?.get(a) ?? 0;
        const pb = priority?.get(b) ?? 0;
        if (pa !== pb) return pa - pb;
        const da = (outDeg.get(a) || 0) - (inDeg.get(a) || 0);
        const db = (outDeg.get(b) || 0) - (inDeg.get(b) || 0);
        return da - db || (a < b ? -1 : a > b ? 1 : 0);
      });
      for (const v of sinks) {
        remove(v);
        R.push(v);
      }
      progress = true;
    }

    // fuentes => a la izquierda
    const sources = [...S].filter((v) => (inDeg.get(v) || 0) === 0);
    if (sources.length) {
      sources.sort((a, b) => {
        const pa = priority?.get(a) ?? 0;
        const pb = priority?.get(b) ?? 0;
        if (pa !== pb) return pb - pa;
        const da = (outDeg.get(a) || 0) - (inDeg.get(a) || 0);
        const db = (outDeg.get(b) || 0) - (inDeg.get(b) || 0);
        return db - da || (a < b ? -1 : a > b ? 1 : 0);
      });
      for (const v of sources) {
        remove(v);
        L.push(v);
      }
      progress = true;
    }

    if (progress) continue;

    // ciclo puro => elige el de mayor prioridad
    let best: string | null = null;
    let bestPriority = -Infinity;
    let bestDelta = -Infinity;
    for (const v of S) {
      const p = priority?.get(v) ?? 0;
      const delta = (outDeg.get(v) || 0) - (inDeg.get(v) || 0);
      if (p > bestPriority || (p === bestPriority && delta > bestDelta)) {
        bestPriority = p;
        bestDelta = delta;
        best = v;
      }
    }
    if (best != null) {
      remove(best);
      L.push(best);
    }
  }

  const order = L.concat(R.reverse());
  const index = new Map(order.map((id, i) => [id, i]));

  const forward: typeof edges = [];
  const back: typeof edges = [];
  for (const e of edges) {
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue; // ahora incluye 'code'
    const iu = index.get(e.source)!;
    const iv = index.get(e.target)!;
    if (iu <= iv) forward.push(e);
    else back.push(e);
  }

  return { order, index, forward, back };
}

/** Reordenación por baricentro en varias pasadas (minimiza cruces) */
function minimizeCrossings(
  layers: string[][],
  preds: Map<string, string[]>,
  succs: Map<string, string[]>,
  baseOrder: Map<string, number>,
  sweeps = 8
) {
  for (let it = 0; it < sweeps; it++) {
    const topDown = it % 2 === 0;
    const ref = topDown ? preds : succs;

    for (let col = topDown ? 1 : layers.length - 2; topDown ? col < layers.length : col >= 0; topDown ? col++ : col--) {
      const neighborPos = new Map((topDown ? layers[col - 1] : layers[col + 1]).map((id, i) => [id, i]));
      const scored = layers[col].map((id) => {
        const neigh = (ref.get(id) || []).filter((p) => neighborPos.has(p)).map((p) => neighborPos.get(p)!);
        const score = neigh.length ? median(neigh) : (baseOrder.get(id) ?? 0);
        return { id, score, has: neigh.length > 0 };
      });
      scored.sort((a, b) =>
        a.has !== b.has ? (a.has ? -1 : 1)
          : a.score !== b.score ? a.score - b.score
            : (baseOrder.get(a.id)! - baseOrder.get(b.id)!)
      );
      layers[col] = scored.map((s) => s.id);
    }
  }
}

/** Asigna Y con alineación por la parte superior (no centrado) */
function assignYPositions(
  layers: string[][],
  preds: Map<string, string[]>,
  succs: Map<string, string[]>,
  sizes: Map<string, { width: number; height: number }>,
  marginY: number
) {
  const y = new Map<string, number>();
  const DEFAULT_HEIGHT = 300; // fallback height

  // Paso 1: apila desde arriba (alineación top)
  for (let col = 0; col < layers.length; col++) {
    const ids = layers[col];
    let yOffset = 0;
    for (const id of ids) {
      y.set(id, yOffset);
      const nodeSize = sizes.get(id);
      const nodeHeight = nodeSize?.height ?? DEFAULT_HEIGHT;
      yOffset += nodeHeight + marginY;
    }
  }

  // Paso 2: ligera relajación para suavizar saltos (solo para nodos con conexiones)
  const relaxIters = 2;
  for (let it = 0; it < relaxIters; it++) {
    for (let col = 1; col < layers.length; col++) {
      for (const id of layers[col]) {
        const predsY = (preds.get(id) || []).filter((p) => y.has(p)).map((p) => y.get(p)!);
        if (!predsY.length) continue;
        const avgPredY = predsY.reduce((a, b) => a + b, 0) / predsY.length;
        const current = y.get(id) ?? 0;
        y.set(id, current * 0.8 + avgPredY * 0.2);
      }
    }
  }

  return y;
}

/* =========================================================================================
 * INTERFAZ COMPATIBLE
 * ========================================================================================= */
export const computeDirectedLayout = ({
  cards,
  edges,
  hPixelRatio,
  vPixelRatio,
  marginX = 120,
  marginY = 60,
}: {
  cards: { name: string; width?: number; height?: number; graphOrder?: number }[];
  edges: { source: string; target: string; data?: any }[];
  hPixelRatio: number;
  vPixelRatio: number;
  marginX?: number;
  marginY?: number;
}) => {
  const nodes = (cards || []).filter((c) => c?.name);
  const nodeIds = nodes.map((c) => c.name);
  const nodeSet = new Set(nodeIds);

  // prioridad por graphOrder
  const priority = new Map<string, number>(nodes.map((n) => [n.name, n.graphOrder ?? 0]));

  // Tamaños
  const sizeById = new Map<string, { width: number; height: number }>(
    nodes.map((c) => [
      c.name,
      {
        width: (c.width ?? 2) * hPixelRatio,
        height: (c.height ?? 7) * vPixelRatio,
      },
    ])
  );

  // Edges válidos (incluye 'code')
  const validEdges = (edges || []).filter(
    (e) => nodeSet.has(e.source) && nodeSet.has(e.target)
  );

  // 1) Rompe ciclos con prioridad por graphOrder
  const { order, forward } = greedyCycleRemoval(nodeIds, validEdges, nodeSet, priority);

  // 2) Asigna niveles (longest-path)
  const preds = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  const succs = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const e of forward) {
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }

  const level = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const id of order) {
    const p = preds.get(id)!;
    if (!p.length) level.set(id, 0);
    else level.set(id, Math.max(...p.map((u) => (level.get(u) ?? 0) + 1)));
  }

  // 3) Capas horizontales
  const maxLevel = Math.max(0, ...level.values());
  const layers: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const id of nodeIds) layers[level.get(id)!].push(id);

  // 3b) Nodos aislados → agrupar en filas (grid layout)
  const degree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const e of validEdges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  const isolated = nodeIds.filter((id) => (degree.get(id) || 0) === 0);
  if (isolated.length) {
    // Quitar nodos aislados de sus capas originales
    for (const id of isolated) {
      const lv = level.get(id)!;
      const col = layers[lv];
      const k = col.indexOf(id);
      if (k >= 0) col.splice(k, 1);
    }
    // Limpiar capas vacías
    for (let i = layers.length - 1; i >= 0; i--) {
      if (!layers[i].length) layers.splice(i, 1);
    }
    // Ordenar nodos aislados por graphOrder
    isolated.sort((a, b) => (priority.get(a) ?? Infinity) - (priority.get(b) ?? Infinity));
    // Agrupar en filas de máximo 6 nodos (horizontal) - cada columna tendrá nodos apilados verticalmente
    const NODES_PER_ROW = 6;
    const numRows = Math.ceil(isolated.length / NODES_PER_ROW);
    // Crear columnas (distribuir nodos en un grid: columnas = X, filas dentro de columna = Y)
    for (let col = 0; col < NODES_PER_ROW; col++) {
      const columnNodes: string[] = [];
      for (let row = 0; row < numRows; row++) {
        const idx = row * NODES_PER_ROW + col;
        if (idx < isolated.length) {
          columnNodes.push(isolated[idx]);
        }
      }
      if (columnNodes.length) {
        layers.push(columnNodes);
        for (const id of columnNodes) {
          level.set(id, layers.length - 1);
        }
      }
    }
  }

  // 4) Minimiza cruces (prioridad como baseOrder)
  const baseOrder = new Map<string, number>(
    [...nodeIds]
      .sort((a, b) => (priority.get(b) ?? 0) - (priority.get(a) ?? 0))
      .map((id, i) => [id, i])
  );
  minimizeCrossings(layers, preds, succs, baseOrder, 8);

  // 4b) Reordena cada capa: mayor graphOrder primero
  for (const layer of layers) {
    layer.sort((a, b) => (priority.get(b) ?? 0) - (priority.get(a) ?? 0));
  }

  // 5) Posiciones Y (alineadas por arriba)
  const yMap = assignYPositions(layers, preds, succs, sizeById, marginY);

  // 6) Posiciones X por columna
  const nodeX = new Map<string, number>();
  const DEFAULT_WIDTH = 400;
  let xOffset = 0;
  for (const ids of layers) {
    let maxW = 0;
    for (const id of ids) {
      nodeX.set(id, xOffset);
      const nodeSize = sizeById.get(id);
      const nodeWidth = nodeSize?.width ?? DEFAULT_WIDTH;
      maxW = Math.max(maxW, nodeWidth);
    }
    xOffset += maxW + marginX;
  }

  // 7) Salida - asegurar que todos los nodos tengan posición válida
  const positions: Record<string, { x: number; y: number }> = {};
  for (const id of nodeIds) {
    const x = nodeX.get(id);
    const y = yMap.get(id);
    // Si un nodo no tiene posición asignada (no estaba en layers), asignar una posición de fallback
    if (x === undefined || y === undefined) {
      // Encontrar la última posición X usada y agregar el nodo ahí
      const fallbackX = xOffset;
      const fallbackY = Object.keys(positions).length * (DEFAULT_WIDTH / 2 + marginY);
      positions[id] = { x: fallbackX, y: fallbackY };
      xOffset += DEFAULT_WIDTH + marginX;
    } else {
      positions[id] = { x, y };
    }
  }

  return { positions, sizes: sizeById };
};
