import { NodeTypes } from './../../nodes';

const getChildren = (nodes, edges, node) => {   
    const children = nodes
                    .filter(n => edges.find(e => e.source == n.id && e.target == node.id))
                    .map((n) => {
                        return {
                            node: n,
                            edge: edges.find(e => e.source == n.id && e.target == node.id)
                        }
                    })
    return children
}

const defaultSpacingFactorX = 1//3.5
const defaultSpacingFactorY = 1//5

const marginX = 120 //1000
const marginY = 100 // 500

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const computeLayout = (nodes, edges, node, pos={x:0, y: 0}, metadata={}, tracker={x:0}) => {
    const children = getChildren(nodes, edges, node)
    const flowNode = NodeTypes[node.type]

    node.position =  {
        x: pos.x,
        y: pos.y
    }

    node.data = {
        ...node.data,
        layouted: true
    }

    if (flowNode) {
        const flowNodeType = flowNode.type ?? flowNode
        if(flowNodeType && flowNodeType.getPosition) {
            pos = flowNodeType.getPosition(pos, node.type)
        }
    }

    const originalPosY = pos.y
    const originalPosX = pos.x

    let nodeWidth = node.measured?.width ?? node.width
    if (flowNode) {
        const flowNodeType = flowNode.type ?? flowNode
        if(flowNodeType && flowNodeType.getWidth) {
            nodeWidth = flowNodeType.getWidth(node)
        }
    }
    
    let spacingFactorX = defaultSpacingFactorX
    let spacingFactorY = defaultSpacingFactorY
    if (flowNode) {
        const flowNodeType = flowNode.type ?? flowNode
        if(flowNodeType && flowNodeType.getSpacingFactor) {
            const { factorX, factorY } = flowNodeType.getSpacingFactor(node)
            spacingFactorX = factorX
            spacingFactorY = factorY
        }
    }


    const deltaX = nodeWidth + (marginX*spacingFactorX)
    pos.x += deltaX

    const childHeights = []
    let prevPos
    let childTracker
    let maxTracker = 0

    children.forEach(async (c) => {
        if (flowNode) {
            const flowNodeType = flowNode.type ?? flowNode
            if(flowNodeType && flowNodeType.getChildPosition) {
                pos = flowNodeType.getChildPosition(node, pos, {x: originalPosX, y: originalPosY}, c, node.type)
            }
        }

        prevPos = {...pos}
        childTracker = {x:0}
        computeLayout(nodes, edges, c.node, pos, metadata, childTracker)

        childHeights.push({
            pos: {...prevPos}, 
            delta: {x: prevPos.x-node.position.x, y: prevPos.y - originalPosY}, 
            width: childTracker.x - tracker.x, 
            height: pos.y - originalPosY, 
            node: c
        })

        if(childTracker.x > maxTracker) maxTracker = childTracker.x
    })

    tracker.x += deltaX + maxTracker

    metadata[node.id] = {layouted: true, childWidth: tracker.x, childHeight: pos.y - originalPosY, childHeights: childHeights}
    pos.x -= nodeWidth + (marginX*spacingFactorX)
    const nodeHeight = node.measured?.height ?? node.height
    pos.y += pos.y - originalPosY > (nodeHeight+(marginY*spacingFactorY)) ? 0 : (nodeHeight + (marginY*spacingFactorY)) - (pos.y - originalPosY)
    
    return metadata
}

const getLayoutedElements = async (nodes, edges, node) => {
    const layoutedNodes = nodes.map(n => ({
        ...n,
        position: { ...n.position },
        data: { ...n.data }
    }))
    await sleep(1)
    const metadata = computeLayout(layoutedNodes, edges, node)
    await sleep(1)
    return { nodes:layoutedNodes, edges, metadata};
};

export default getLayoutedElements