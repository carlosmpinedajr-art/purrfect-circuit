// Starting stats for playable racers (focus stays at 5 for all).
const MAX_STAT = 150;
const TRAIN_STAT_GAIN = 5;
const BONUS_STAT_GAIN = 2;
const BONUS_EVENT_CHANCE = 0.8;
const SKILL_BONUS_CHANCE = 0.1;

const RACER_STARTING_STATS = {
  purple: { speed: 7, stamina: 5, agility: 5, focus: 5 }, // Lilac
  yellow: { speed: 5, stamina: 7, agility: 5, focus: 5 }, // Sunny
  orange: { speed: 5, stamina: 5, agility: 7, focus: 5 }  // Ember
};

const DEFAULT_STARTING_STATS = { speed: 5, stamina: 5, agility: 5, focus: 5 };

function getStartingStatsForRacer(racerId) {
  const base = RACER_STARTING_STATS[racerId] || DEFAULT_STARTING_STATS;
  return { ...base };
}

function clampStatValue(value) {
  return Math.min(MAX_STAT, Math.max(0, value));
}

function addStatGain(current, amount) {
  return clampStatValue(current + amount);
}

const PACE_FOCUS_BASE = DEFAULT_STARTING_STATS.focus;
const PACE_VARIANCE_MAX = 0.35;
const PACE_VARIANCE_MIN = 0;
const PACE_FLOOR_MIN = 0.60;
const PACE_FLOOR_MAX = 1.0;
const FOCUS_POINTS_RANGE = MAX_STAT - PACE_FOCUS_BASE;
const FOCUS_FLOOR_PER_POINT = (PACE_FLOOR_MAX - PACE_FLOOR_MIN) / FOCUS_POINTS_RANGE;
const FOCUS_VARIANCE_PER_POINT = (PACE_VARIANCE_MAX - PACE_VARIANCE_MIN) / FOCUS_POINTS_RANGE;

function getFocusPaceTuning(focus) {
  const points = Math.min(MAX_STAT, Math.max(0, focus ?? PACE_FOCUS_BASE));
  const earned = points - PACE_FOCUS_BASE;
  return {
    floor: Math.max(0.5, PACE_FLOOR_MIN + earned * FOCUS_FLOOR_PER_POINT),
    variance: Math.min(
      PACE_VARIANCE_MAX,
      Math.max(PACE_VARIANCE_MIN, PACE_VARIANCE_MAX - earned * FOCUS_VARIANCE_PER_POINT)
    )
  };
}

function getFocusTopSpeedEffectiveness(focus) {
  const { floor, variance } = getFocusPaceTuning(focus);
  return {
    minPct: Math.round(floor * 100),
    maxPct: Math.round((floor + variance) * 100)
  };
}

const AGILITY_STAT_BASE = DEFAULT_STARTING_STATS.agility;
const AGILITY_POINTS_RANGE = MAX_STAT - AGILITY_STAT_BASE;
const AGILITY_RECOVERY_BASE_SEC = 3.0;
const AGILITY_RECOVERY_MIN_SEC = 0.8;
const AGILITY_RECOVERY_PER_POINT =
  (AGILITY_RECOVERY_BASE_SEC - AGILITY_RECOVERY_MIN_SEC) / AGILITY_POINTS_RANGE;
const HURDLE_LANDING_SPEED_MIN = 0.5;
const HURDLE_LANDING_SPEED_MAX = 0.75;
const HURDLE_LANDING_SPEED_PER_POINT =
  (HURDLE_LANDING_SPEED_MAX - HURDLE_LANDING_SPEED_MIN) / AGILITY_POINTS_RANGE;

function getAgilityEarnedPoints(agility) {
  const points = Math.min(MAX_STAT, Math.max(0, agility ?? AGILITY_STAT_BASE));
  return points - AGILITY_STAT_BASE;
}

function getHurdleRecoveryDuration(agility) {
  const earned = getAgilityEarnedPoints(agility);
  return Math.max(
    AGILITY_RECOVERY_MIN_SEC,
    AGILITY_RECOVERY_BASE_SEC - earned * AGILITY_RECOVERY_PER_POINT
  );
}

function getHurdleSpeedMultiplier(agility) {
  const earned = getAgilityEarnedPoints(agility);
  return HURDLE_LANDING_SPEED_MIN + earned * HURDLE_LANDING_SPEED_PER_POINT;
}

function getAgilityHurdleEffectiveness(agility) {
  const landingMult = getHurdleSpeedMultiplier(agility);
  const recoverySec = getHurdleRecoveryDuration(agility);
  return {
    recoverySec: Math.round(recoverySec * 10) / 10,
    landingSpeedPct: Math.round(landingMult * 100),
    penaltyPct: Math.round((1 - landingMult) * 100)
  };
}

// Race pace — lowered from 2.5/stat so races are easier to follow on screen.
const LEGACY_RACE_SPEED_PER_STAT = 2.5;
const RACE_SPEED_PER_STAT = 1.0;
const CPU_MIN_RACE_SPEED = 2;

function calcBaseSpeed(racer) {
  return (racer?.stats?.speed ?? 0) * RACE_SPEED_PER_STAT;
}

function scaleSkillSpeedBoost(amount) {
  return amount * (RACE_SPEED_PER_STAT / LEGACY_RACE_SPEED_PER_STAT);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_STAT,
    TRAIN_STAT_GAIN,
    BONUS_STAT_GAIN,
    BONUS_EVENT_CHANCE,
    SKILL_BONUS_CHANCE,
    PACE_FOCUS_BASE,
    FOCUS_POINTS_RANGE,
    FOCUS_FLOOR_PER_POINT,
    FOCUS_VARIANCE_PER_POINT,
    PACE_VARIANCE_MAX,
    PACE_VARIANCE_MIN,
    PACE_FLOOR_MIN,
    PACE_FLOOR_MAX,
    RACER_STARTING_STATS,
    DEFAULT_STARTING_STATS,
    getStartingStatsForRacer,
    clampStatValue,
    addStatGain,
    getFocusPaceTuning,
    getFocusTopSpeedEffectiveness,
    AGILITY_STAT_BASE,
    AGILITY_RECOVERY_BASE_SEC,
    AGILITY_RECOVERY_MIN_SEC,
    getHurdleRecoveryDuration,
    getHurdleSpeedMultiplier,
    getAgilityHurdleEffectiveness,
    RACE_SPEED_PER_STAT,
    LEGACY_RACE_SPEED_PER_STAT,
    CPU_MIN_RACE_SPEED,
    calcBaseSpeed,
    scaleSkillSpeedBoost
  };
}