import { Room } from 'matrix-js-sdk';

/**
 * Check if a room is a "special" protected room.
 * Special rooms have restricted menu options (only Mark as Read and Notifications).
 * They cannot be left or have settings modified.
 */
export function isSpecialRoom(room: Room): boolean {
  const roomName = room.name?.toLowerCase() || '';
  const canonicalAlias = room.getCanonicalAlias()?.toLowerCase() || '';
  
  // Add room identifiers here to mark them as special/protected
  const specialRoomNames = ['vento'];
  const specialRoomAliases = ['#vento'];
  
  const isSpecialByName = specialRoomNames.includes(roomName);
  const isSpecialByAlias = specialRoomAliases.some(alias => canonicalAlias.includes(alias));
  
  return isSpecialByName || isSpecialByAlias;
}

