import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const indexPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let content = readFileSync(indexPath, 'utf8');

function replaceOnce(old, neu, label) {
  if (!content.includes(old)) throw new Error(`${label} not found`);
  content = content.replace(old, neu);
}

replaceOnce(
  `          stats: getStartingStatsForRacer(selectedRacerId),
          raceSkill: null,
          isPlayer: true`,
  `          stats: getStartingStatsForRacer(selectedRacerId),
          raceSkill: null,
          learnedSkills: [],
          isPlayer: true`,
  'initGame learnedSkills'
);

replaceOnce(
  `      gameState.player.raceSkill = me.raceSkill || null;
      gameState.turn = me.turn || gameState.turn;`,
  `      gameState.player.raceSkill = me.raceSkill || null;
      gameState.player.learnedSkills = [...(me.learnedSkills || [])];
      gameState.turn = me.turn || gameState.turn;`,
  'sync learnedSkills'
);

replaceOnce(
  `        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);
        gameState.player.raceSkill = null;
        gameState.bonusOffered = false;`,
  `        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);
        gameState.player.raceSkill = null;
        gameState.player.learnedSkills = [];
        gameState.bonusOffered = false;`,
  'startTraining reset learnedSkills'
);

replaceOnce(
  `    function grantRandomRaceSkillLocal() {
      if (gameState.player.raceSkill) return null;
      const skillId = pickRandomRaceSkill();
      gameState.player.raceSkill = skillId;
      return skillId;
    }`,
  `    function canOfferSkillBonusLocal() {
      if (gameState.player.raceSkill) return false;
      return getAvailableSkillIds(gameState.player.learnedSkills || []).length > 0;
    }

    function grantRandomRaceSkillLocal() {
      if (gameState.player.raceSkill) return null;
      const learnedSkills = gameState.player.learnedSkills || [];
      const skillId = pickRandomRaceSkill(learnedSkills);
      if (!skillId) return null;
      gameState.player.raceSkill = skillId;
      gameState.player.learnedSkills = recordLearnedSkill(learnedSkills, skillId);
      return skillId;
    }`,
  'grantRandomRaceSkillLocal'
);

replaceOnce(
  `      if (!gameState.player.raceSkill && Math.random() < SKILL_BONUS_CHANCE) {
        gameState.bonusType = 'skill';
      } else {
        gameState.bonusType = 'stat';
      }
      if (gameState.bonusType === 'skill' && gameState.player.raceSkill) {
        gameState.bonusType = 'stat';
      }
      if (gameState.bonusType === 'skill') {
        skillGranted = grantRandomRaceSkillLocal();
        gameState.bonusDoneThisTurn = true;
      } else {
        gameState.bonusDoneThisTurn = false;
      }`,
  `      if (canOfferSkillBonusLocal() && Math.random() < SKILL_BONUS_CHANCE) {
        gameState.bonusType = 'skill';
      } else {
        gameState.bonusType = 'stat';
      }
      if (gameState.bonusType === 'skill' && !canOfferSkillBonusLocal()) {
        gameState.bonusType = 'stat';
      }
      if (gameState.bonusType === 'skill') {
        skillGranted = grantRandomRaceSkillLocal();
        if (skillGranted) {
          gameState.bonusDoneThisTurn = true;
        } else {
          gameState.bonusType = 'stat';
          gameState.bonusDoneThisTurn = false;
        }
      } else {
        gameState.bonusDoneThisTurn = false;
      }`,
  'resolveTrainingBonusesLocal skill pool'
);

writeFileSync(indexPath, content);
console.log('learned skills tracking applied');