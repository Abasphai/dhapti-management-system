/**
 * In-process cache of raw attendance QR payloads.
 * DB stores hash-only; display needs the raw token until expiry without rotating.
 * Cleared on revoke / regenerate / process restart (restart forces a single re-mint).
 */
type CacheEntry = {
  rawToken: string;
  expiresAtMs: number;
};

const byTokenId = new Map<string, CacheEntry>();

export function cacheAttendanceQrRaw(
  tokenId: string,
  rawToken: string,
  expiresAt: Date
) {
  byTokenId.set(tokenId, {
    rawToken,
    expiresAtMs: expiresAt.getTime(),
  });
}

export function getCachedAttendanceQrRaw(
  tokenId: string,
  now = new Date()
): string | null {
  const row = byTokenId.get(tokenId);
  if (!row) return null;
  if (row.expiresAtMs <= now.getTime()) {
    byTokenId.delete(tokenId);
    return null;
  }
  return row.rawToken;
}

export function clearAttendanceQrRawCache(tokenId: string) {
  byTokenId.delete(tokenId);
}

export function clearAttendanceQrRawCacheForLocation(locationId: string) {
  // Token ids are opaque; callers pass token ids after revoke query.
  void locationId;
}

export function clearAttendanceQrRawCacheMany(tokenIds: string[]) {
  for (const id of tokenIds) byTokenId.delete(id);
}

/** Test helper — empty the cache. */
export function __resetAttendanceQrRawCacheForTests() {
  byTokenId.clear();
}
