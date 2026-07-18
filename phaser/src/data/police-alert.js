export const POLICE_ALERT_RULES = Object.freeze({
  maxGameplayLevel: 3,
  levelSize: 25,
  stabilityBuffer: 6
});

export function policeViolenceTargetLevel(
  currentLevel,
  { neutralized = false } = {},
  rules = POLICE_ALERT_RULES
) {
  const current = Math.max(0, Math.min(
    rules.maxGameplayLevel,
    Math.floor(Number(currentLevel) || 0)
  ));

  if (!neutralized) return Math.max(1, current);
  return Math.min(rules.maxGameplayLevel, Math.max(2, current + 1));
}

export function exposureNeededForPoliceLevel(
  currentExposure,
  targetLevel,
  rules = POLICE_ALERT_RULES
) {
  const level = Math.max(0, Math.min(
    rules.maxGameplayLevel,
    Math.floor(Number(targetLevel) || 0)
  ));
  if (level <= 0) return 0;

  const targetExposure = level * rules.levelSize + rules.stabilityBuffer;
  return Math.max(0, targetExposure - Math.max(0, Number(currentExposure) || 0));
}
