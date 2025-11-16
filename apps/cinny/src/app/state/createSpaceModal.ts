import { atom } from 'jotai';

export type CreateSpaceModalState = {
  spaceId?: string;
};

export const createSpaceModalAtom = atom<CreateSpaceModalState | undefined>(undefined);
