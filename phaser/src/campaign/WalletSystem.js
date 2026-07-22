function amountValue(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError("Wallet amount must be a positive finite number.");
  return Math.round(amount * 100) / 100;
}

function transactionMetadata(metadata = {}) {
  const result = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (["string", "number", "boolean"].includes(typeof value) || value == null) result[key] = value;
  }
  return result;
}

export class WalletSystem {
  constructor(state, { events = null, now = () => Date.now(), maxLedgerEntries = 500 } = {}) {
    if (!state?.player || !Array.isArray(state.ledger)) throw new TypeError("WalletSystem requires a campaign state.");
    this.state = state;
    this.events = events;
    this.now = now;
    this.maxLedgerEntries = Math.max(25, Math.trunc(Number(maxLedgerEntries) || 500));
  }

  balance() {
    return Math.max(0, Number(this.state.player.cash) || 0);
  }

  canAfford(amount) {
    const value = Number(amount);
    return Number.isFinite(value) && value >= 0 && this.balance() >= value;
  }

  credit(amount, metadata = {}, options = {}) {
    return this.record("credit", amountValue(amount), metadata, options);
  }

  debit(amount, metadata = {}, options = {}) {
    const value = amountValue(amount);
    if (!this.canAfford(value)) {
      const error = new RangeError(`Insufficient cash: need ${value}, have ${this.balance()}.`);
      error.code = "INSUFFICIENT_CASH";
      error.required = value;
      error.balance = this.balance();
      throw error;
    }
    return this.record("debit", value, metadata, options);
  }

  record(type, amount, metadata, { emit = true } = {}) {
    const before = this.balance();
    const after = type === "debit" ? before - amount : before + amount;
    const timestamp = Math.max(0, Math.trunc(Number(this.now()) || 0));
    this.state.sequences.transaction = Math.max(0, Number(this.state.sequences.transaction) || 0) + 1;
    const entry = {
      id: `txn-${String(this.state.sequences.transaction).padStart(6, "0")}`,
      type,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      timestamp,
      source: String(metadata.source || "unknown"),
      reason: String(metadata.reason || ""),
      referenceId: metadata.referenceId == null ? null : String(metadata.referenceId),
      metadata: transactionMetadata(metadata.metadata)
    };
    this.state.player.cash = after;
    this.state.ledger.push(entry);
    if (this.state.ledger.length > this.maxLedgerEntries) {
      this.state.ledger.splice(0, this.state.ledger.length - this.maxLedgerEntries);
    }
    if (emit) {
      this.events?.emit?.("wallet:changed", {
        transactionId: entry.id,
        type,
        amount,
        before,
        after,
        source: entry.source,
        referenceId: entry.referenceId
      });
    }
    return { ...entry, metadata: { ...entry.metadata } };
  }

  recent(limit = 20) {
    const count = Math.max(0, Math.trunc(Number(limit) || 0));
    return this.state.ledger.slice(-count).map(entry => ({ ...entry, metadata: { ...entry.metadata } }));
  }
}
