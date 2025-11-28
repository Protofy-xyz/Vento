import { Box, Button, config, Icon, Icons, Spinner, Text } from 'folds';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preset, Visibility } from 'matrix-js-sdk';
import { addRoomIdToMDirect } from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoom } from '../../hooks/useRoom';
import { useCloseUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { getHomeRoomPath } from '../../pages/pathUtils';
import { useDirectRooms } from '../../pages/client/direct/useDirectRooms';

type UserRoomProfileProps = {
  userId: string;
};
export function UserRoomProfile({ userId }: UserRoomProfileProps) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const closeUserRoomProfile = useCloseUserRoomProfile();
  const directRooms = useDirectRooms();
  const [creatingDM, setCreatingDM] = useState(false);

  const room = useRoom();
  const myUserId = mx.getSafeUserId();

  // Check if we already have a DM with this user
  const existingDM = directRooms.find((roomId) => {
    const dmRoom = mx.getRoom(roomId);
    if (!dmRoom) return false;
    const members = dmRoom.getJoinedMembers();
    return members.some((m) => m.userId === userId);
  });

  const handleMessage = useCallback(async () => {
    closeUserRoomProfile();
    
    // If we already have a DM with this user, navigate to it
    if (existingDM) {
      navigate(getHomeRoomPath(existingDM));
      return;
    }

    // Create new DM directly
    setCreatingDM(true);
    try {
      const result = await mx.createRoom({
        is_direct: true,
        invite: [userId],
        visibility: Visibility.Private,
        preset: Preset.TrustedPrivateChat,
        initial_state: [],
      });
      
      addRoomIdToMDirect(mx, result.room_id, userId);
      
      // Wait for room to sync before navigating (so display names are loaded)
      await new Promise<void>((resolve) => {
        const checkRoom = () => {
          const newRoom = mx.getRoom(result.room_id);
          if (newRoom && newRoom.getJoinedMemberCount() > 0) {
            resolve();
          } else {
            setTimeout(checkRoom, 100);
          }
        };
        // Start checking after a small delay
        setTimeout(checkRoom, 200);
        // Timeout after 3 seconds regardless
        setTimeout(resolve, 3000);
      });
      
      navigate(getHomeRoomPath(result.room_id));
    } catch (error) {
      console.error('Failed to create DM:', error);
    } finally {
      setCreatingDM(false);
    }
  }, [mx, userId, existingDM, navigate, closeUserRoomProfile]);

  return (
    <Box style={{ padding: config.space.S300 }}>
      {userId !== myUserId && (
        <Button
          size="300"
          variant="Primary"
          fill="Solid"
          radii="300"
          style={{ paddingLeft: '25px', paddingRight: '25px' }}
          before={creatingDM ? <Spinner size="50" variant="Primary" fill="Solid" /> : <Icon size="50" src={Icons.Message} filled />}
          onClick={handleMessage}
          disabled={creatingDM}
        >
          <Text size="B300">Message</Text>
        </Button>
      )}
    </Box>
  );
}
