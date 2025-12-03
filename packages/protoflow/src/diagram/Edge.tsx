import React from 'react';
import { EdgeProps, getBezierPath } from '@xyflow/react';
import useTheme from './Theme';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  targetHandleId,
  sourceHandleId,
  selected,
  //@ts-ignore
  color,
  children
}: EdgeProps & any) {
  const xEqual = sourceX === targetX;
  const yEqual = sourceY === targetY;

  const [edgePath] = getBezierPath({
    // we need this little hack in order to display the gradient for a straight line
    sourceX: xEqual ? sourceX + 0.0001 : sourceX,
    sourceY: yEqual ? sourceY + 0.0001 : sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const borderWidth = useTheme('nodeBorderWidth')
  const nodeEdgeWidth = useTheme('nodeEdgeWidth')
  const nodeEdgeStyle = useTheme('nodeEdgeStyle')
  return (
    <>
      <path
        id={id}
        strokeWidth={selected ? nodeEdgeWidth*2 : nodeEdgeWidth}
        stroke={color}
        className="react-flow__edge"
        d={edgePath}
        fill="none"
        strokeDasharray={nodeEdgeStyle}
      />
      <path
        id={id}
        className="react-flow__edge-interaction"
        d={edgePath}
        strokeOpacity="0"
        strokeWidth="20"
        fill="none"
      />
      {children}
    </>
  );
}
