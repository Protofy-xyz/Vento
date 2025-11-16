import React, { useCallback, useMemo } from 'react';
import { Room } from 'matrix-js-sdk';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ImagePackContent } from './ImagePackContent';
import { ImagePack, PackContent } from '../../plugins/custom-emoji';
import { StateEvent } from '../../../types/matrix/room';
import { useRoomImagePack } from '../../hooks/useImagePacks';
import { randomStr } from '../../utils/common';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';

type RoomImagePackProps = {
  room: Room;
  stateKey: string;
};

export function RoomImagePack({ room, stateKey }: RoomImagePackProps) {
  const mx = useMatrixClient();
  const userId = mx.getUserId()!;
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canEditImagePack = permissions.stateEvent(StateEvent.PoniesRoomEmotes, userId);

  const fallbackPack = useMemo(() => {
    const fakePackId = randomStr(4);
    return new ImagePack(
      fakePackId,
      {},
      {
        roomId: room.roomId,
        stateKey,
      }
    );
  }, [room.roomId, stateKey]);
  const imagePack = useRoomImagePack(room, stateKey) ?? fallbackPack;

  const handleUpdate = useCallback(
    async (packContent: PackContent) => {
      const { address } = imagePack;
      if (!address) return;

      await mx.sendStateEvent(
        address.roomId,
        StateEvent.PoniesRoomEmotes,
        packContent,
        address.stateKey
      );
    },
    [mx, imagePack]
  );

  return (
    <ImagePackContent imagePack={imagePack} canEdit={canEditImagePack} onUpdate={handleUpdate} />
  );
}
