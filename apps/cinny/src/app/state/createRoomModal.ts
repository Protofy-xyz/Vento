import { atom } from 'jotai';

export type CreateRoomModalState = {
  spaceId?: string;
};

export const createRoomModalAtom = atom<CreateRoomModalState | undefined>(undefined);
