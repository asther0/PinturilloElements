const HOST_STORAGE_PREFIX = "pinturillo-host:";

/**
 * Room codes are case-insensitive at every boundary. Keeping their canonical
 * form here prevents a URL, Portal channel, or browser storage key from
 * referring to a different room solely because of casing.
 */
export function canonicalRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

export function roomChannelId(roomId: string): string {
  return `room:${canonicalRoomId(roomId)}`;
}

export function hostStorageKey(roomId: string): string {
  return `${HOST_STORAGE_PREFIX}${canonicalRoomId(roomId)}`;
}
