import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState, useCallback } from 'react';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useAtom, useAtomValue } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { useNavigate } from 'react-router-dom';
import { MatrixError, Preset, Visibility, Room, RoomMember } from 'matrix-js-sdk';
import { factoryRoomIdByActivity, factoryRoomIdByAtoZ } from '../../../utils/sort';
import {
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
} from '../../../components/nav';
import {
  getHomeRoomPath,
} from '../../pathUtils';
import { getCanonicalAliasOrRoomId, getMxIdLocalPart, addRoomIdToMDirect, guessDmRoomUserId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useHomeRooms } from './useHomeRooms';
import { useDirectRooms } from '../direct/useDirectRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread, useRoomUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { Settings } from '../../../features/settings';
import { Modal500 } from '../../../components/Modal500';
import { useRoomMembers } from '../../../hooks/useRoomMembers';
import { UserAvatar } from '../../../components/user-avatar';
import { getMemberDisplayName } from '../../../utils/room';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { nameInitials } from '../../../utils/common';
import { UnreadBadge, UnreadBadgeCenter } from '../../../components/unread-badge';
import { useAsyncCallback } from '../../../hooks/useAsyncCallback';

// Helper to get last message from a room
const getLastMessage = (room: Room): { sender: string; body: string } | null => {
  const timeline = room.getLiveTimeline();
  const events = timeline.getEvents();
  
  // Find last message event (m.room.message)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.getType() === 'm.room.message') {
      const content = event.getContent();
      const sender = event.getSender() ?? '';
      const body = content.body ?? '';
      return { sender, body };
    }
  }
  return null;
};

// Network member item component with chat info
type NetworkMemberItemProps = {
  member: RoomMember;
  ventoRoom: Room;
  dmRoom: Room | undefined;
  selected: boolean;
  onNavigateToChat: (userId: string, roomId?: string) => void;
};

function NetworkMemberItem({ member, ventoRoom, dmRoom, selected, onNavigateToChat }: NetworkMemberItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const unread = useRoomUnread(dmRoom?.roomId ?? '', roomToUnreadAtom);
  
  const name = getMemberDisplayName(ventoRoom, member.userId) ?? getMxIdLocalPart(member.userId) ?? member.userId;
  const avatarMxcUrl = member.getMxcAvatarUrl();
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 100, 100, 'crop', undefined, false, useAuthentication) ?? undefined
    : undefined;
  const presence = mx.getUser(member.userId)?.presence;
  const isOnline = presence === 'online';
  const isAway = presence === 'unavailable';
  
  // Get last message info
  const lastMessage = dmRoom ? getLastMessage(dmRoom) : null;
  const lastMessageSenderName = lastMessage?.sender 
    ? (dmRoom ? getMemberDisplayName(dmRoom, lastMessage.sender) : null) ?? getMxIdLocalPart(lastMessage.sender) ?? lastMessage.sender
    : null;
  
  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    onNavigateToChat(member.userId, dmRoom?.roomId);
  };
  
  return (
    <NavItem 
      variant="Background" 
      radii="400"
      as="button"
      highlight={unread !== undefined}
      aria-selected={selected}
      data-user-id={member.userId}
      onClick={handleClick}
      style={{ cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: toRem(4) }}
    >
      <NavItemContent>
        <Box as="span" grow="Yes" alignItems="Center" gap="300">
          {/* Avatar - always large size */}
          <Box 
            as="span" 
            shrink="No"
            style={{ 
              position: 'relative', 
              display: 'inline-flex',
            }}
          >
            <Avatar size="400" radii="400">
              <UserAvatar
                userId={member.userId}
                src={avatarUrl}
                alt={name}
                renderFallback={() => (
                  <Text as="span" size="H4">
                    {nameInitials(name)}
                  </Text>
                )}
              />
            </Avatar>
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: isOnline ? 'var(--green9)' : isAway ? 'var(--orange9)' : 'var(--color6)',
                border: '2px solid var(--bgPanel)',
              }}
            />
          </Box>
          
          {/* Content area - Name + Message preview */}
          <Box as="span" grow="Yes" direction="Column" style={{ minWidth: 0, gap: toRem(2) }}>
            {/* Name */}
            <Text priority={unread ? '500' : '300'} as="span" size="Inherit" truncate>
              {name}
            </Text>
            
            {/* Last message preview or placeholder */}
            <Text as="span" size="T200" truncate priority="300">
              {lastMessage ? (
                <>
                  <span style={{ fontWeight: 500, opacity: 0.9 }}>
                    {lastMessageSenderName}:
                  </span>
                  {' '}
                  <span style={{ opacity: 0.6 }}>
                    {lastMessage.body}
                  </span>
                </>
              ) : (
                <span style={{ opacity: 0.4 }}>
                  No messages
                </span>
              )}
            </Text>
          </Box>
          
          {/* Unread badge */}
          {unread && (
            <Box as="span" shrink="No">
              <UnreadBadgeCenter>
                <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
              </UnreadBadgeCenter>
            </Box>
          )}
        </Box>
      </NavItemContent>
    </NavItem>
  );
}

type HomeMenuProps = {
  requestClose: () => void;
  onOpenSettings: () => void;
};
const HomeMenu = forwardRef<HTMLDivElement, HomeMenuProps>(({ requestClose, onOpenSettings }, ref) => {
  const orphanRooms = useHomeRooms();
  const directRooms = useDirectRooms();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const allRooms = useMemo(() => [...orphanRooms, ...directRooms], [orphanRooms, directRooms]);
  const unread = useRoomsUnread(allRooms, roomToUnreadAtom);
  const mx = useMatrixClient();

  const handleMarkAsRead = () => {
    if (!unread) return;
    allRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  const handleOpenSettings = () => {
    requestClose();
    onOpenSettings();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
        <MenuItem
          onClick={handleOpenSettings}
          size="300"
          after={<Icon size="100" src={Icons.Setting} />}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Settings
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function HomeHeader() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300" justifyContent="End">
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <HomeMenu 
              requestClose={() => setMenuAnchor(undefined)} 
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </FocusTrap>
        }
      />
      {settingsOpen && (
        <Modal500 requestClose={() => setSettingsOpen(false)}>
          <Settings requestClose={() => setSettingsOpen(false)} />
        </Modal500>
      )}
    </>
  );
}

function HomeEmpty() {
  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Hash} />}
        title={
          <Text size="H5" align="Center">
            No Rooms
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            You do not have any rooms yet.
          </Text>
        }
      />
    </NavEmptyCenter>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('home', 'room');
const NETWORK_CATEGORY_ID = makeNavCategoryId('home', 'network');
const VENTO_ROOM_ALIAS = '#vento:vento.local';

export function Home() {
  const mx = useMatrixClient();
  useNavToActivePathMapper('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const rooms = useHomeRooms();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  const selectedRoomId = useSelectedRoom();
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  // Get the #vento room for network members
  const ventoRoom = useMemo(() => {
    const roomByAlias = mx.getRooms().find(r => r.getCanonicalAlias() === VENTO_ROOM_ALIAS);
    return roomByAlias;
  }, [mx]);
  
  const ventoRoomId = ventoRoom?.roomId ?? '';
  const networkMembers = useRoomMembers(mx, ventoRoomId);
  const myUserId = mx.getUserId();
  
  const noRoomToDisplay = rooms.length === 0 && networkMembers.length === 0;
  
  // Filter and sort network members (exclude self and bridge bot, sort by presence)
  const sortedNetworkMembers = useMemo(() => {
    if (!ventoRoom) return [];
    // Get the local part of the current user's Matrix ID (e.g., "@admin:vento.local" -> "admin")
    const myLocalPart = myUserId?.split(':')[0]?.replace('@', '') ?? '';
    // Bridge bot userId to exclude
    const bridgeBotUserId = '@ventobot:vento.local';
    
    return networkMembers
      .filter(m => {
        // Exclude current user
        if (m.userId === myUserId) return false;
        // Exclude bridge bot
        if (m.userId === bridgeBotUserId) return false;
        // Exclude user with same local part as current user (e.g., if logged as "admin", exclude "@admin:vento.local")
        const memberLocalPart = m.userId?.split(':')[0]?.replace('@', '') ?? '';
        if (memberLocalPart === myLocalPart) return false;
        // Only include joined members
        return m.membership === 'join';
      })
      .sort((a, b) => {
        const presenceA = mx.getUser(a.userId)?.presence;
        const presenceB = mx.getUser(b.userId)?.presence;
        const weightA = presenceA === 'online' ? 0 : presenceA === 'unavailable' ? 1 : 2;
        const weightB = presenceB === 'online' ? 0 : presenceB === 'unavailable' ? 1 : 2;
        return weightA - weightB;
      });
  }, [networkMembers, ventoRoom, mx, myUserId]);

  const sortedRooms = useMemo(() => {
    const items = Array.from(rooms).sort(
      closedCategories.has(DEFAULT_CATEGORY_ID)
        ? factoryRoomIdByActivity(mx)
        : factoryRoomIdByAtoZ(mx)
    );
    if (closedCategories.has(DEFAULT_CATEGORY_ID)) {
      return items.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return items;
  }, [mx, rooms, closedCategories, roomToUnread, selectedRoomId]);

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  const navigate = useNavigate();
  
  // Create DM room callback
  const [, createDM] = useAsyncCallback<string, Error | MatrixError, [string]>(
    useCallback(
      async (userId) => {
        const result = await mx.createRoom({
          is_direct: true,
          invite: [userId],
          visibility: Visibility.Private,
          preset: Preset.TrustedPrivateChat,
          initial_state: [],
        });
        addRoomIdToMDirect(mx, result.room_id, userId);
        return result.room_id;
      },
      [mx]
    )
  );
  
  // Navigate to chat or create one
  const handleNavigateToChat = useCallback(async (userId: string, existingRoomId?: string) => {
    if (existingRoomId) {
      // Navigate to existing DM room
      navigate(getHomeRoomPath(getCanonicalAliasOrRoomId(mx, existingRoomId)));
    } else {
      // Create new DM room and navigate to it
      try {
        const roomId = await createDM(userId);
        navigate(getHomeRoomPath(roomId));
      } catch (error) {
        console.error('Failed to create DM room:', error);
      }
    }
  }, [mx, navigate, createDM]);
  
  // Get all direct rooms to find existing DMs
  const directRooms = useDirectRooms();
  
  // Map network members to their DM rooms
  const networkMembersWithDM = useMemo(() => {
    const myUserId = mx.getUserId() ?? '';
    
    return sortedNetworkMembers.map(member => {
      // Find existing DM room for this member
      const dmRoom = directRooms
        .map(roomId => mx.getRoom(roomId))
        .filter((room): room is Room => room !== null)
        .find(room => {
          // Check if this DM is with the target user
          const otherUserId = guessDmRoomUserId(room, myUserId);
          return otherUserId === member.userId;
        });
      
      return {
        member,
        dmRoom,
      };
    });
  }, [sortedNetworkMembers, mx, directRooms]);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Detect if running in iframe
  const isInIframe = typeof window !== 'undefined' && window !== window.parent;

  const handleOpenSettings = () => {
    // Notify parent that settings is opening
    window.parent.postMessage({ type: 'cinny-settings-open' }, '*');
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    // Notify parent that settings is closing
    window.parent.postMessage({ type: 'cinny-settings-close' }, '*');
    setSettingsOpen(false);
  };

  return (
    <PageNav>
      {noRoomToDisplay ? (
        <HomeEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            {rooms.length > 0 && (
              <NavCategory>
                <NavCategoryHeader>
                  <Box grow="Yes" alignItems="Center" justifyContent="SpaceBetween">
                    <RoomNavCategoryButton
                      closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                      data-category-id={DEFAULT_CATEGORY_ID}
                      onClick={handleCategoryClick}
                    >
                      Rooms
                    </RoomNavCategoryButton>
                    {!isInIframe && (
                      <IconButton variant="Background" onClick={handleOpenSettings} size="300">
                        <Icon src={Icons.Setting} size="100" style={{ opacity: 0.6 }} />
                      </IconButton>
                    )}
                  </Box>
                </NavCategoryHeader>
                {!closedCategories.has(DEFAULT_CATEGORY_ID) && sortedRooms.map((roomId) => {
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <RoomNavItem
                      key={roomId}
                      room={room}
                      selected={selected}
                      linkPath={getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                      notificationMode={getRoomNotificationMode(
                        notificationPreferences,
                        room.roomId
                      )}
                    />
                  );
                })}
              </NavCategory>
            )}
            {networkMembers.length > 0 && ventoRoom && (
              <NavCategory>
                <NavCategoryHeader>
                  <RoomNavCategoryButton
                    closed={closedCategories.has(NETWORK_CATEGORY_ID)}
                    data-category-id={NETWORK_CATEGORY_ID}
                    onClick={handleCategoryClick}
                  >
                    Network
                  </RoomNavCategoryButton>
                </NavCategoryHeader>
                {!closedCategories.has(NETWORK_CATEGORY_ID) && networkMembersWithDM.map(({ member, dmRoom }) => {
                  const selected = dmRoom ? selectedRoomId === dmRoom.roomId : false;

                  return (
                    <NetworkMemberItem
                      key={member.userId}
                      member={member}
                      ventoRoom={ventoRoom}
                      dmRoom={dmRoom}
                      selected={selected}
                      onNavigateToChat={handleNavigateToChat}
                    />
                  );
                })}
              </NavCategory>
            )}
          </Box>
        </PageNavContent>
      )}
      {settingsOpen && (
        <Modal500 requestClose={handleCloseSettings}>
          <Settings requestClose={handleCloseSettings} />
        </Modal500>
      )}
    </PageNav>
  );
}
