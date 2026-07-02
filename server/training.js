const {
  getStartingStatsForRacer,
  addStatGain,
  TRAIN_STAT_GAIN,
  BONUS_STAT_GAIN,
  BONUS_EVENT_CHANCE,
  SKILL_BONUS_CHANCE
} = require('../racer-stats');
const {
  pickRandomRaceSkillChoices,
  getAvailableSkillIds,
  recordLearnedSkill,
  syncPrimaryRaceSkill,
  VALID_SKILL_IDS
} = require('../race-skills');

const MAX_TURNS = 10;
const STAT_NAMES = ['speed', 'stamina', 'agility', 'focus'];

function clearSkillPickState(player) {
  player._skillChoices = [];
  player._skillPickPending = false;
  player._skillPickSource = null;
}

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
  player.campaignPoints = 0;
  clearSkillPickState(player);
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
  clearSkillPickState(player);
}

function initRoomTraining(room) {
  room.trackIndex = 0;
  Object.values(room.players).forEach(resetPlayerTraining);
}

function initRoomTrainingPhase2(room) {
  Object.values(room.players).forEach(resetPlayerTrainingPhase2);
}

function canOfferSkillBonus(player) {
  return getAvailableSkillIds(player.learnedSkills || []).length > 0;
}

function offerSkillPick(player, source) {
  const choices = pickRandomRaceSkillChoices(player.learnedSkills, 2);
  if (!choices.length) return false;
  player._skillChoices = choices;
  player._skillPickPending = true;
  player._skillPickSource = source;
  return true;
}

function maybeOfferTrainingSkillPick(player) {
  if (player._skillPickPending) return false;
  if (!canOfferSkillBonus(player)) return false;
  if (Math.random() >= SKILL_BONUS_CHANCE) return false;
  return offerSkillPick(player, 'train');
}

function offerBonusEvent(player) {
  const hit = Math.random() < BONUS_EVENT_CHANCE;
  player._bonusOffered = hit;
  if (!hit) {
    player._bonusDoneThisTurn = true;
    player._bonusType = null;
    return;
  }
  player._bonusType = 'stat';
}

function resolveTrainingBonuses(player) {
  maybeOfferTrainingSkillPick(player);
  offerBonusEvent(player);

  if (player._skillPickPending && player._bonusOffered) {
    player._bonusDoneThisTurn = false;
  }
}

function getNextStep(player) {
  if (player._skillPickPending) return 'skill-pick';
  if (player._bonusOffered && !player._bonusDoneThisTurn) return 'bonus';
  return 'advance';
}

function getSkillChoicesForClient(player) {
  return player._skillPickPending ? [...(player._skillChoices || [])] : null;
}

function trainStat(player, stat) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!STAT_NAMES.includes(stat)) return { error: 'Invalid stat' };
  if (player._statDoneThisTurn) return { error: 'Already trained this turn' };

  player.stats[stat] = addStatGain(player.stats[stat], TRAIN_STAT_GAIN);
  player._statDoneThisTurn = true;
  player.trainingTurn = player.turn;

  resolveTrainingBonuses(player);

  return {
    ok: true,
    next: getNextStep(player),
    skillChoices: getSkillChoicesForClient(player)
  };
}

function pickSkill(player, skillId) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!player._skillPickPending) return { error: 'No skill pick pending' };
  if (!player._skillChoices?.includes(skillId)) return { error: 'Invalid skill choice' };

  player.learnedSkills = recordLearnedSkill(player.learnedSkills, skillId);
  player.raceSkill = syncPrimaryRaceSkill(player.learnedSkills);
  clearSkillPickState(player);

  return {
    ok: true,
    skillGranted: skillId,
    next: getNextStep(player),
    skillChoices: getSkillChoicesForClient(player)
  };
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
  if (player._skillPickPending) return { error: 'Pick a skill first' };
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
  clearSkillPickState(player);
  return { ok: true, complete: false };
}

function allTrainingComplete(room) {
  const players = Object.values(room.players);
  return players.length > 0 && players.every((p) => p.connected && p.trainingComplete);
}

function resetRoomForPlayAgain(room) {
  room.trackIndex = 0;
  room.field = [];
  room.raceResults = null;
  Object.values(room.players).forEach((player) => {
    resetPlayerTraining(player);
    player.ready = false;
  });
}

module.exports = {
  MAX_TURNS,
  resetPlayerTraining,
  resetPlayerTrainingPhase2,
  initRoomTraining,
  initRoomTrainingPhase2,
  resetRoomForPlayAgain,
  trainStat,
  pickSkill,
  pickBonus,
  advanceTrainingTurn,
  allTrainingComplete,
  VALID_SKILL_IDS
};