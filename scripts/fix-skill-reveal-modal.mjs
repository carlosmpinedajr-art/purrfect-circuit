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
  `    .skill-btn .skill-name { display: block; color: #ffd700; margin-bottom: 6px; font-size: 9px; }
    .skill-picked {`,
  `    .skill-btn .skill-name { display: block; color: #ffd700; margin-bottom: 6px; font-size: 9px; }
    .skill-reveal-card {
      font-family: 'Press Start 2P', monospace;
      font-size: 8px;
      padding: 14px;
      background: #1a0a2e;
      border: 3px solid #ffd700;
      color: #fff;
      text-align: left;
      line-height: 1.7;
      cursor: default;
    }
    .skill-reveal-card .skill-name {
      display: block;
      color: #ffd700;
      margin-bottom: 6px;
      font-size: 9px;
    }
    .skill-confirm-btn {
      margin-top: 4px;
      width: 100%;
      text-align: center;
    }
    .skill-picked {`,
  'skill reveal css'
);

replaceOnce(
  `    function grantRandomRaceSkillLocal() {
      if (gameState.player.raceSkill) return null;
      const skillId = pickRandomRaceSkill();
      gameState.player.raceSkill = skillId;
      updateSkillDisplay();
      return skillId;
    }`,
  `    function grantRandomRaceSkillLocal() {
      if (gameState.player.raceSkill) return null;
      const skillId = pickRandomRaceSkill();
      gameState.player.raceSkill = skillId;
      return skillId;
    }`,
  'defer skill display'
);

replaceOnce(
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
      btn.textContent = "LET'S GO!";
      btn.onclick = () => {
        updateSkillDisplay();
        modal.classList.add('hidden');
        if (callback) callback();
      };
      options.appendChild(btn);

      modal.classList.remove('hidden');
    }`,
  `    function showSkillRevealModal(skillId, callback) {
      const modal = document.getElementById('skill-modal');
      const options = document.getElementById('skill-options');
      const prompt = document.getElementById('skill-reveal-text');
      const title = modal?.querySelector('h3');
      const skill = getRaceSkill(skillId);
      options.innerHTML = '';

      if (title) {
        title.textContent = skill ? \`\${skill.name.toUpperCase()} UNLOCKED!\` : 'RACE SKILL UNLOCKED!';
      }

      if (prompt) {
        prompt.textContent = skill
          ? \`You learned this ability during training.\`
          : 'You learned a new ability during training.';
      }

      if (skill) {
        const card = document.createElement('div');
        card.className = 'skill-reveal-card';
        card.innerHTML = \`<span class="skill-name">\${skill.name}</span>\${skill.description}\`;
        options.appendChild(card);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn skill-confirm-btn';
      btn.textContent = "LET'S GO!";
      btn.onclick = () => {
        updateSkillDisplay();
        if (title) title.textContent = 'RACE SKILL UNLOCKED!';
        modal.classList.add('hidden');
        if (callback) callback();
      };
      options.appendChild(btn);

      modal.classList.remove('hidden');
    }`,
  'skill reveal modal'
);

writeFileSync(indexPath, content);
console.log('skill reveal modal fixed');