import { useContext } from "react";
import { PORT_TYPES, Node, FlowStoreContext } from "protoflow";
import { Handle, Position, useEdges } from "reactflow";
import { getColor } from ".";
import useTheme from "protoflow/src/diagram/Theme";

// --- helpers -----------------------------

const isHandleConnected = (edges: any[], handleId: string) =>
  edges.find((e) => e.targetHandle == handleId || e.sourceHandle == handleId);

// Types that fit your data shape
type HandleSide = "left" | "right" | "top" | "bottom";

type Port = {
  number: number;
  side: HandleSide;
  name: string;
  type: string;
  analog: boolean;
  description: string;
  maxVoltage: number;
  rtc: boolean;
  nodeRendering?: {
    position?: { x?: number; y?: number }; // pixels
    handleSide?: HandleSide;
  };
  [k: string]: any;
};

type PortWithPosition = Port & {
  position: {
    top: number;    // style.top (px)
    left?: number;  // optional absolute x (px)
    side: Position; // React Flow handle side
  };
};

/**
 * calculatePortPositions (no legacy):
 * - Uses per-port nodeRendering.position.{x,y} + nodeRendering.handleSide exclusively.
 * - If handleSide is missing, falls back to port.side.
 * - If y is missing, defaults to 0.
 * - If x is missing, we anchor at 10px from the chosen side (handled in render).
 */
const calculatePortPositions = (ports: Port[]): PortWithPosition[] => {
  return ports.map((port) => {
    const nr = port.nodeRendering;
    const handleSide: HandleSide = nr?.handleSide ?? port.side ?? "right";

    let side: Position;
    switch (handleSide) {
      case "left":
        side = Position.Left;
        break;
      case "right":
        side = Position.Right;
        break;
      case "top":
        side = Position.Top;
        break;
      case "bottom":
        side = Position.Bottom;
        break;
      default:
        side = Position.Right;
    }

    const x = nr?.position?.x;
    const y = nr?.position?.y;

    // Position logic: keep both x and y for all sides
    const position = { left: x, top: y, side };

    return { ...port, position };
  });
};
// Render handles using positions computed above
const renderHandles = (
  portsWithPositions: PortWithPosition[],
  edges: any[],
  id: string,
  theme: { plusColor: string; edgeColor: string }
) => {
  const { plusColor, edgeColor } = theme;
  return portsWithPositions.map((port, i) => {
    const idString = `${id}${PORT_TYPES.data}element-${i + 2}`;
    const { top, side, left } = port.position;

    const description = {
      name: port.name,
      type: port.type,
      description: port.description,
      maxVoltage: port.maxVoltage,
      rtc: port.rtc,
    };

    const connected = isHandleConnected(edges, idString);

    // If absolute x is provided, use it; else anchor 10px from the side.
    const horizontalStyle =
      typeof left === "number"
        ? { left: `${left}px`, right: "auto" }
        : side === Position.Left
        ? { left: "10px", right: "auto" }
        : { left: "auto", right: "10px" };

    return (
      <Handle
        key={i}
        isConnectable={!connected}
        isValidConnection={(c) => !isHandleConnected(edges, c.sourceHandle)}
        type="target"
        title={JSON.stringify(description, null, 2)}
        style={{
          position: "absolute",
          top: `${top}px`,
          width: "25px",
          height: "25px",
          backgroundColor: connected ? "#BA68C8" : plusColor,
          border: connected ? "2px solid #BA68C8" : `2px solid ${edgeColor}`,
          ...horizontalStyle,
        }}
        position={side}
        id={idString}
      />
    );
  });
};

// --- component -----------------------------

const ProtofyESP32S3devBoard = ({ node = {}, nodeData = {}, topics = {}, color }: any) => {
  const { id } = node;
  const useFlowsStore = useContext(FlowStoreContext);
  const setNodeData = useFlowsStore((state: any) => state.setNodeData);

  const edges = useEdges();
  const metadata = useFlowsStore((state: any) => state.metadata);
  const ports: Port[] = metadata.board.ports;

  // Theme colors
  const plusColor = useTheme("plusColor");
  const edgeColor = useTheme("edgeColor");
  const menuBackground = useTheme("menuBackground");
  const nodeBorderColor = useTheme("nodeBorderColor");
  const textColor = useTheme("textColor");

  // Compute positions (ONLY from nodeRendering)
  const portsWithPositions = calculatePortPositions(ports);

  // Preserve your devicePositioning init (unchanged behavior)
  const containerWidth = 800;
  const devicePositioning = portsWithPositions.map((p, i) => {
    let sideFlag: "l" | "r";

    if (typeof p.position.left === "number") {
      const x = p.position.left;

      if (typeof containerWidth === "number") {
        // Decide by absolute pixel position vs half the container
        sideFlag = x > containerWidth / 2 ? "l" : "r";
      } else {
        // No known width: interpret common cases gracefully
        // 0–1 => percentage (0..1), 0–100 => percentage (0..100), else px with a light heuristic
        sideFlag =
          x <= 1 ? (x > 0.5 ? "r" : "l")
            : x <= 100 ? (x > 50 ? "r" : "l")
              : x > 150 ? "r" : "l";
      }
    } else {
      // No absolute x provided: fall back to resolved handle side
      sideFlag = p.position.side === Position.Right ? "r" : "l";
    }

    return `${i + 2}-${sideFlag}-${i}`;
  });

  if (!nodeData._devicePositioning) {
    setNodeData(node.id, { ...nodeData, _devicePositioning: devicePositioning });
  }

  return (
    <Node
      output={false}
      skipCustom={true}
      node={node}
      color={color}
      isPreview={!id}
      title="Protofy ESP32S3 devBoard"
      id={id}
      margin="200px"
    >
      <div style={{ marginTop: "20px", marginBottom: "80px" }}>
        <img
          src={"/public/images/device/ProtofyESP32S3devBoard.png"}
          style={{ width: "100%" }}
        />
        <div
          style={{
            margin: "70px auto 0",
            width: "90%",
            height: "160px",
            padding: "24px 20px",
            borderRadius: "12px",
            background: menuBackground,
            border: `1px solid ${nodeBorderColor}`,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: textColor,
              position: "absolute",
              top: "12px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            Virtual ports
          </div>
        </div>


      </div>
      {renderHandles(portsWithPositions, edges as any[], id, { plusColor, edgeColor })}
    </Node>
  );
};

export default {
  id: "protofyESP32S3devBoard",
  type: "ArrayLiteralExpression",
  check: (node: any, nodeData: any) =>
    node.type == "ArrayLiteralExpression" &&
    nodeData["element-1"] == '"Protofy ESP32S3 devBoard"',
  getComponent: (node: any, nodeData: any, children: any) => (
    <ProtofyESP32S3devBoard
      color={getColor("protofyESP32S3devBoard")}
      node={node}
      nodeData={nodeData}
      children={children}
    />
  ),
  getInitialData: () => {
    return { to: '"protofyESP32S3devBoard"' };
  },
  hidden: true,
  nonDeletable: true,
};
