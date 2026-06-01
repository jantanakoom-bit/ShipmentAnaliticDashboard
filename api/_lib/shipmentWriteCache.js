let writeCacheBuster = 0;

export function getWriteCacheBuster() {
  return writeCacheBuster;
}

export function invalidateShipmentWriteCache() {
  writeCacheBuster += 1;
}
