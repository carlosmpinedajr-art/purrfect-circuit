import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
let content = readFileSync(indexPath, 'utf8');

function replaceOnce(old, neu, label) {
  if (!content.includes(old)) throw new Error(`${label} not found`);
  content = content.replace(old, neu);
}

const em = '\u2014';

replaceOnce(
  '  <script src="tracks.js"></script>\n  <script>',
  '  <script src="tracks.js"></script>\n  <script src="race-skills.js"></script>\n  <script>',
  'race-skills script'
);

replaceOnce(
  `    const RACE_SKILLS = [
      {
        id: 'secondWind',
        name: 'Second Wind',
        description: 'At 50% lap: +10 Stamina'
      },
      {
        id: 'midraceSurge',
        name: 'Midrace Surge',
        description: 'At 50% lap: +20 Speed'
      },
      {
        id: 'finalKick',
        name: 'Final Kick',
        description: 'At 75% lap: +30 Speed'
      }
    ];

    const BONUS_SCENARIOS = [`,
  `    const BONUS_SCENARIOS = [`,
  'remove inline RACE_SKILLS'
);

replaceOnce(
  `            <strong>TURN 6</strong> ${em} Learn one race skill<br>`,
  `            <strong>SKILLS</strong> ${em} Randomly learned during training (guaranteed by turn 6)<br>`,
  'stat guide skills'
);

replaceOnce(
  `      <h3>RACE SKILL ${em} TURN 6</h3>
      <p class="skill-prompt">Choose one special ability for race day. You can only pick one!</p>`,
  `      <h3>RACE SKILL UNLOCKED!</h3>
      <p class="skill-prompt" id="skill-reveal-text">You learned a new ability during training.</p>`,
  'skill modal copy'
);

replaceOnce(
  `    function getRaceSkill(id) {
      return RACE_SKILLS.find(skill => skill.id === id) || null;
    }`,
  `    function getRaceSkill(id) {
      return getRaceSkillById(id);
    }`,
  'getRaceSkill helper'
);

replaceOnce(
  `    function offerBonusEvent() {
      gameState.bonusOffered = Math.random() < BONUS_EVENT_CHANCE;
      gameState.bonusDoneThisTurn = !gameState.bonusOffered;
    }`,
  `    function grantRandomRaceSkillLocal() {
      if (gameState.player.raceSkill) return null;
      const skillId = pickRandomRaceSkill();
      gameState.player.raceSkill = skillId;
      updateSkillDisplay();
      return skillId;
    }

    function resolveTrainingBonusesLocal() {
      let skillGranted = null;
      if (gameState.turn === SKILL_TURN) {
        skillGranted = grantRandomRaceSkillLocal() || skillGranted;
      }
      gameState.bonusOffered = Math.random() < BONUS_EVENT_CHANCE;
      if (!gameState.bonusOffered) {
        gameState.bonusDoneThisTurn = true;
        gameState.bonusType = null;
        return skillGranted;
      }
      if (!gameState.player.raceSkill && Math.random() < SKILL_BONUS_CHANCE) {
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
      }
      return skillGranted;
    }`,
  'local training bonuses'
);

replaceOnce(
  `    function handleTrainingNextStep(next) {
      if (next === 'skill') {
        if (isMultiplayer()) {
          showSkillModal(null);
        } else {
          showSkillModal(() => {
            offerBonusEvent();
            handleTrainingNextStep(gameState.bonusOffered ? 'bonus' : 'advance');
          });
        }
        return;
      }
      if (next === 'bonus') {
        showBonusModal(() => advanceTurn());
        return;
      }
      advanceTurn();
    }`,
  `    function handleTrainingNextStep(next, skillGranted) {
      if (skillGranted) {
        showSkillRevealModal(skillGranted, () => handleTrainingNextStep(next));
        return;
      }
      if (next === 'skill-reveal') {
        showSkillRevealModal(gameState.player.raceSkill, () => advanceTurn());
        return;
      }
      if (next === 'bonus') {
        showBonusModal(() => advanceTurn());
        return;
      }
      advanceTurn();
    }`,
  'handleTrainingNextStep'
);

replaceOnce(
  `          handleTrainingNextStep(res.next);
        });
        return;
      }
      gameState.player.stats[stat] = addStatGain(gameState.player.stats[stat], TRAIN_STAT_GAIN);
      renderStats();
      continueAfterTraining();
    }`,
  `          handleTrainingNextStep(res.next, res.skillGranted || null);
        });
        return;
      }
      gameState.player.stats[stat] = addStatGain(gameState.player.stats[stat], TRAIN_STAT_GAIN);
      renderStats();
      continueAfterTraining();
    }`,
  'applyTrainingStat skillGranted'
);

replaceOnce(
  `    function continueAfterTraining() {
      if (gameState.turn === SKILL_TURN && !gameState.player.raceSkill) {
        showSkillModal(() => {
          offerBonusEvent();
          handleTrainingNextStep(gameState.bonusOffered ? 'bonus' : 'advance');
        });
        return;
      }
      offerBonusEvent();
      handleTrainingNextStep(gameState.bonusOffered ? 'bonus' : 'advance');
    }`,
  `    function continueAfterTraining() {
      const skillGranted = resolveTrainingBonusesLocal();
      handleTrainingNextStep(
        gameState.bonusOffered && !gameState.bonusDoneThisTurn
          ? (gameState.bonusType === 'skill' ? 'skill-reveal' : 'bonus')
          : 'advance',
        skillGranted
      );
    }`,
  'continueAfterTraining'
);

replaceOnce(
  `    function showSkillModal(callback) {
      const modal = document.getElementById('skill-modal');
      const options = document.getElementById('skill-options');
      options.innerHTML = '';

      RACE_SKILLS.forEach(skill => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.innerHTML = \`<span class="skill-name">\${skill.name}</span>\${skill.description}\`;
        btn.onclick = () => {
          const finish = () => {
            updateSkillDisplay();
            modal.classList.add('hidden');
            if (callback) callback();
          };
          if (isMultiplayer()) {
            multiplayer.socket.emit('training:pick-skill', { skillId: skill.id }, (res) => {
              if (!res?.ok) return;
              syncLocalPlayerFromRoom();
              updateSkillDisplay();
              modal.classList.add('hidden');
              handleTrainingNextStep(res.next);
            });
            return;
          }
          gameState.player.raceSkill = skill.id;
          finish();
        };
        options.appendChild(btn);
      });

      modal.classList.remove('hidden');
    }`,
  `    function showSkillRevealModal(skillId, callback) {
      const modal = document.getElementById('skill-modal');
      const options = document.getElementById('skill-options');
      const prompt = document.getElementById('skill-reveal-text');
      const skill = getRaceSkill(skillId);
      options.innerHTML = '';

      if (prompt && skill) {
        prompt.textContent = \`You learned \${skill.name} during training!\`;
      }

      if (skill) {
        const card = document.createElement('div');
        card.className = 'skill-btn';
        card.style.cursor = 'default';
        card.innerHTML = \`<span class="skill-name">\${skill.name}</span>\${skill.description}\`;
        options.appendChild(card);
      }

      const btn = document.createElement('button');
      btn.className = 'skill-btn';
      btn.textContent = 'LET'S GO!';
      btn.onclick = () => {
        updateSkillDisplay();
        modal.classList.add('hidden');
        if (callback) callback();
      };
      options.appendChild(btn);

      modal.classList.remove('hidden');
    }`,
  'skill reveal modal'
);

replaceOnce(
  `      if (raceSkill === 'finalKick' && !racer.skillTriggers.finalKick && progress >= 0.75) {
        racer.skillTriggers.finalKick = true;
        racer.currentSpeed += 30;
        gameState.eventLog.push('Final Kick! +30 Speed!');
      }
    }`,
  `      if (raceSkill === 'finalKick' && !racer.skillTriggers.finalKick && progress >= 0.75) {
        racer.skillTriggers.finalKick = true;
        racer.currentSpeed += 30;
        gameState.eventLog.push('Final Kick! +30 Speed!');
      }

      if (raceSkill === 'photoFinish' && !racer.skillTriggers.photoFinish && progress >= PHOTO_FINISH_PROGRESS) {
        racer.skillTriggers.photoFinish = true;
        const boost = getPhotoFinishBoost(racer, gameState.racers);
        racer.currentSpeed += boost;
        gameState.eventLog.push(
          boost > PHOTO_FINISH_SPEED
            ? \`Photo Finish! +\${boost} Speed ${em} closing the gap!\`
            : \`Photo Finish! +\${boost} Speed!\`
        );
      }
    }`,
  'client photo finish'
);

writeFileSync(indexPath, content);
console.log('Photo Finish skill applied to index.html');