import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const indexPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let content = readFileSync(indexPath, 'utf8');
const em = '\u2014';

function replaceOnce(old, neu, label) {
  if (!content.includes(old)) throw new Error(`${label} not found`);
  content = content.replace(old, neu);
}

replaceOnce(
  `            <strong>SKILLS</strong> ${em} Randomly learned during training; carry over to the next track<br>`,
  `            <strong>SKILLS</strong> ${em} Learn multiple skills during training; carry over to the next track<br>`,
  'stat guide'
);

replaceOnce(
  `      gameState.player.raceSkill = me.raceSkill || null;
      gameState.player.learnedSkills = [...(me.learnedSkills || [])];`,
  `      gameState.player.learnedSkills = [...(me.learnedSkills || [])];
      gameState.player.raceSkill = syncPrimaryRaceSkill(gameState.player.learnedSkills) || me.raceSkill || null;`,
  'sync player skills'
);

replaceOnce(
  `        gameState.player.raceSkill = localEntry.raceSkill;
        gameState.player.racerId = localEntry.racerId;`,
  `        gameState.player.learnedSkills = [...(localEntry.learnedSkills || [])];
        gameState.player.raceSkill = syncPrimaryRaceSkill(gameState.player.learnedSkills) || localEntry.raceSkill || null;
        gameState.player.racerId = localEntry.racerId;`,
  'buildMultiplayerLineup local'
);

replaceOnce(
  `          raceSkill: e.raceSkill,
          racerId: e.racerId,
          cpuStyleId: e.cpuStyleId,
          isPlayer: false,
          isHuman: !!e.isHuman,`,
  `          learnedSkills: [...(e.learnedSkills || [])],
          raceSkill: e.raceSkill || syncPrimaryRaceSkill(e.learnedSkills || []),
          racerId: e.racerId,
          cpuStyleId: e.cpuStyleId,
          isPlayer: false,
          isHuman: !!e.isHuman,`,
  'buildMultiplayerLineup field'
);

replaceOnce(
  `          raceSkill: meta.raceSkill || null,
          racerId: meta.racerId || null,`,
  `          learnedSkills: [...(meta.learnedSkills || getRacerLearnedSkills(meta))],
          raceSkill: meta.raceSkill || syncPrimaryRaceSkill(meta.learnedSkills) || null,
          racerId: meta.racerId || null,`,
  'mergeServerRacers'
);

replaceOnce(
  `    function startNextTrainingPhase() {
      gameState.trackIndex = (gameState.trackIndex || 0) + 1;
      gameState.turn = 1;
      if (gameState.player.raceSkill) {
        gameState.player.learnedSkills = recordLearnedSkill(
          gameState.player.learnedSkills || [],
          gameState.player.raceSkill
        );
      }
      gameState.bonusOffered = false;`,
  `    function startNextTrainingPhase() {
      gameState.trackIndex = (gameState.trackIndex || 0) + 1;
      gameState.turn = 1;
      gameState.player.raceSkill = syncPrimaryRaceSkill(gameState.player.learnedSkills || []);
      gameState.bonusOffered = false;`,
  'startNextTrainingPhase'
);

replaceOnce(
  `    function updateSkillDisplay() {
      const el = document.getElementById('skill-picked');
      const skill = getRaceSkill(gameState.player.raceSkill);
      if (!skill) {
        el.classList.add('hidden');
        el.textContent = '';
        return;
      }
      el.classList.remove('hidden');
      el.innerHTML = \`<strong>RACE SKILL</strong><br>\${skill.name} ${em} \${skill.description}\`;
    }`,
  `    function formatLearnedSkillsHtml(skillIds) {
      return (skillIds || []).map((skillId) => {
        const skill = getRaceSkill(skillId);
        return skill ? \`\${skill.name} ${em} \${skill.description}\` : skillId;
      }).join('<br>');
    }

    function updateSkillDisplay() {
      const el = document.getElementById('skill-picked');
      const skills = gameState.player.learnedSkills || [];
      if (!skills.length) {
        el.classList.add('hidden');
        el.textContent = '';
        return;
      }
      el.classList.remove('hidden');
      el.innerHTML = \`<strong>RACE SKILLS</strong><br>\${formatLearnedSkillsHtml(skills)}\`;
    }`,
  'updateSkillDisplay'
);

replaceOnce(
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
  `    function canOfferSkillBonusLocal() {
      return getAvailableSkillIds(gameState.player.learnedSkills || []).length > 0;
    }

    function grantRandomRaceSkillLocal() {
      const learnedSkills = gameState.player.learnedSkills || [];
      const skillId = pickRandomRaceSkill(learnedSkills);
      if (!skillId) return null;
      gameState.player.learnedSkills = recordLearnedSkill(learnedSkills, skillId);
      gameState.player.raceSkill = syncPrimaryRaceSkill(gameState.player.learnedSkills);
      return skillId;
    }`,
  'grant skill local'
);

replaceOnce(
  `      if (next === 'skill-reveal') {
        showSkillRevealModal(gameState.player.raceSkill, () => advanceTurn());
        return;
      }`,
  `      if (next === 'skill-reveal') {
        const latestSkill = gameState.player.learnedSkills?.[gameState.player.learnedSkills.length - 1];
        showSkillRevealModal(latestSkill, () => advanceTurn());
        return;
      }`,
  'skill reveal fallback'
);

replaceOnce(
  `    function appendRacerCardMeta(card, racer) {
      if (racer.isPlayer && gameState.player.raceSkill) {
        const skill = getRaceSkill(gameState.player.raceSkill);
        const skillEl = document.createElement('div');
        skillEl.className = 'lineup-skill';
        skillEl.textContent = \`SKILL: \${skill.name}\`;
        card.appendChild(skillEl);
      } else if (racer.isHuman && racer.raceSkill) {
        const skill = getRaceSkill(racer.raceSkill);
        const skillEl = document.createElement('div');
        skillEl.className = 'lineup-skill';
        skillEl.textContent = \`SKILL: \${skill.name}\`;
        card.appendChild(skillEl);
      } else if (!racer.isPlayer && !racer.isHuman) {`,
  `    function appendLearnedSkillsToCard(card, racer) {
      const skillIds = racer.isPlayer
        ? (gameState.player.learnedSkills || getRacerLearnedSkills(racer))
        : getRacerLearnedSkills(racer);
      skillIds.forEach((skillId) => {
        const skill = getRaceSkill(skillId);
        if (!skill) return;
        const skillEl = document.createElement('div');
        skillEl.className = 'lineup-skill';
        skillEl.textContent = \`SKILL: \${skill.name}\`;
        card.appendChild(skillEl);
      });
    }

    function appendRacerCardMeta(card, racer) {
      const learned = getRacerLearnedSkills(racer.isPlayer
        ? { ...racer, learnedSkills: gameState.player.learnedSkills, raceSkill: gameState.player.raceSkill }
        : racer);
      if (learned.length) {
        appendLearnedSkillsToCard(card, racer);
      } else if (!racer.isPlayer && !racer.isHuman) {`,
  'appendRacerCardMeta'
);

replaceOnce(
  `        raceSkill: racer.isPlayer ? (gameState.player.raceSkill || racer.raceSkill || null) : racer.raceSkill,
        lane,`,
  `        learnedSkills: racer.isPlayer
          ? [...(gameState.player.learnedSkills || [])]
          : [...getRacerLearnedSkills(racer)],
        raceSkill: racer.isPlayer
          ? syncPrimaryRaceSkill(gameState.player.learnedSkills || [])
          : syncPrimaryRaceSkill(getRacerLearnedSkills(racer)),
        lane,`,
  'createRacerState'
);

replaceOnce(
  `    function getRacerRaceSkill(racer) {
      if (racer.isPlayer) return gameState.player.raceSkill || racer.raceSkill || null;
      return racer.raceSkill || null;
    }

    function getEffectiveStamina(racer) {`,
  `    function getRacerLearnedSkillsForRace(racer) {
      if (racer.isPlayer) {
        return gameState.player.learnedSkills?.length
          ? [...gameState.player.learnedSkills]
          : getRacerLearnedSkills(racer);
      }
      return getRacerLearnedSkills(racer);
    }

    function getEffectiveStamina(racer) {`,
  'getRacerLearnedSkillsForRace'
);

replaceOnce(
  `    function applyRaceSkills(racer) {
      if (!racer.isPlayer) return;
      const raceSkill = getRacerRaceSkill(racer);
      if (!raceSkill) return;

      const progress = getLapProgress(racer.position);

      if (raceSkill === 'secondWind' && !racer.skillTriggers.secondWind && progress >= 0.5) {
        racer.skillTriggers.secondWind = true;
        racer.stats.stamina += 10;
        racer.staminaDrain = Math.max(0, racer.staminaDrain - 10);
        racer.staminaPenalty = false;
        gameState.eventLog.push('Second Wind! +10 Stamina ${em} fatigue held back!');
      }

      if (raceSkill === 'midraceSurge' && !racer.skillTriggers.midraceSurge && progress >= 0.5) {
        racer.skillTriggers.midraceSurge = true;
        racer.currentSpeed += 20;
        gameState.eventLog.push('Midrace Surge! +20 Speed!');
      }

      if (raceSkill === 'finalKick' && !racer.skillTriggers.finalKick && progress >= 0.75) {
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
  `    function applyRaceSkills(racer) {
      const skills = getRacerLearnedSkillsForRace(racer);
      if (!skills.length) return;

      const progress = getLapProgress(racer.position);
      const hasSkill = (id) => skills.includes(id);
      const logSkill = (msg) => {
        if (racer.isPlayer) gameState.eventLog.push(msg);
      };

      if (hasSkill('secondWind') && !racer.skillTriggers.secondWind && progress >= 0.5) {
        racer.skillTriggers.secondWind = true;
        racer.stats.stamina += 10;
        racer.staminaDrain = Math.max(0, racer.staminaDrain - 10);
        racer.staminaPenalty = false;
        logSkill('Second Wind! +10 Stamina ${em} fatigue held back!');
      }

      if (hasSkill('midraceSurge') && !racer.skillTriggers.midraceSurge && progress >= 0.5) {
        racer.skillTriggers.midraceSurge = true;
        racer.currentSpeed += 20;
        logSkill('Midrace Surge! +20 Speed!');
      }

      if (hasSkill('finalKick') && !racer.skillTriggers.finalKick && progress >= 0.75) {
        racer.skillTriggers.finalKick = true;
        racer.currentSpeed += 30;
        logSkill('Final Kick! +30 Speed!');
      }

      if (hasSkill('photoFinish') && !racer.skillTriggers.photoFinish && progress >= PHOTO_FINISH_PROGRESS) {
        racer.skillTriggers.photoFinish = true;
        const boost = getPhotoFinishBoost(racer, gameState.racers);
        racer.currentSpeed += boost;
        logSkill(
          boost > PHOTO_FINISH_SPEED
            ? \`Photo Finish! +\${boost} Speed ${em} closing the gap!\`
            : \`Photo Finish! +\${boost} Speed!\`
        );
      }
    }`,
  'applyRaceSkills client'
);

replaceOnce(
  `      const skill = getRaceSkill(gameState.player.raceSkill);
      gameState.eventLog = skill
        ? [\`The race has begun! Hurdles at 15% & 60% ${em} Agility recovers speed!\`, \`Skill ready: \${skill.name}\`]
        : [\`The race has begun! Go \${gameState.player.name}!\`, 'Hurdles at 15% & 60% ${em} Agility recovers speed!'];`,
  `      const readySkills = (gameState.player.learnedSkills || [])
        .map((id) => getRaceSkill(id)?.name)
        .filter(Boolean);
      gameState.eventLog = readySkills.length
        ? [\`The race has begun! Hurdles at 15% & 60% ${em} Agility recovers speed!\`, \`Skills ready: \${readySkills.join(', ')}\`]
        : [\`The race has begun! Go \${gameState.player.name}!\`, 'Hurdles at 15% & 60% ${em} Agility recovers speed!'];`,
  'solo race start log'
);

replaceOnce(
  `      const skill = getRaceSkill(gameState.player.raceSkill);
      gameState.eventLog = skill
        ? ['The race has begun! Hurdles at 15% & 60% ${em} Agility recovers speed!', \`Skill ready: \${skill.name}\`]
        : [\`The race has begun! Go \${gameState.player.name}!\`, 'Hurdles at 15% & 60% ${em} Agility recovers speed!'];`,
  `      const readySkills = (gameState.player.learnedSkills || [])
        .map((id) => getRaceSkill(id)?.name)
        .filter(Boolean);
      gameState.eventLog = readySkills.length
        ? ['The race has begun! Hurdles at 15% & 60% ${em} Agility recovers speed!', \`Skills ready: \${readySkills.join(', ')}\`]
        : [\`The race has begun! Go \${gameState.player.name}!\`, 'Hurdles at 15% & 60% ${em} Agility recovers speed!'];`,
  'multiplayer race start log'
);

writeFileSync(indexPath, content);
console.log('multiple skills support applied');