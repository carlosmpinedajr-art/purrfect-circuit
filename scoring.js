const PLACEMENT_POINTS = [10, 8, 6, 4, 2, 1];

function getRacePointsForPlace(place) {
  return PLACEMENT_POINTS[Math.max(0, Math.min(place - 1, PLACEMENT_POINTS.length - 1))] ?? 0;
}

function awardStandingsPoints(standings, totals = {}) {
  const nextTotals = { ...totals };
  const racePoints = {};

  standings.forEach((entry, index) => {
    const place = entry.place ?? index + 1;
    const key = entry.key ?? entry.id ?? entry.playerId ?? `place-${place}`;
    const pts = getRacePointsForPlace(place);
    racePoints[key] = pts;
    nextTotals[key] = (nextTotals[key] || 0) + pts;
  });

  return { racePoints, totals: nextTotals };
}

function buildRaceScoring(room, race) {
  const sorted = [...race.racers].sort((a, b) => {
    if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
    return b.position - a.position;
  });
  const racePointsById = {};
  const racePoints = [];

  sorted.forEach((racer, index) => {
    const place = index + 1;
    const points = getRacePointsForPlace(place);
    racePointsById[racer.id] = points;
    if (racer.playerId && room.players?.[racer.playerId]) {
      const player = room.players[racer.playerId];
      player.campaignPoints = (player.campaignPoints || 0) + points;
    }
    racePoints.push({ id: racer.id, playerId: racer.playerId, place, points });
  });

  const campaignTotals = Object.values(room.players || {})
    .map((p) => ({
      playerId: p.id,
      name: p.name || 'Racer',
      campaignPoints: p.campaignPoints || 0
    }))
    .sort((a, b) => b.campaignPoints - a.campaignPoints);

  return {
    trackIndex: room.trackIndex || 0,
    racePointsById,
    racePoints,
    campaignTotals
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLACEMENT_POINTS,
    getRacePointsForPlace,
    awardStandingsPoints,
    buildRaceScoring
  };
}