function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedId(value) {
  const id = String(value || "").trim();
  return id || null;
}

export function createTrafficJunctionReservationRegistry({
  staleAfterSeconds = 3
} = {}) {
  const reservations = new Map();
  const staleAfter = Math.max(0.25, finite(staleAfterSeconds, 3));
  let grants = 0;
  let refreshes = 0;
  let denials = 0;
  let releases = 0;
  let staleReleases = 0;

  function cleanup(nowSeconds = 0) {
    const now = Math.max(0, finite(nowSeconds));
    const expired = [];
    for (const [junctionId, reservation] of reservations) {
      if (now - finite(reservation.lastTouchedAt) < staleAfter) continue;
      reservations.delete(junctionId);
      staleReleases++;
      expired.push({ ...reservation, releaseReason: "stale" });
    }
    expired.sort((left, right) => left.junctionId.localeCompare(right.junctionId));
    return expired;
  }

  function request({
    junctionId,
    tokenId,
    connectorId = null,
    nowSeconds = 0
  } = {}) {
    const junction = normalizedId(junctionId);
    const token = normalizedId(tokenId);
    const connector = normalizedId(connectorId);
    if (!junction || !token) {
      throw new TypeError("Traffic junction reservation requires junctionId and tokenId.");
    }
    const now = Math.max(0, finite(nowSeconds));
    cleanup(now);
    const existing = reservations.get(junction);
    if (!existing) {
      const reservation = {
        junctionId: junction,
        tokenId: token,
        connectorId: connector,
        acquiredAt: now,
        lastTouchedAt: now
      };
      reservations.set(junction, reservation);
      grants++;
      return {
        granted: true,
        refreshed: false,
        reason: "granted",
        reservation: { ...reservation }
      };
    }
    if (existing.tokenId === token) {
      existing.connectorId = connector || existing.connectorId || null;
      existing.lastTouchedAt = now;
      refreshes++;
      return {
        granted: true,
        refreshed: true,
        reason: "already-owned",
        reservation: { ...existing }
      };
    }
    denials++;
    return {
      granted: false,
      refreshed: false,
      reason: "junction-occupied",
      ownerTokenId: existing.tokenId,
      reservation: { ...existing }
    };
  }

  function touch({ junctionId, tokenId, nowSeconds = 0 } = {}) {
    const junction = normalizedId(junctionId);
    const token = normalizedId(tokenId);
    if (!junction || !token) return false;
    const now = Math.max(0, finite(nowSeconds));
    const existing = reservations.get(junction);
    // A live connector occupant touching its own reservation is proof that the
    // owner has not vanished. Refresh it before global stale cleanup so a long
    // frame cannot manufacture a transient ownership gap mid-junction.
    if (existing?.tokenId === token) {
      existing.lastTouchedAt = now;
      refreshes++;
      return true;
    }
    cleanup(now);
    return false;
  }

  function release({ junctionId, tokenId, reason = "exit" } = {}) {
    const junction = normalizedId(junctionId);
    const token = normalizedId(tokenId);
    if (!junction || !token) return false;
    const existing = reservations.get(junction);
    if (!existing || existing.tokenId !== token) return false;
    reservations.delete(junction);
    releases++;
    return { ...existing, releaseReason: String(reason || "exit") };
  }

  function releaseByToken(tokenId, reason = "forced") {
    const token = normalizedId(tokenId);
    if (!token) return [];
    const removed = [];
    for (const [junctionId, reservation] of reservations) {
      if (reservation.tokenId !== token) continue;
      reservations.delete(junctionId);
      releases++;
      removed.push({ ...reservation, releaseReason: String(reason || "forced") });
    }
    removed.sort((left, right) => left.junctionId.localeCompare(right.junctionId));
    return removed;
  }

  function ownedBy(tokenId) {
    const token = normalizedId(tokenId);
    if (!token) return [];
    return [...reservations.values()]
      .filter(reservation => reservation.tokenId === token)
      .map(reservation => ({ ...reservation }))
      .sort((left, right) => left.junctionId.localeCompare(right.junctionId));
  }

  function reservationFor(junctionId) {
    const reservation = reservations.get(normalizedId(junctionId));
    return reservation ? { ...reservation } : null;
  }

  function snapshot() {
    return {
      staleAfterSeconds: staleAfter,
      activeReservationCount: reservations.size,
      reservations: [...reservations.values()]
        .map(reservation => ({ ...reservation }))
        .sort((left, right) => left.junctionId.localeCompare(right.junctionId)),
      grants,
      refreshes,
      denials,
      releases,
      staleReleases
    };
  }

  function clear(reason = "clear") {
    const removed = [...reservations.values()]
      .map(reservation => ({ ...reservation, releaseReason: String(reason || "clear") }))
      .sort((left, right) => left.junctionId.localeCompare(right.junctionId));
    releases += removed.length;
    reservations.clear();
    return removed;
  }

  return Object.freeze({
    request,
    touch,
    release,
    releaseByToken,
    ownedBy,
    reservationFor,
    cleanup,
    snapshot,
    clear
  });
}
