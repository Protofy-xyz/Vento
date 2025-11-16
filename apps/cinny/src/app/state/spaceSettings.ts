import { atom } from 'jotai';

export enum SpaceSettingsPage {
  GeneralPage,
  MembersPage,
  PermissionsPage,
  EmojisStickersPage,
  DeveloperToolsPage,
}

export type SpaceSettingsState = {
  page?: SpaceSettingsPage;
  roomId: string;
  spaceId?: string;
};

export const spaceSettingsAtom = atom<SpaceSettingsState | undefined>(undefined);
