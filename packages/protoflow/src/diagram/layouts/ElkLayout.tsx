
import ELK from 'elkjs/lib/elk.bundled.js'
import { flowDirection } from '../../toggles';


const layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': flowDirection,
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
    'elk.layered.crossingMinimization.forceNodeModelOrder': true,
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.spacing.nodeNodeBetweenLayers': '350',
    'elk.spacing.nodeNode': '160'
}

const toELK = (node, index=0, edges) => {
    const numConnections = edges.filter((e) => e.target == node.id).length
    const connectionsOffset = Math.max(0, numConnections-1)*40
    const nodeWidth = node.measured?.width ?? node.width
    const nodeHeight = node.measured?.height ?? node.height
    return { 
        layoutOptions: node.children?.length?layoutOptions:{}, 
        id: node.id, 
        width: nodeWidth+connectionsOffset, 
        height: nodeHeight, 
        children: node.children ? node.children.map((c, index) => toELK(c, index, edges)) : [] 
    };
}

const getLayoutedElements = async (nodes, edges, node) => {

    //create a elk graph
    const elk = new ELK()
    const graph = {
        id: "root",
        layoutOptions: {
            ...layoutOptions,
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN'
        },
        children: nodes.map(n => toELK(n, 0, edges)),
        edges: [] as any[]
    }

    // console.log('before toFlow: ', nodes)

    const flatten = (nodes) => {
        const total = []
        const toFlow = (node, graph, parentNodeId) => {
            const obj = { 
                ...node,
                position: node.position ? { ...node.position } : undefined,
                data: { ...node.data }
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

                node.children.forEach((childNode) => toFlow(childNode, graph, node.id))
            }
        }

        nodes.forEach((node) => toFlow(node, graph, null))
        return total
    }

    const total = flatten(nodes);

    //sort edges to avoid crossings
    edges.filter(e => total.find(n => n && n.id == e.source) && total.find(n => n && n.id == e.target)).sort((a, b) => {
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
    }).forEach((edge, index) => {
        graph.edges.push({ id: edge.id, sources: [edge.source], targets: [edge.target] });
        //check if the edge should also be copied to the VisualGroup
    });

    //compute positions and sizes
    //@ts-ignore
    await elk.layout(graph)

    let rootNode = graph.children[0]
    var metadata = {}
    const copyPositions = (children) => children.forEach(nodeWithPosition => {
        //copy position from graph
        const currentNode = total.find(c => c.id == nodeWithPosition.id)
        if (currentNode) {
            metadata[currentNode.id] = {layouted: true}
            let x = nodeWithPosition.x
            let y = nodeWithPosition.y

            // console.log('node with position: ', nodeWithPosition)
            currentNode.position = {
                x: x,
                y: y
            }
            if (nodeWithPosition.children && nodeWithPosition.children.length) {
                currentNode.data.height = nodeWithPosition.height
                currentNode.data.width = nodeWithPosition.width
            }
        }
        if (nodeWithPosition && nodeWithPosition.children) {
            copyPositions(nodeWithPosition.children)
        }
    })
    copyPositions(graph.children);
    // console.log('final nodes to flow: ', total)
    // //create a reactflow node
    // nodes = nodes.map((node) => {
    //     const nodeWithPosition = graph.children.find((layoutNode) => layoutNode.id == node.id);
    //     // console.log('node with position: ', nodeWithPosition)

    //     // We are shifting the elkjs node position (anchor=center center) to the top left
    //     // so it matches the React Flow node anchor point (top left).
    //     return {...node, position: {
    //         x: nodeWithPosition.x - nodeWidth / 2,
    //         y: nodeWithPosition.y - nodeHeight / 2,
    //     }};
    // });

    return { nodes: total, edges, metadata:metadata};
};

export default getLayoutedElements