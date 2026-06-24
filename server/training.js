const MAX_TURNS = 10;
const SKILL_TURN = 6;
const BONUS_TURNS = [3, 6, 9];
const STAT_NAMES = ['speed', 'stamina', 'agility', 'focus'];
const VALID_SKILLS = ['secondWind', 'midraceSurge', 'finalKick'];

function resetPlayerTraining(player) {
  player.turn = 1;
  player.stats = { speed: 5, stamina: 5, agility: 5, focus: 5 };
  player.raceSkill = null;
  player.trainingComplete = false;
  player.trainingTurn = 1;
  player._statDoneThisTurn = false;
  player._bonusDoneThisTurn = false;
}

function initRoomTraining(room) {
  Object.values(room.players).forEach(resetPlayerTraining);
}

function getNextStep(player) {
  if (player.turn === SKILL_TURN && !player.raceSkill) return 'skill';
  if (BONUS_TURNS.includes(player.turn) && !player._bonusDoneThisTurn) return 'bonus';
  return 'advance';
}

function trainStat(player, stat) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!STAT_NAMES.includes(stat)) return { error: 'Invalid stat' };
  if (player._statDoneThisTurn) return { error: 'Already trained this turn' };

  player.stats[stat]++;
  player._statDoneThisTurn = true;
  player.trainingTurn = player.turn;
  return { ok: true, next: getNextStep(player) };
}

function pickSkill(player, skillId) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (player.turn !== SKILL_TURN) return { error: 'Skill unlocks on turn 6' };
  if (!player._statDoneThisTurn) return { error: 'Train a stat first' };
  if (player.raceSkill) return { error: 'Skill already chosen' };
  if (!VALID_SKILLS.includes(skillId)) return { error: 'Invalid skill' };

  player.raceSkill = skillId;
  return { ok: true, next: getNextStep(player) };
}

function pickBonus(player, stat) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!BONUS_TURNS.includes(player.turn)) return { error: 'No bonus this turn' };
  if (!player._statDoneThisTurn) return { error: 'Train a stat first' };
  if (player.turn === SKILL_TURN && !player.raceSkill) return { error: 'Pick a skill first' };
  if (player._bonusDoneThisTurn) return { error: 'Bonus already chosen' };
  if (!STAT_NAMES.includes(stat)) return { error: 'Invalid stat' };

  player.stats[stat] += 2;
  player._bonusDoneThisTurn = true;
  return { ok: true, next: 'advance' };
}

function advanceTrainingTurn(player) {
  if (player.trainingComplete) return { error: 'Training finished' };
  if (!player._statDoneThisTurn) return { error: 'Train a stat first' };
  if (player.turn === SKILL_TURN && !player.raceSkill) return { error: 'Pick a skill first' };
  if (BONUS_TURNS.includes(player.turn) && !player._bonusDoneThisTurn) {
    return { error: 'Pick a bonus first' };
  }

  if (player.turn >= MAX_TURNS) {
    player.trainingComplete = true;
    player.trainingTurn = MAX_TURNS;
    return { ok: true, complete: true };
  }

  player.turn++;
  player.trainingTurn = player.turn;
  player._statDoneThisTurn = false;
  player._bonusDoneThisTurn = false;
  return { ok: true, complete: false };
}

function allTrainingComplete(room) {
  const players = Object.values(room.players);
  return players.length > 0 && players.every((p) => p.connected && p.trainingComplete);
}

module.exports = {
  MAX_TURNS,
  SKILL_TURN,
  BONUS_TURNS,
  resetPlayerTraining,
  initRoomTraining,
  trainStat,
  pickSkill,
  pickBonus,
  advanceTrainingTurn,
  allTrainingComplete
};