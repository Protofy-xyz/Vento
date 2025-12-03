import ELK from 'elkjs/lib/elk.bundled.js'

function getParentNode(nodeData){
    var node;
    Object.keys(nodeData).forEach((key)=>{
        if(nodeData[key]._devicePositioning){
            node = {id: key, ...nodeData[key]}
        }
    })
    return node;
}

function getEdgeFromSource(edges,source){
    const out = edges.filter(e=>{
        return e.source == source;
    })
    return out[0];
}

const layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
    'elk.layered.crossingMinimization.forceNodeModelOrder': true,
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.spacing.nodeNodeBetweenLayers': '150',
    'elk.spacing.nodeNode': '100'
}

const toELK = (node, index=0, edges, nodeData) => {
    return {
        layoutOptions: node.children?.length?layoutOptions:{}, 
        id: node.id, 
        width: node.measured?.width ?? node.width, 
        height: node.measured?.height ?? node.height, 
        children: node.children ? node.children.map((c, index) => toELK(c, index, edges, nodeData)) : [] 
    };
}

const getNodePositionReference = (node, nodeData, edges, defaultValue) => {
    var nodePositionReference = defaultValue;
    const parentNode = getParentNode(nodeData)
    let isRoot = node.id == parentNode?.id
    if(!isRoot){
        const edge = getEdgeFromSource(edges,node.id)
        nodePositionReference = parentNode._devicePositioning.filter((positionTag: string|undefined)=>{
            if(positionTag){
                return positionTag.includes(edge?.targetHandle.split('element-')[1])
            }
        })[0]?.split('-')[1]
    }
    return nodePositionReference
}
const getGraph = (direction, nodes, nodeData, edges, total) => {
    const children = nodes.filter(n => getNodePositionReference(n, nodeData, edges, direction) == direction).map(n => toELK(n, 0, edges, nodeData))
    const graph = {
        id: "root",
        layoutOptions: {
            ...layoutOptions,
            'elk.direction': direction == 'l'? 'LEFT':'RIGHT',
        },
        children: children,
        edges: edges.filter(e => children.find(c => c.id == e.source) && children.find(c => c.id == e.target) && total.find(n => n && n.id == e.source) && total.find(n => n && n.id == e.target)).sort((a, b) => {
            const parts1 = a.targetHandle.split('_')
            const parts2 = b.targetHandle.split('_')
            const target1 = parts1[parts1.length - 1]
            const target2 = parts2[parts2.length - 1]
    
            if (target1.startsWith('block') && target2.startsWith('block') && a.target == b.target) {
                const pos1 = parseInt(target1.substr(5), 10)
                const pos2 = parseInt(target2.substr(5), 10)
                return pos1 - pos2
            }
            return 0
        }).map((edge, index) => {
            return { id: edge.id, sources: [edge.source], targets: [edge.target] };
            //check if the edge should also be copied to the VisualGroup
        })
    }
    return graph
}
const getLayoutedElements = async (nodes, edges, node, nodeData) => {
    //create a elk graph
    const elk = new ELK()

    // console.log('before toFlow: ', nodes)

    const flatten = (nodes) => {
        const total = []
        const toFlow = (node, parentNodeId) => {
            // v12: deep clone to avoid mutating frozen objects
            const obj = { 
                ...node, 
                position: node.position ? { ...node.position } : undefined,
                data: {...node.data} 
            }
            delete obj.children
            if (parentNodeId) obj.parentId = parentNodeId  // v12: parentNode renamed to parentId
            total.push(obj)

            if (node.children && node.children.length) {
                const link = edges.find((e) => e.source == node.children[0].id)
                if(link) {
                    const newLink = JSON.parse(JSON.stringify(link))
                    newLink.source = node.id
                    newLink.sourceHandle = node.id + '-output'
                    edges.push(newLink)
                }

                node.children.forEach((childNode) => toFlow(childNode, node.id))
            }
        }

        nodes.forEach((node) => toFlow(node, null))
        return total
    }

    const total = flatten(nodes);

    const graphLeft = getGraph('l', nodes, nodeData, edges, total)
    const graphRight = getGraph('r', nodes, nodeData, edges, total)
    //compute positions and sizes
    try {
        //@ts-ignore
        await elk.layout(graphLeft)
        //@ts-ignore
        await elk.layout(graphRight)
    } catch(e) {
        console.error("Error in layout: ", e)
    }

    var metadata = {}
    const copyPositions = (children, offset, outputPos) => children.forEach(nodeWithPosition => {
        //copy position from graph
        const currentNode = total.find(c => c.id == nodeWithPosition.id)
        if (currentNode) {
            metadata[currentNode.id] = {layouted: true, outputPos: outputPos}

            let x = nodeWithPosition.x-offset
            let y = nodeWithPosition.y

            // console.log('node with position: ', nodeWithPosition)
            currentNode.position = {
                x: currentNode.id == node.id ? 0 : x,
                y: currentNode.id == node.id ? 0 : y
            }

            if (nodeWithPosition.children && nodeWithPosition.children.length) {
                currentNode.data.height = nodeWithPosition.height
                currentNode.data.width = nodeWithPosition.width
            }
        }
        if (nodeWithPosition && nodeWithPosition.children) {
            copyPositions(nodeWithPosition.children, offset, outputPos)
        }
    })

    const offsetRight = graphRight.children.reduce((total, c) => Math.max((c.x + c.width-150), total), 0)

    copyPositions(graphRight.children, offsetRight, 'right');
    copyPositions(graphLeft.children, -150, 'left');


    return { nodes: total, edges, metadata:metadata};
};

export default getLayoutedElements