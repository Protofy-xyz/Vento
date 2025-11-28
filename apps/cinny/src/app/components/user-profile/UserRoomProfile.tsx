import { Box, Button, config, Icon, Icons, Spinner, Text } from 'folds';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preset, Visibility } from 'matrix-js-sdk';
import { UserHero, UserHeroName } from './UserHero';
import { addRoomIdToMDirect, getMxIdServer, mxcUrlToHttp } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useUserPresence } from '../../hooks/useUserPresence';
import { IgnoredUserAlert, MutualRoomsChip, OptionsChip, ServerChip, ShareChip } from './UserChips';
import { useCloseUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { PowerChip } from './PowerChip';
import { UserInviteAlert, UserBanAlert, UserModeration, UserKickAlert } from './UserModeration';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { useMembership } from '../../hooks/useMembership';
import { Membership } from '../../../types/matrix/room';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMemberPowerCompare } from '../../hooks/useMemberPowerCompare';
import { CreatorChip } from './CreatorChip';
import { getHomeRoomPath } from '../../pages/pathUtils';
import { useDirectRooms } from '../../pages/client/direct/useDirectRooms';

type UserRoomProfileProps = {
  userId: string;
};
export function UserRoomProfile({ userId }: UserRoomProfileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const closeUserRoomProfile = useCloseUserRoomProfile();
  const ignoredUsers = useIgnoredUsers();
  const ignored = ignoredUsers.includes(userId);
  const directRooms = useDirectRooms();
  const [creatingDM, setCreatingDM] = useState(false);

  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const { hasMorePower } = useMemberPowerCompare(creators, powerLevels);

  const myUserId = mx.getSafeUserId();
  const creator = creators.has(userId);

  const canKickUser = permissions.action('kick', myUserId) && hasMorePower(myUserId, userId);
  const canBanUser = permissions.action('ban', myUserId) && hasMorePower(myUserId, userId);
  const canUnban = permissions.action('ban', myUserId);
  const canInvite = permissions.action('invite', myUserId);

  const member = room.getMember(userId);
  const membership = useMembership(room, userId);

  const server = getMxIdServer(userId);
  const displayName = getMemberDisplayName(room, userId);
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = (avatarMxc && mxcUrlToHttp(mx, avatarMxc, useAuthentication)) ?? undefined;

  const presence = useUserPresence(userId);

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
    <Box direction="Column">
      <UserHero
        userId={userId}
        avatarUrl={avatarUrl}
        presence={presence && presence.lastActiveTs !== 0 ? presence : undefined}
      />
      <Box direction="Column" gap="500" style={{ padding: config.space.S400 }}>
        <Box direction="Column" gap="400">
          <Box gap="400" alignItems="Start">
            <UserHeroName displayName={displayName} userId={userId} />
            {userId !== myUserId && (
              <Box shrink="No">
                <Button
                  size="300"
                  variant="Primary"
                  fill="Solid"
                  radii="300"
                  before={creatingDM ? <Spinner size="50" variant="Primary" fill="Solid" /> : <Icon size="50" src={Icons.Message} filled />}
                  onClick={handleMessage}
                  disabled={creatingDM}
                >
                  <Text size="B300">Message</Text>
                </Button>
              </Box>
            )}
          </Box>
          <Box alignItems="Center" gap="200" wrap="Wrap">
            {server && <ServerChip server={server} />}
            <ShareChip userId={userId} />
            {creator ? <CreatorChip /> : <PowerChip userId={userId} />}
            {userId !== myUserId && <MutualRoomsChip userId={userId} />}
            {userId !== myUserId && <OptionsChip userId={userId} />}
          </Box>
        </Box>
        {ignored && <IgnoredUserAlert />}
        {member && membership === Membership.Ban && (
          <UserBanAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canUnban={canUnban}
            bannedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        {member &&
          membership === Membership.Leave &&
          member.events.member &&
          member.events.member.getSender() !== userId && (
            <UserKickAlert
              reason={member.events.member?.getContent().reason}
              kickedBy={member.events.member?.getSender()}
              ts={member.events.member?.getTs()}
            />
          )}
        {member && membership === Membership.Invite && (
          <UserInviteAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canKick={canKickUser}
            invitedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        <UserModeration
          userId={userId}
          canInvite={canInvite && membership === Membership.Leave}
          canKick={canKickUser && membership === Membership.Join}
          canBan={canBanUser && membership !== Membership.Ban}
        />
      </Box>
    </Box>
  );
}
