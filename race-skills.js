const RACE_SKILLS = [
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
  },
  {
    id: 'photoFinish',
    name: 'Photo Finish',
    description: 'At 90% lap: +25 Speed (+35 if not 1st)'
  }
];

const VALID_SKILL_IDS = RACE_SKILLS.map((skill) => skill.id);

const PHOTO_FINISH_PROGRESS = 0.9;
const PHOTO_FINISH_SPEED = 25;
const PHOTO_FINISH_CATCHUP_SPEED = 35;

function getAvailableSkillIds(learnedSkillIds = []) {
  const learned = new Set(learnedSkillIds);
  return VALID_SKILL_IDS.filter((id) => !learned.has(id));
}

const SKILL_CHOICE_COUNT = 2;

function pickRandomRaceSkill(learnedSkillIds = []) {
  const pool = getAvailableSkillIds(learnedSkillIds);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomRaceSkillChoices(learnedSkillIds = [], count = SKILL_CHOICE_COUNT) {
  const pool = [...getAvailableSkillIds(learnedSkillIds)];
  const choices = [];
  const pickCount = Math.min(count, pool.length);
  while (choices.length < pickCount && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(idx, 1)[0]);
  }
  return choices;
}

function recordLearnedSkill(learnedSkillIds, skillId) {
  const learned = Array.isArray(learnedSkillIds) ? [...learnedSkillIds] : [];
  if (skillId && !learned.includes(skillId)) {
    learned.push(skillId);
  }
  return learned;
}

function syncPrimaryRaceSkill(learnedSkillIds = []) {
  if (!learnedSkillIds.length) return null;
  return learnedSkillIds[learnedSkillIds.length - 1];
}

function getRacerLearnedSkills(racer) {
  if (!racer) return [];
  if (Array.isArray(racer.learnedSkills) && racer.learnedSkills.length) {
    return [...racer.learnedSkills];
  }
  return racer.raceSkill ? [racer.raceSkill] : [];
}

function getRaceSkillById(id) {
  return RACE_SKILLS.find((skill) => skill.id === id) || null;
}

function getRacerPlace(racer, racers) {
  const sorted = [...racers].sort((a, b) => b.position - a.position);
  return sorted.findIndex((entry) => entry.id === racer.id) + 1;
}

function getPhotoFinishBoost(racer, racers) {
  const place = getRacerPlace(racer, racers);
  const raw = place > 1 ? PHOTO_FINISH_CATCHUP_SPEED : PHOTO_FINISH_SPEED;
  if (typeof scaleSkillSpeedBoost === 'function') return scaleSkillSpeedBoost(raw);
  if (typeof module !== 'undefined' && module.exports) {
    return require('./racer-stats').scaleSkillSpeedBoost(raw);
  }
  return raw;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RACE_SKILLS,
    VALID_SKILL_IDS,
    PHOTO_FINISH_PROGRESS,
    PHOTO_FINISH_SPEED,
    PHOTO_FINISH_CATCHUP_SPEED,
    SKILL_CHOICE_COUNT,
    getAvailableSkillIds,
    pickRandomRaceSkill,
    pickRandomRaceSkillChoices,
    recordLearnedSkill,
    syncPrimaryRaceSkill,
    getRacerLearnedSkills,
    getRaceSkillById,
    getRacerPlace,
    getPhotoFinishBoost
  };
}