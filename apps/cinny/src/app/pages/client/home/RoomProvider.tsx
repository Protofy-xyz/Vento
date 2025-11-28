import React, { ReactNode, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { IsDirectRoomProvider, RoomProvider } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useHomeRooms } from './useHomeRooms';
import { useDirectRooms } from '../direct/useDirectRooms';
import { getHomeRoomPath } from '../../pathUtils';

export function HomeRouteRoomProvider({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const homeRooms = useHomeRooms();
  const directRooms = useDirectRooms();

  // Combine home rooms and direct rooms
  const allRooms = useMemo(() => [...homeRooms, ...directRooms], [homeRooms, directRooms]);

  const { roomIdOrAlias } = useParams();
  const roomId = useSelectedRoom();
  const room = mx.getRoom(roomId);

  // Check if room is a direct message
  const isDirect = room ? directRooms.includes(room.roomId) : false;

  // If room doesn't exist or user is not a member, redirect to #vento
  const shouldRedirect = !room || !allRooms.includes(room.roomId);
  
  useEffect(() => {
    if (shouldRedirect) {
      // Find #vento room and navigate to it
      const ventoRoom = mx.getRooms().find(r => {
        const alias = r.getCanonicalAlias();
        return alias && alias.startsWith('#vento:');
      });
      
      if (ventoRoom) {
        navigate(getHomeRoomPath(ventoRoom.roomId), { replace: true });
      } else {
        // Fallback: navigate to first available room or home
        const firstRoom = homeRooms[0];
        if (firstRoom) {
          navigate(getHomeRoomPath(firstRoom), { replace: true });
        } else {
          navigate('/home', { replace: true });
        }
      }
    }
  }, [shouldRedirect, mx, navigate, homeRooms]);

  // Show nothing while redirecting
  if (shouldRedirect) {
    return null;
  }

  return (
    <RoomProvider key={room.roomId} value={room}>
      <IsDirectRoomProvider value={isDirect}>{children}</IsDirectRoomProvider>
    </RoomProvider>
  );
}
