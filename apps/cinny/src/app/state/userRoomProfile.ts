import { Position, RectCords } from 'folds';
import { atom } from 'jotai';

export type UserRoomProfileState = {
  userId: string;
  roomId: string;
  spaceId?: string;
  cords: RectCords;
  position?: Position;
};

export const userRoomProfileAtom = atom<UserRoomProfileState | undefined>(undefined);
