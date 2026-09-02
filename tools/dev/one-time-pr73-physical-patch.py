from pathlib import Path

def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one patch point, found {count}; anchor={old.splitlines()[0]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")

physical = Path("phaser/src/streaming/TrafficPhysicalConsequencesSystem.js")

replace_once(
    physical,
    '''    this.lastContact = null;
    this.lastTrafficContact = null;
    this.destroyed = false;''',
    '''    this.lastContact = null;
    this.lastTrafficContact = null;
    this.routePreflightFrames = 0;
    this.routePreflightContacts = 0;
    this.routePreflightYields = 0;
    this.routePreflightHoldSeconds = 0.24;
    this.lastRoutePreflight = null;
    this.destroyed = false;'''
)

replace_once(
    physical,
    '''    this.blockedHoldSeconds = clamp(option("blockedHoldSeconds", 0.55), this.pushHoldSeconds, 1.5);
    this.playerSpeedRetention = clamp(option("playerSpeedRetention", 0.78), 0.35, 0.95);''',
    '''    this.blockedHoldSeconds = clamp(option("blockedHoldSeconds", 0.55), this.pushHoldSeconds, 1.5);
    this.routePreflightHoldSeconds = clamp(
      option("routePreflightHoldSeconds", 0.24),
      0.12,
      0.75
    );
    this.playerSpeedRetention = clamp(option("playerSpeedRetention", 0.78), 0.35, 0.95);'''
)

replace_once(
    physical,
    '''    slot.physicalHoldSeconds = state.holdSeconds;
    slot.physicalReason = state.lastReason;
    slot.container?.setPosition?.(x, y);''',
    '''    slot.physicalHoldSeconds = state.holdSeconds;
    slot.physicalReason = state.lastReason;
    slot.physicalBlockerId = state.lastVehicleId || null;
    slot.container?.setPosition?.(x, y);'''
)

replace_once(
    physical,
    '''  pairKey(left, right) {
    return [String(left?.tokenId || ""), String(right?.tokenId || "")].sort().join("|");
  }

  resolveTrafficPair(left, right, contact) {''',
    '''  pairKey(left, right) {
    return [String(left?.tokenId || ""), String(right?.tokenId || "")].sort().join("|");
  }

  activeRoutePermits() {
    const snapshot = this.materializer.__nbdTrafficJunctionFlowController?.snapshot?.();
    return new Map(
      (snapshot?.activePermits || []).map(permit => [String(permit.tokenId), permit])
    );
  }

  routeContactPriority(slot, permits) {
    const permit = permits.get(String(slot?.tokenId || ""));
    const permitPhase = {
      "clearing-exit": 4,
      connector: 3,
      approach: 2
    }[permit?.phase] || 0;
    const routeStage = slot?.routeStage === "connector"
      ? 2
      : slot?.routeStage === "lane"
        ? 1
        : 0;
    return {
      permitPhase,
      routeStage,
      laneId: slot?.routeLaneId || null,
      progress: clamp(slot?.routeStageProgress, 0, 1),
      tokenId: String(slot?.tokenId || "")
    };
  }

  compareRouteContactPriority(left, right, permits) {
    const leftPriority = this.routeContactPriority(left, permits);
    const rightPriority = this.routeContactPriority(right, permits);
    if (leftPriority.permitPhase !== rightPriority.permitPhase) {
      return leftPriority.permitPhase - rightPriority.permitPhase;
    }
    if (leftPriority.routeStage !== rightPriority.routeStage) {
      return leftPriority.routeStage - rightPriority.routeStage;
    }
    if (leftPriority.routeStage === 1
      && leftPriority.laneId
      && leftPriority.laneId === rightPriority.laneId
      && Math.abs(leftPriority.progress - rightPriority.progress) > 0.000001) {
      return leftPriority.progress - rightPriority.progress;
    }
    return rightPriority.tokenId.localeCompare(leftPriority.tokenId);
  }

  routeContactWinner(left, right, permits) {
    return this.compareRouteContactPriority(left, right, permits) >= 0 ? left : right;
  }

  prepareRouteFrame(dt = 0.05) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const seconds = clamp(dt, 0, 0.05);
    const slots = this.activeSlots()
      .filter(slot => slot.routeActive === true)
      .sort((left, right) => String(left.tokenId).localeCompare(String(right.tokenId)));
    const permits = this.activeRoutePermits();
    const yieldByToken = new Map();
    let contacts = 0;

    for (let leftIndex = 0; leftIndex < slots.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex++) {
        const left = slots[leftIndex];
        const right = slots[rightIndex];
        const contact = orientedVehicleContact(left, right);
        if (!contact) continue;
        contacts++;
        const winner = this.routeContactWinner(left, right, permits);
        const loser = winner === left ? right : left;
        const existing = yieldByToken.get(String(loser.tokenId));
        if (!existing
          || this.compareRouteContactPriority(winner, existing.winner, permits) > 0
          || (this.compareRouteContactPriority(winner, existing.winner, permits) === 0
            && contact.overlap > existing.overlap)) {
          yieldByToken.set(String(loser.tokenId), {
            loser,
            winner,
            overlap: contact.overlap
          });
        }
      }
    }

    const decisions = [...yieldByToken.values()]
      .sort((left, right) => String(left.loser.tokenId).localeCompare(String(right.loser.tokenId)));
    const loserIds = new Set(decisions.map(decision => String(decision.loser.tokenId)));
    const topWinners = [...new Map(
      decisions
        .filter(decision => !loserIds.has(String(decision.winner.tokenId)))
        .map(decision => [String(decision.winner.tokenId), decision.winner])
    ).values()];
    const releasedWinnerTokenIds = [];
    for (const winner of topWinners) {
      const state = this.states.get(String(winner.tokenId));
      if (!state || !["traffic-collision", "route-contact-yield"].includes(state.lastReason)) continue;
      state.holdSeconds = 0;
      state.lastVehicleId = null;
      state.lastReason = "route-contact-priority";
      this.applyStateOffset(winner, state);
      releasedWinnerTokenIds.push(winner.tokenId);
    }

    const holdSeconds = Math.max(
      this.routePreflightHoldSeconds,
      seconds * 2
    );
    for (const decision of decisions) {
      const state = this.stateFor(decision.loser);
      if (!state) continue;
      state.holdSeconds = Math.max(state.holdSeconds, holdSeconds);
      state.lastImpactSpeed = 0;
      state.lastVehicleId = decision.winner.tokenId;
      state.lastReason = "route-contact-yield";
      this.applyStateOffset(decision.loser, state);
    }

    this.routePreflightFrames++;
    this.routePreflightContacts += contacts;
    this.routePreflightYields += decisions.length;
    this.lastRoutePreflight = {
      contacts,
      yields: decisions.length,
      releasedWinnerTokenIds,
      decisions: decisions.map(decision => ({
        loserTokenId: decision.loser.tokenId,
        winnerTokenId: decision.winner.tokenId,
        overlap: round(decision.overlap)
      }))
    };
    return decisions.length > 0;
  }

  resolveTrafficPair(left, right, contact) {'''
)

replace_once(
    physical,
    '''      totalTrafficDamage: round(this.totalTrafficDamage),
      totalBulletDamage: round(this.totalBulletDamage),
      maxPushStep: round(this.maxPushStep),''',
    '''      totalTrafficDamage: round(this.totalTrafficDamage),
      totalBulletDamage: round(this.totalBulletDamage),
      routePreflightFrames: this.routePreflightFrames,
      routePreflightContacts: this.routePreflightContacts,
      routePreflightYields: this.routePreflightYields,
      routePreflightHoldSeconds: round(this.routePreflightHoldSeconds, 3),
      routePreflightHeldVehicles: contacts.filter(
        item => item.reason === "route-contact-yield" && item.holdSeconds > 0
      ).length,
      lastRoutePreflight: this.lastRoutePreflight
        ? {
            ...this.lastRoutePreflight,
            releasedWinnerTokenIds: [...this.lastRoutePreflight.releasedWinnerTokenIds],
            decisions: this.lastRoutePreflight.decisions.map(decision => ({ ...decision }))
          }
        : null,
      maxPushStep: round(this.maxPushStep),'''
)

replace_once(
    physical,
    '''      snapshot.totalBulletDamage,
      snapshot.lastContact,
      snapshot.lastTrafficContact''',
    '''      snapshot.totalBulletDamage,
      snapshot.routePreflightContacts,
      snapshot.routePreflightYields,
      snapshot.lastRoutePreflight,
      snapshot.lastContact,
      snapshot.lastTrafficContact'''
)
