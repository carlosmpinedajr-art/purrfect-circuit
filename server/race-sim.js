const { createRng } = require('./rng');

const RACE_LANE_COUNT = 6;
const STAMINA_REQUIREMENT = 15;
const LAP_LENGTH = 1000;
const TOTAL_LAPS = 1;
const RACE_LENGTH = LAP_LENGTH * TOTAL_LAPS;
const STAMINA_CHECK_POINT = 0.75;
const HURDLE_PROGRESSES = [0.15, 0.60];
const HURDLE_JUMP_LEAD = 24;
const HURDLE_CLEAR_TRAIL = 12;
const HURDLE_SPEED_MULTIPLIER = 0.5;
const HURDLE_RECOVERY_BASE_SEC = 3;
const CPU_STAT_MIN = 1;
const CPU_RACE_STAT_TOTAL = 20;
const CPU_MIN_RACE_SPEED = 5;
const PACE_VARIANCE_MAX = 0.10;
const PACE_VARIANCE_MIN = 0.04;
const PACE_FLOOR_MIN = 0.95;
const PACE_FLOOR_MAX = 0.98;
const PACE_FOCUS_BASE = 5;
const PACE_FOCUS_SCALE = 15;

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

function allHurdlesCleared(racer) {
  return racer.hurdlesCleared?.every(Boolean);
}

function getLapProgress(position) {
  if (position >= RACE_LENGTH) return 1;
  return (position % LAP_LENGTH) / LAP_LENGTH;
}

function calcBaseSpeed(racer) {
  return racer.stats.speed * 2.5;
}

function getFocusPaceTuning(focus) {
  const t = Math.min(1, Math.max(0, ((focus ?? PACE_FOCUS_BASE) - PACE_FOCUS_BASE) / PACE_FOCUS_SCALE));
  return {
    floor: PACE_FLOOR_MIN + t * (PACE_FLOOR_MAX - PACE_FLOOR_MIN),
    variance: PACE_VARIANCE_MAX - t * (PACE_VARIANCE_MAX - PACE_VARIANCE_MIN)
  };
}

function getPaceVarianceMultiplier(racer, rng) {
  const tuning = getFocusPaceTuning(racer.stats?.focus);
  return tuning.floor + rng.next() * tuning.variance;
}

function rollRandomCpuStats(rng, total = CPU_RACE_STAT_TOTAL) {
  const stats = { speed: CPU_STAT_MIN, stamina: CPU_STAT_MIN, agility: CPU_STAT_MIN, focus: CPU_STAT_MIN };
  const keys = ['speed', 'stamina', 'agility', 'focus'];
  let remaining = total - CPU_STAT_MIN * keys.length;
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
    raceSkill: p.raceSkill || null,
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
    raceSkill: entry.raceSkill,
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
    passingCooldown: 0,
    animOffset: entry.animOffset || 0,
    hurdlesCleared: createHurdlesClearedState(),
    activeHurdleIndex: -1,
    jumping: false,
    jumpTimer: 0,
    hurdleRecovering: false,
    hurdleRecoveryTimer: 0,
    hurdleRecoveryDuration: 0,
    hurdleRecoveryTarget: 0
  };
  if (!state.playerId) {
    state.currentSpeed = Math.max(state.currentSpeed, CPU_MIN_RACE_SPEED);
  }
  return state;
}

function getHurdleRecoveryDuration(agility) {
  const recoveryRate = 1 + (agility / 10) * 0.1;
  return HURDLE_RECOVERY_BASE_SEC / recoveryRate;
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

function applyRaceSkills(racer, events) {
  const raceSkill = racer.raceSkill;
  if (!raceSkill) return;

  const progress = getLapProgress(racer.position);

  if (raceSkill === 'secondWind' && !racer.skillTriggers.secondWind && progress >= 0.5) {
    racer.skillTriggers.secondWind = true;
    racer.stats.stamina += 10;
    racer.staminaDrain = Math.max(0, racer.staminaDrain - 10);
    racer.staminaPenalty = false;
    if (racer.playerId) {
      pushEvent(events, racer, 'Second Wind! +10 Stamina — fatigue held back!');
    }
  }

  if (raceSkill === 'midraceSurge' && !racer.skillTriggers.midraceSurge && progress >= 0.5) {
    racer.skillTriggers.midraceSurge = true;
    racer.currentSpeed += 20;
    if (racer.playerId) {
      pushEvent(events, racer, 'Midrace Surge! +20 Speed!');
    }
  }

  if (raceSkill === 'finalKick' && !racer.skillTriggers.finalKick && progress >= 0.75) {
    racer.skillTriggers.finalKick = true;
    racer.currentSpeed += 30;
    if (racer.playerId) {
      pushEvent(events, racer, 'Final Kick! +30 Speed!');
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
    racer.currentSpeed = racer.hurdleRecoveryTarget * (HURDLE_SPEED_MULTIPLIER + (1 - HURDLE_SPEED_MULTIPLIER) * t);
    if (t >= 1) {
      racer.hurdleRecovering = false;
      racer.currentSpeed = racer.hurdleRecoveryTarget;
    }
  }

  const zones = getHurdleZones();
  let inJumpZone = false;

  for (let i = 0; i < zones.length; i++) {
    if (racer.hurdlesCleared[i]) continue;
    const zone = zones[i];

    if (racer.position >= zone.clearPos) {
      racer.hurdlesCleared[i] = true;
      racer.jumping = false;
      racer.activeHurdleIndex = -1;
      racer.hurdleRecoveryTarget = racer.currentSpeed;
      racer.currentSpeed = racer.hurdleRecoveryTarget * HURDLE_SPEED_MULTIPLIER;
      racer.hurdleRecovering = true;
      racer.hurdleRecoveryTimer = 0;
      racer.hurdleRecoveryDuration = getHurdleRecoveryDuration(racer.stats.agility);

      if (racer.playerId) {
        const secs = racer.hurdleRecoveryDuration.toFixed(1);
        pushEvent(events, racer, `Hurdle ${i + 1} cleared! -50% speed, recovering in ${secs}s`);
      }
      continue;
    }

    if (racer.position >= zone.jumpStart && racer.position < zone.clearPos) {
      if (!racer.jumping) racer.jumpTimer = 0;
      racer.jumping = true;
      racer.activeHurdleIndex = i;
      racer.jumpTimer += dt;
      inJumpZone = true;
      break;
    }
  }

  if (!inJumpZone) {
    racer.jumping = false;
    racer.activeHurdleIndex = -1;
  }

  if (allHurdlesCleared(racer)) {
    racer.jumping = false;
    racer.activeHurdleIndex = -1;
  }
}

function createRaceState(room) {
  const rng = createRng(room.seed ^ 0x9e3779b9);
  return {
    running: true,
    finished: false,
    time: 0,
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
    applyRaceSkills(racer, events);
    updateHurdleForRacer(racer, dt, events);

    if (!racer.playerId && !racer.finished) {
      racer.currentSpeed = Math.max(racer.currentSpeed, CPU_MIN_RACE_SPEED);
    }

    if (!racer.staminaChecked && lapProgress >= STAMINA_CHECK_POINT) {
      racer.staminaChecked = true;
      const effectiveStamina = getEffectiveStamina(racer);
      const secondWindSave = racer.skillTriggers?.secondWind;
      if (effectiveStamina < STAMINA_REQUIREMENT && !secondWindSave) {
        racer.staminaPenalty = true;
        if (racer.playerId) {
          pushEvent(events, racer, 'Stamina fading! Speed -25%!');
        }
      } else if (secondWindSave && racer.playerId) {
        pushEvent(events, racer, 'Second Wind keeps your pace strong!');
      }
    }

    let speed = racer.currentSpeed;
    if (racer.staminaPenalty) speed *= 0.75;

    if (racer.passingCooldown > 0) {
      racer.passingCooldown -= dt;
    }

    const ahead = race.racers
      .filter((r) => !r.finished && r.position > racer.position && r.position - racer.position < 30)
      .sort((a, b) => a.position - b.position)[0];

    if (ahead && racer.passingCooldown <= 0) {
      const passChance = racer.stats.agility / (racer.stats.agility + ahead.stats.agility + 5);
      if (race.rng.next() < passChance * dt * 0.5) {
        const boost = 15 + racer.stats.agility * 2;
        racer.position = Math.min(racer.position + boost, ahead.position + 5);
        racer.passingCooldown = 2;
        if (racer.playerId) {
          pushEvent(events, racer, `Passed ${ahead.name}!`);
        }
        if (ahead.playerId) {
          pushEvent(events, ahead, `${racer.name} passed you!`, ahead.playerId);
        }
      }
    }

    speed *= getPaceVarianceMultiplier(racer, race.rng);
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
    time: race.time
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
  if (racer?.staminaPenalty) speed *= 0.75;
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