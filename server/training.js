const {
  getStartingStatsForRacer,
  addStatGain,
  TRAIN_STAT_GAIN,
  BONUS_STAT_GAIN,
  BONUS_EVENT_CHANCE,
  SKILL_BONUS_CHANCE
} = require('../racer-stats');
const {
  pickRandomRaceSkill,
  getAvailableSkillIds,
  recordLearnedSkill,
  syncPrimaryRaceSkill,
  VALID_SKILL_IDS
} = require('../race-skills');

const MAX_TURNS = 10;
const SKILL_TURN = 6;
const STAT_NAMES = ['speed', 'stamina', 'agility', 'focus'];

function resetPlayerTraining(player) {
  player.turn = 1;
  player.stats = getStartingStatsForRacer(player.racerId);
  player.raceSkill = null;
  player.learnedSkills = [];
  player.trainingComplete = false;
  player.trainingTurn = 1;
  player._statDoneThisTurn = false;
  player._bonusOffered = false;
  player._bonusDoneThisTurn = false;
  player._bonusType = null;
}

function resetPlayerTrainingPhase2(player) {
  player.turn = 1;
  if (!Array.isArray(player.learnedSkills)) player.learnedSkills = [];
  player.raceSkill = syncPrimaryRaceSkill(player.learnedSkills);
  player.trainingComplete = false;
  player.trainingTurn = 1;
  player._statDoneThisTurn = false;
  player._bonusOffered = false;
  player._bonusDoneThisTurn = false;
  player._bonusType = null;
}

function initRoomTraining(room) {
  room.trackIndex = 0;
  Object.values(room.players).forEach(resetPlayerTraining);
}

function initRoomTrainingPhase2(room) {
  Object.values(room.players).forEach(resetPlayerTrainingPhase2);
}

function grantRandomRaceSkill(player) {
  const learnedSkills = player.learnedSkills || [];
  const skillId = pickRandomRaceSkill(learnedSkills);
  if (!skillId) return null;
  player.learnedSkills = recordLearnedSkill(learnedSkills, skillId);
  player.raceSkill = syncPrimaryRaceSkill(player.learnedSkills);
  return skillId;
}

function canOfferSkillBonus(player) {
  return getAvailableSkillIds(player.learnedSkills || []).length > 0;
}

function offerBonusEvent(player) {
  const hit = Math.random() < BONUS_EVENT_CHANCE;
  player._bonusOffered = hit;
  if (!hit) {
    player._bonusDoneThisTurn = true;
    player._bonusType = null;
    return;
  }
  if (canOfferSkillBonus(player) && Math.random() < SKILL_BONUS_CHANCE) {
    player._bonusType = 'skill';
  } else {
    player._bonusType = 'stat';
  }
}

function normalizeBonusType(player) {
  if (player._bonusOffered && player._bonusType === 'skill' && !canOfferSkillBonus(player)) {
    player._bonusType = 'stat';
  }
}

function resolveTrainingBonuses(player) {
  let skillGranted = null;

  if (player.turn === SKILL_TURN) {
    skillGranted = grantRandomRaceSkill(player) || skillGranted;
  }

  offerBonusEvent(player);
  normalizeBonusType(player);

  if (player._bonusOffered && player._bonusType === 'skill' && !player._bonusDoneThisTurn) {
    skillGranted = grantRandomRaceSkill(player);
    if (skillGranted) {
      player._bonusDoneThisTurn = true;
    } else {
      player._bonusType = 'stat';
    }
  }

  return skillGranted;
}

function getNextStep(player) {
  if (player._bonusOffered && !player._bonusDoneThisTurn) {
    return player._bonusType === 'skill' ? 'skill-reveal' : 'bonus';
  }
  return 'advance';
}

function trainStat(player, stat) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!STAT_NAMES.includes(stat)) return { error: 'Invalid stat' };
  if (player._statDoneThisTurn) return { error: 'Already trained this turn' };

  player.stats[stat] = addStatGain(player.stats[stat], TRAIN_STAT_GAIN);
  player._statDoneThisTurn = true;
  player.trainingTurn = player.turn;

  const skillGranted = resolveTrainingBonuses(player);

  return { ok: true, next: getNextStep(player), skillGranted: skillGranted || null };
}

function pickBonus(player, stat) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!player._bonusOffered) return { error: 'No bonus event this turn' };
  if (!player._statDoneThisTurn) return { error: 'Train a stat first' };
  if (player._bonusType !== 'stat') return { error: 'Bonus is not a stat choice' };
  if (player._bonusDoneThisTurn) return { error: 'Bonus already resolved' };
  if (!STAT_NAMES.includes(stat)) return { error: 'Invalid stat' };

  player.stats[stat] = addStatGain(player.stats[stat], BONUS_STAT_GAIN);
  player._bonusDoneThisTurn = true;
  return { ok: true, next: 'advance' };
}

function advanceTrainingTurn(player) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!player._statDoneThisTurn) return { error: 'Train a stat first' };
  if (player._bonusOffered && !player._bonusDoneThisTurn) {
    return { error: 'Resolve the training event first' };
  }

  if (player.turn >= MAX_TURNS) {
    player.trainingComplete = true;
    player.trainingTurn = MAX_TURNS;
    return { ok: true, complete: true };
  }

  player.turn++;
  player.trainingTurn = player.turn;
  player._statDoneThisTurn = false;
  player._bonusOffered = false;
  player._bonusDoneThisTurn = false;
  player._bonusType = null;
  return { ok: true, complete: false };
}

function allTrainingComplete(room) {
  const players = Object.values(room.players);
  return players.length > 0 && players.every((p) => p.connected && p.trainingComplete);
}

module.exports = {
  MAX_TURNS,
  SKILL_TURN,
  resetPlayerTraining,
  resetPlayerTrainingPhase2,
  initRoomTraining,
  initRoomTrainingPhase2,
  trainStat,
  pickBonus,
  advanceTrainingTurn,
  allTrainingComplete,
  VALID_SKILL_IDS
};