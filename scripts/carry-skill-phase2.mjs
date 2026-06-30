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
  `    function startNextTrainingPhase() {
      gameState.trackIndex = (gameState.trackIndex || 0) + 1;
      gameState.turn = 1;
      gameState.player.raceSkill = null;
      gameState.bonusOffered = false;
      gameState.bonusDoneThisTurn = false;
      enterTrainingScreen();
    }`,
  `    function startNextTrainingPhase() {
      gameState.trackIndex = (gameState.trackIndex || 0) + 1;
      gameState.turn = 1;
      if (gameState.player.raceSkill) {
        gameState.player.learnedSkills = recordLearnedSkill(
          gameState.player.learnedSkills || [],
          gameState.player.raceSkill
        );
      }
      gameState.bonusOffered = false;
      gameState.bonusDoneThisTurn = false;
      gameState.bonusType = null;
      enterTrainingScreen();
    }`,
  'startNextTrainingPhase keep skill'
);

const em = '\u2014';
replaceOnce(
  `            <strong>SKILLS</strong> ${em} Randomly learned during training (guaranteed by turn 6)<br>`,
  `            <strong>SKILLS</strong> ${em} Randomly learned during training; carry over to the next track<br>`,
  'stat guide skills'
);

writeFileSync(indexPath, content);
console.log('skills carry over between training phases');