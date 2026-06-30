// Starting stats for playable racers (focus stays at 5 for all).
const MAX_STAT = 150;
const TRAIN_STAT_GAIN = 5;
const BONUS_STAT_GAIN = 2;
const BONUS_EVENT_CHANCE = 0.8;
const SKILL_BONUS_CHANCE = 0.25;

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_STAT,
    TRAIN_STAT_GAIN,
    BONUS_STAT_GAIN,
    BONUS_EVENT_CHANCE,
    SKILL_BONUS_CHANCE,
    RACER_STARTING_STATS,
    DEFAULT_STARTING_STATS,
    getStartingStatsForRacer,
    clampStatValue,
    addStatGain
  };
}