import { angleBetween, normalizeVector } from "../utils/geometry.js";

export const TRAVERSAL_RULES = Object.freeze({
  committedRadius: 12,
  facingHalfAngle: 1.15,
  distanceWeight: 100,
  angleWeight: 18
});

export function evaluateTraversalCandidate(player, aimDirection, candidate, rules = TRAVERSAL_RULES) {
  if (!player || !candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    return { valid: false, score: Infinity, distance: Infinity, aimAngle: Infinity, committed: false };
  }

  const dx = candidate.x - player.x;
  const dy = candidate.y - player.y;
  const distance = Math.hypot(dx, dy);
  const toward = normalizeVector(dx, dy, { x: 0, y: -1 });
  const aim = normalizeVector(aimDirection?.x || 0, aimDirection?.y || -1, { x: 0, y: -1 });
  const aimAngle = distance <= 0.001 ? 0 : angleBetween(aim, toward);
  const committed = distance <= rules.committedRadius && aimAngle <= rules.facingHalfAngle;
  const priorityPenalty = Math.max(0, 60 - (Number(candidate.priority) || 0));
  const score = (committed ? 0 : 1_000_000)
    + distance * rules.distanceWeight
    + aimAngle * rules.angleWeight
    + priorityPenalty;

  return { valid: true, score, distance, aimAngle, committed };
}

export function selectTraversalCandidate(player, aimDirection, candidates = [], rules = TRAVERSAL_RULES) {
  return candidates
    .map(candidate => ({ candidate, evaluation: evaluateTraversalCandidate(player, aimDirection, candidate, rules) }))
    .filter(item => item.evaluation.valid)
    .sort((a, b) => {
      const score = a.evaluation.score - b.evaluation.score;
      if (Math.abs(score) > 1e-9) return score;
      return String(a.candidate.id || "").localeCompare(String(b.candidate.id || ""));
    })[0]?.candidate || null;
}
