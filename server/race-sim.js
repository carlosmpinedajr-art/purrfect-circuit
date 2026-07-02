const { createRng } = require('./rng');
const { getTrack } = require('../tracks');
const {
  PHOTO_FINISH_PROGRESS,
  getPhotoFinishBoost,
  getRacerLearnedSkills,
  syncPrimaryRaceSkill
} = require('../race-skills');

const RACE_LANE_COUNT = 6;
const LAP_LENGTH = 1000;
const TOTAL_LAPS = 1;
const RACE_LENGTH = LAP_LENGTH * TOTAL_LAPS;
const STAMINA_CHECK_POINT = 0.75;
const STAMINA_PENALTY_SPEED_MULT = 0.2;
const HURDLE_PROGRESSES = [0.15, 0.60];
const HURDLE_JUMP_LEAD = 24;
const HURDLE_CLEAR_TRAIL = 8;
const HURDLE_JUMP_DURATION = 0.5;
const HURDLE_JUMP_MIN_HALF = 18;
const CPU_STAT_MIN = 1;
const CPU_RACE_STAT_TOTAL = 100;
const CPU_MIN_SPEED_STAT = 35;
const {
  getFocusPaceTuning,
  getHurdleRecoveryDuration,
  getHurdleSpeedMultiplier,
  getAgilityHurdleEffectiveness,
  CPU_MIN_RACE_SPEED,
  calcBaseSpeed,
  scaleSkillSpeedBoost
} = require('../racer-stats');

const DEFAULT_CPU_RUNNERS = [
  { name: 'Kitty Litter' },
  { name: 'Luna' },
  { name: 'Sakura' },
  { name: 'Hana' },
  { name: 'Yuki' }
];

const CPU_RACER_STYLES = [
  { id: 'cpu-mint', label: 'MINT' },
  { id: 'cpu-rose', label: 'ROSE' },
  { id: 'cpu-sky', label: 'SKY' },
  { id: 'cpu-lime', label: 'LIME' },
  { id: 'cpu-violet', label: 'VIOLET' }
];

function getHurdleZones() {
  return HURDLE_PROGRESSES.map((progress, index) => {
    const position = LAP_LENGTH * progress;
    return {
      index,
      progress,
      position,
      jumpStart: position - HURDLE_JUMP_LEAD,
      clearPos: position + HURDLE_CLEAR_TRAIL
    };
  });
}

function createHurdlesClearedState() {
  return HURDLE_PROGRESSES.map(() => false);
}

function createHurdleJumpTriggeredState() {
  return HURDLE_PROGRESSES.map(() => false);
}

function getHurdleJumpHalfDistance(racer) {
  const speed = getRacerMovementSpeed(racer);
  return Math.max(HURDLE_JUMP_MIN_HALF, speed * HURDLE_JUMP_DURATION * 0.5);
}

function shouldTriggerHurdleJump(racer, zone) {
  const halfDist = getHurdleJumpHalfDistance(racer);
  return racer.position >= zone.position - halfDist;
}

function beginHurdleJump(racer, hurdleIndex) {
  const zone = getHurdleZones()[hurdleIndex];
  const halfDist = getHurdleJumpHalfDistance(racer);
  racer.jumping = true;
  racer.jumpTimer = 0;
  racer.activeHurdleIndex = hurdleIndex;
  racer.jumpTakeoffPos = zone.position - halfDist;
  racer.jumpHurdlePos = zone.position;
  racer.jumpLandPos = zone.position + halfDist;

  const span = racer.jumpLandPos - racer.jumpTakeoffPos;
  if (span > 0 && racer.position > racer.jumpTakeoffPos) {
const traveled = Math.min(span, racer.position - racer.jumpTakeoffPos);
const progress = traveled / span;
racer.jumpTimer = Math.min(
  HURDLE_JUMP_DURATION * 0.92,
  progress * HURDLE_JUMP_DURATION
);
  }
}

function finishHurdleJump(racer) {
  racer.jumping = false;
  racer.activeHurdleIndex = -1;
  racer.jumpTimer = HURDLE_JUMP_DURATION;
}

function tryStartPendingHurdleJump(racer) {
  if (racer.jumping || racer.finished) return;
  if (!Number.isFinite(racer.pendingHurdleJumpIndex) || racer.pendingHurdleJumpIndex < 0) return;
  const idx = racer.pendingHurdleJumpIndex;
  racer.pendingHurdleJumpIndex = -1;
  beginHurdleJump(racer, idx);
}

function allHurdlesCleared(racer) {
  return racer.hurdlesCleared?.every(Boolean);
}

function getLapProgress(position) {
  if (position >= RACE_LENGTH) return 1;
  return (position % LAP_LENGTH) / LAP_LENGTH;
}

function getPaceVarianceMultiplier(racer, rng) {
  const tuning = getFocusPaceTuning(racer.stats?.focus);
  return tuning.floor + rng.next() * tuning.variance;
}

function rollRandomCpuStats(rng, total = CPU_RACE_STAT_TOTAL) {
  const keys = ['speed', 'stamina', 'agility', 'focus'];
  const stats = {
    speed: CPU_MIN_SPEED_STAT,
    stamina: CPU_STAT_MIN,
    agility: CPU_STAT_MIN,
    focus: CPU_STAT_MIN
  };
  let remaining = total - CPU_MIN_SPEED_STAT - CPU_STAT_MIN * 3;
  while (remaining > 0) {
    stats[keys[Math.floor(rng.next() * keys.length)]]++;
    remaining--;
  }
  return stats;
}

function buildLineupField(room) {
  const rng = createRng(room.seed);
  const humans = Object.values(room.players).map((p, i) => ({
    id: p.id,
    playerId: p.id,
    name: p.name || 'Racer',
    stats: { ...p.stats },
    learnedSkills: [...(p.learnedSkills || [])],
    raceSkill: syncPrimaryRaceSkill(p.learnedSkills || []) || p.raceSkill || null,
    racerId: p.racerId || 'purple',
    isHuman: true,
    lane: i,
    animOffset: i * 0.35
  }));

  const cpuCount = Math.max(0, RACE_LANE_COUNT - humans.length);
  const cpus = [];
  for (let i = 0; i < cpuCount; i++) {
    const runner = DEFAULT_CPU_RUNNERS[i % DEFAULT_CPU_RUNNERS.length];
    const style = CPU_RACER_STYLES[(humans.length + i) % CPU_RACER_STYLES.length];
    cpus.push({
      id: `cpu-${i}`,
      playerId: null,
      name: runner.name,
      stats: rollRandomCpuStats(rng),
      raceSkill: null,
      racerId: null,
      cpuStyleId: style.id,
      isHuman: false,
      lane: humans.length + i,
      animOffset: (humans.length + i) * 0.35
    });
  }

  room.field = [...humans, ...cpus];
  return room.field;
}

function serializeFieldEntry(entry) {
  return {
    id: entry.id,
    playerId: entry.playerId,
    name: entry.name,
    stats: { ...entry.stats },
    learnedSkills: [...(entry.learnedSkills || getRacerLearnedSkills(entry))],
    raceSkill: entry.raceSkill || syncPrimaryRaceSkill(entry.learnedSkills),
    racerId: entry.racerId,
    cpuStyleId: entry.cpuStyleId || null,
    isHuman: !!entry.isHuman,
    lane: entry.lane,
    animOffset: entry.animOffset || 0
  };
}

function createRacerState(entry) {
  const state = {
    ...entry,
    lane: entry.lane,
    position: 0,
    currentSpeed: calcBaseSpeed(entry),
    staminaDrain: 0,
    staminaPenalty: false,
    staminaChecked: false,
    skillTriggers: {},
    finished: false,
    finishTime: null,
    animOffset: entry.animOffset || 0,
    hurdlesCleared: createHurdlesClearedState(),
    hurdleJumpTriggered: createHurdleJumpTriggeredState(),
    pendingHurdleJumpIndex: -1,
    activeHurdleIndex: -1,
    jumping: false,
    jumpTimer: 0,
    hurdleRecovering: false,
    hurdleRecoveryTimer: 0,
    hurdleRecoveryDuration: 0,
    hurdleRecoveryTarget: 0,
    hurdlePenaltyMult: getHurdleSpeedMultiplier(entry.stats?.agility),
    paceMultiplier: 1
  };
  if (!state.playerId) {
    state.currentSpeed = Math.max(state.currentSpeed, CPU_MIN_RACE_SPEED);
  }
  return state;
}

function getEffectiveStamina(racer) {
  const drainFactor = racer.skillTriggers?.secondWind ? 0.35 : 0.5;
  return racer.stats.stamina - racer.staminaDrain * drainFactor;
}

function pushEvent(events, racer, text, audiencePlayerId = null) {
  events.push({
    playerId: audiencePlayerId ?? racer.playerId ?? null,
    racerId: racer.id,
    text
  });
}

function applyRaceSkills(racer, events, allRacers) {
  const skills = getRacerLearnedSkills(racer);
  if (!skills.length) return;

  const progress = getLapProgress(racer.position);
  const hasSkill = (id) => skills.includes(id);

  if (hasSkill('secondWind') && !racer.skillTriggers.secondWind && progress >= 0.5) {
    racer.skillTriggers.secondWind = true;
    racer.stats.stamina += 10;
    racer.staminaDrain = Math.max(0, racer.staminaDrain - 10);
    racer.staminaPenalty = false;
    if (racer.playerId) {
      pushEvent(events, racer, 'Second Wind! +10 Stamina — fatigue held back!');
    }
  }

  if (hasSkill('midraceSurge') && !racer.skillTriggers.midraceSurge && progress >= 0.5) {
    racer.skillTriggers.midraceSurge = true;
    const surge = scaleSkillSpeedBoost(20);
    racer.currentSpeed += surge;
    if (racer.playerId) {
      pushEvent(events, racer, `Midrace Surge! +${surge} Speed!`);
    }
  }

  if (hasSkill('finalKick') && !racer.skillTriggers.finalKick && progress >= 0.75) {
    racer.skillTriggers.finalKick = true;
    const kick = scaleSkillSpeedBoost(30);
    racer.currentSpeed += kick;
    if (racer.playerId) {
      pushEvent(events, racer, `Final Kick! +${kick} Speed!`);
    }
  }

  if (hasSkill('photoFinish') && !racer.skillTriggers.photoFinish && progress >= PHOTO_FINISH_PROGRESS) {
    racer.skillTriggers.photoFinish = true;
    const boost = getPhotoFinishBoost(racer, allRacers || [racer]);
    racer.currentSpeed += boost;
    if (racer.playerId) {
      const leaderBoost = scaleSkillSpeedBoost(PHOTO_FINISH_SPEED);
      pushEvent(
        events,
        racer,
        boost > leaderBoost ? `Photo Finish! +${boost} Speed — closing the gap!` : `Photo Finish! +${boost} Speed!`
      );
    }
  }
}

function updateHurdleForRacer(racer, dt, events) {
  if (racer.finished) {
    racer.jumping = false;
    racer.activeHurdleIndex = -1;
    return;
  }

  if (racer.hurdleRecovering) {
    racer.hurdleRecoveryTimer += dt;
    const t = Math.min(1, racer.hurdleRecoveryTimer / racer.hurdleRecoveryDuration);
    const penaltyMult = racer.hurdlePenaltyMult ?? getHurdleSpeedMultiplier(racer.stats?.agility);
    racer.currentSpeed = racer.hurdleRecoveryTarget * (penaltyMult + (1 - penaltyMult) * t);
    if (t >= 1) {
      racer.hurdleRecovering = false;
      racer.currentSpeed = racer.hurdleRecoveryTarget;
    }
  }

  if (!racer.hurdleJumpTriggered) {
    racer.hurdleJumpTriggered = createHurdleJumpTriggeredState();
  }

  const zones = getHurdleZones();

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];

    if (!racer.hurdleJumpTriggered[i] && shouldTriggerHurdleJump(racer, zone)) {
      racer.hurdleJumpTriggered[i] = true;
      if (!racer.jumping) {
        beginHurdleJump(racer, i);
      } else if (racer.activeHurdleIndex !== i) {
        racer.pendingHurdleJumpIndex = i;
      }
    }

    if (!racer.hurdlesCleared[i] && racer.position >= zone.clearPos) {
      racer.hurdlesCleared[i] = true;
      racer.hurdleRecoveryTarget = racer.currentSpeed;
      racer.hurdlePenaltyMult = getHurdleSpeedMultiplier(racer.stats.agility);
      racer.currentSpeed = racer.hurdleRecoveryTarget * racer.hurdlePenaltyMult;
      racer.hurdleRecovering = true;
      racer.hurdleRecoveryTimer = 0;
      racer.hurdleRecoveryDuration = getHurdleRecoveryDuration(racer.stats.agility);

      if (racer.playerId) {
        const agiFx = getAgilityHurdleEffectiveness(racer.stats.agility);
        pushEvent(
          events,
          racer,
          `Hurdle ${i + 1} cleared! -${agiFx.penaltyPct}% speed, recovering in ${agiFx.recoverySec}s`
        );
      }
    }
  }

  if (racer.jumping) {
    racer.jumpTimer += dt;
    if (racer.jumpTimer >= HURDLE_JUMP_DURATION) {
      finishHurdleJump(racer);
      tryStartPendingHurdleJump(racer);
    }
  }

  if (allHurdlesCleared(racer) && !racer.jumping) {
    racer.activeHurdleIndex = -1;
    racer.pendingHurdleJumpIndex = -1;
  }
}

function createRaceState(room) {
  const track = getTrack(room.trackIndex || 0);
  const rng = createRng(room.seed ^ 0x9e3779b9);
  return {
    running: true,
    finished: false,
    time: 0,
    trackIndex: room.trackIndex || 0,
    trackName: track.subtitle,
    staminaRequirement: track.staminaRequirement,
    racers: (room.field || []).map(createRacerState),
    rng
  };
}

function serializeRacerTick(racer) {
  return {
    id: racer.id,
    playerId: racer.playerId,
    lane: racer.lane,
    position: racer.position,
    finished: racer.finished,
    finishTime: racer.finishTime,
    currentSpeed: racer.currentSpeed,
    paceMultiplier: racer.paceMultiplier ?? 1,
    staminaPenalty: racer.staminaPenalty,
    jumping: racer.jumping,
    jumpTimer: racer.jumpTimer,
    activeHurdleIndex: racer.activeHurdleIndex,
    hurdlesCleared: [...racer.hurdlesCleared],
    hurdleRecovering: racer.hurdleRecovering,
    hurdleRecoveryTimer: racer.hurdleRecoveryTimer,
    hurdleRecoveryDuration: racer.hurdleRecoveryDuration,
    hurdleRecoveryTarget: racer.hurdleRecoveryTarget
  };
}

function raceTick(race, dt) {
  if (!race.running || race.finished) return [];

  race.time += dt;
  const events = [];
  let allFinished = true;

  race.racers.forEach((racer) => {
    if (racer.finished) return;
    allFinished = false;

    racer.staminaDrain += dt * 0.8;
    const lapProgress = getLapProgress(racer.position);
    applyRaceSkills(racer, events, race.racers);
    updateHurdleForRacer(racer, dt, events);

    if (!racer.playerId && !racer.finished) {
      racer.currentSpeed = Math.max(racer.currentSpeed, CPU_MIN_RACE_SPEED);
    }

    if (!racer.staminaChecked && lapProgress >= STAMINA_CHECK_POINT) {
      racer.staminaChecked = true;
      const effectiveStamina = getEffectiveStamina(racer);
      const secondWindSave = racer.skillTriggers?.secondWind;
      if (effectiveStamina < race.staminaRequirement && !secondWindSave) {
        racer.staminaPenalty = true;
        if (racer.playerId) {
          pushEvent(events, racer, 'Stamina fading! Speed -80%!');
        }
      } else if (secondWindSave && racer.playerId) {
        pushEvent(events, racer, 'Second Wind keeps your pace strong!');
      }
    }

    let speed = racer.currentSpeed;
    if (racer.staminaPenalty) speed *= STAMINA_PENALTY_SPEED_MULT;

    const paceMult = getPaceVarianceMultiplier(racer, race.rng);
    racer.paceMultiplier = paceMult;
    speed *= paceMult;
    if (!racer.playerId) {
      speed = Math.max(speed, CPU_MIN_RACE_SPEED);
    }

    racer.position += speed * dt;

    if (racer.position >= RACE_LENGTH) {
      racer.position = RACE_LENGTH;
      racer.finished = true;
      racer.finishTime = race.time;
      if (racer.playerId) {
        pushEvent(events, racer, `Lap ${TOTAL_LAPS} complete — finish line!`);
      }
    }
  });

  if (allFinished || race.racers.every((r) => r.finished)) {
    race.running = false;
    race.finished = true;
  }

  return events;
}

function serializeRaceStart(room, race) {
  return {
    field: (room.field || []).map(serializeFieldEntry),
    racers: race.racers.map(serializeRacerTick),
    time: race.time,
    trackIndex: race.trackIndex,
    trackName: race.trackName,
    staminaRequirement: race.staminaRequirement
  };
}

function serializeRaceTick(race, events) {
  return {
    t: race.time,
    racers: race.racers.map(serializeRacerTick),
    events: events || [],
    finished: race.finished
  };
}

function serializeRaceResults(race) {
  const sorted = [...race.racers].sort((a, b) => {
    if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
    return b.position - a.position;
  });
  return {
    standings: sorted.map((r, i) => ({
      place: i + 1,
      id: r.id,
      playerId: r.playerId,
      name: r.name,
      finishTime: r.finishTime,
      racerId: r.racerId,
      cpuStyleId: r.cpuStyleId
    }))
  };
}

function getEffectiveRaceSpeed(racer) {
  let speed = racer?.currentSpeed || 0;
  if (racer?.staminaPenalty) speed *= STAMINA_PENALTY_SPEED_MULT;
  return speed;
}

function getExpectedPaceMultiplier(racer) {
  const tuning = getFocusPaceTuning(racer.stats?.focus);
  return tuning.floor + tuning.variance * 0.5;
}

function getRacerMovementSpeed(racer) {
  let speed = getEffectiveRaceSpeed(racer);
  if (!racer?.playerId) speed = Math.max(speed, CPU_MIN_RACE_SPEED);
  return speed;
}

function getProjectedFinishTime(racer, currentTime) {
  const remaining = Math.max(0, RACE_LENGTH - racer.position);
  if (remaining <= 0) return currentTime;
  const speed = getRacerMovementSpeed(racer) * getExpectedPaceMultiplier(racer);
  if (speed <= 0) return currentTime + remaining;
  return currentTime + remaining / speed;
}

function skipRace(race) {
  if (!race || race.finished) return { error: 'No active race' };
  const currentTime = race.time;
  race.racers.forEach((racer) => {
    racer.finishTime = getProjectedFinishTime(racer, currentTime);
    racer.position = RACE_LENGTH;
    racer.finished = true;
    racer.jumping = false;
    racer.hurdleRecovering = false;
    racer.activeHurdleIndex = -1;
  });
  race.running = false;
  race.finished = true;
  return {
    ok: true,
    events: [{ playerId: null, racerId: null, text: 'Race skipped — showing results.' }]
  };
}

function serializeRaceSync(room) {
  if (!room.race) return null;
  return {
    field: (room.field || []).map(serializeFieldEntry),
    racers: room.race.racers.map(serializeRacerTick),
    time: room.race.time,
    finished: room.race.finished,
    trackIndex: room.race.trackIndex,
    trackName: room.race.trackName,
    staminaRequirement: room.race.staminaRequirement,
    results: room.race.finished ? serializeRaceResults(room.race) : null
  };
}

function stopRace(room) {
  if (!room) return;
  if (room.raceTimer) {
    clearInterval(room.raceTimer);
    room.raceTimer = null;
  }
}

module.exports = {
  RACE_LANE_COUNT,
  buildLineupField,
  serializeFieldEntry,
  createRaceState,
  raceTick,
  serializeRaceStart,
  serializeRaceTick,
  serializeRaceResults,
  serializeRaceSync,
  skipRace,
  stopRace
};