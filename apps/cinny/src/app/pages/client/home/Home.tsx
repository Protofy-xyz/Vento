import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState } from 'react';
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
import { factoryRoomIdByActivity, factoryRoomIdByAtoZ } from '../../../utils/sort';
import {
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
  NavLink,
} from '../../../components/nav';
import {
  getHomeRoomPath,
  getHomeSearchPath,
} from '../../pathUtils';
import { getCanonicalAliasOrRoomId, getMxIdLocalPart } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useHomeSearchSelected } from '../../../hooks/router/useHomeSelected';
import { useHomeRooms } from './useHomeRooms';
import { useDirectRooms } from '../direct/useDirectRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread } from '../../../state/hooks/unread';
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
import { useOpenUserRoomProfile } from '../../../state/hooks/userRoomProfile';
import { nameInitials } from '../../../utils/common';

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
const DIRECT_CATEGORY_ID = makeNavCategoryId('home', 'direct');
const NETWORK_CATEGORY_ID = makeNavCategoryId('home', 'network');
const VENTO_ROOM_ALIAS = '#vento:vento.local';

export function Home() {
  const mx = useMatrixClient();
  useNavToActivePathMapper('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const rooms = useHomeRooms();
  const directs = useDirectRooms();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const useAuthentication = useMediaAuthentication();

  const selectedRoomId = useSelectedRoom();
  const searchSelected = useHomeSearchSelected();
  const noRoomToDisplay = rooms.length === 0 && directs.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  // Get the #vento room for network members
  const ventoRoom = useMemo(() => {
    const roomByAlias = mx.getRooms().find(r => r.getCanonicalAlias() === VENTO_ROOM_ALIAS);
    return roomByAlias;
  }, [mx]);
  
  const ventoRoomId = ventoRoom?.roomId ?? '';
  const networkMembers = useRoomMembers(mx, ventoRoomId);
  const myUserId = mx.getUserId();
  
  // Filter and sort network members (exclude self, sort by presence)
  const sortedNetworkMembers = useMemo(() => {
    if (!ventoRoom) return [];
    return networkMembers
      .filter(m => m.userId !== myUserId && m.membership === 'join')
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

  const sortedDirects = useMemo(() => {
    const items = Array.from(directs).sort(factoryRoomIdByActivity(mx));
    if (closedCategories.has(DIRECT_CATEGORY_ID)) {
      return items.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return items;
  }, [mx, directs, closedCategories, roomToUnread, selectedRoomId]);

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  const openUserRoomProfile = useOpenUserRoomProfile();
  
  const handleMemberClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const btn = evt.currentTarget as HTMLButtonElement;
    const userId = btn.getAttribute('data-user-id');
    if (!userId || !ventoRoom) return;
    openUserRoomProfile(ventoRoom.roomId, undefined, userId, btn.getBoundingClientRect(), 'Left');
  };

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
            {directs.length > 0 && (
              <NavCategory>
                <NavCategoryHeader>
                  <RoomNavCategoryButton
                    closed={closedCategories.has(DIRECT_CATEGORY_ID)}
                    data-category-id={DIRECT_CATEGORY_ID}
                    onClick={handleCategoryClick}
                  >
                    Conversations
                  </RoomNavCategoryButton>
                </NavCategoryHeader>
                {!closedCategories.has(DIRECT_CATEGORY_ID) && sortedDirects.map((roomId) => {
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <RoomNavItem
                      key={roomId}
                      room={room}
                      selected={selected}
                      showAvatar
                      direct
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
            {networkMembers.length > 0 && (
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
                {!closedCategories.has(NETWORK_CATEGORY_ID) && sortedNetworkMembers.map((member) => {
                  const name = getMemberDisplayName(ventoRoom!, member.userId) ?? getMxIdLocalPart(member.userId) ?? member.userId;
                  const avatarMxcUrl = member.getMxcAvatarUrl();
                  const avatarUrl = avatarMxcUrl
                    ? mx.mxcUrlToHttp(avatarMxcUrl, 100, 100, 'crop', undefined, false, useAuthentication) ?? undefined
                    : undefined;
                  const presence = mx.getUser(member.userId)?.presence;
                  const isOnline = presence === 'online';
                  const isAway = presence === 'unavailable';

                  return (
                    <NavItem 
                      key={member.userId} 
                      variant="Background" 
                      radii="400"
                      as="button"
                      data-user-id={member.userId}
                      onClick={handleMemberClick}
                      style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    >
                      <NavItemContent>
                        <Box as="span" grow="Yes" alignItems="Center" gap="200">
                          <Box as="span" style={{ position: 'relative', display: 'inline-flex' }}>
                            <Avatar size="200" radii="400">
                              <UserAvatar
                                userId={member.userId}
                                src={avatarUrl}
                                alt={name}
                                renderFallback={() => (
                                  <Text as="span" size="H6">
                                    {nameInitials(name)}
                                  </Text>
                                )}
                              />
                            </Avatar>
                            <span
                              style={{
                                position: 'absolute',
                                bottom: -1,
                                right: -1,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: isOnline ? 'var(--green9)' : isAway ? 'var(--orange9)' : 'var(--color6)',
                                border: '2px solid var(--bgPanel)',
                              }}
                            />
                          </Box>
                          <Box as="span" grow="Yes">
                            <Text as="span" size="Inherit" truncate>
                              {name}
                            </Text>
                          </Box>
                        </Box>
                      </NavItemContent>
                    </NavItem>
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
