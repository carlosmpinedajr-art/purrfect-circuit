const TRACKS = [
  {
    id: 'mile',
    name: 'Mile Track',
    subtitle: 'MILE TRACK',
    staminaRequirement: 15
  },
  {
    id: 'medium',
    name: 'Medium Track',
    subtitle: 'MEDIUM TRACK',
    staminaRequirement: 30
  },
  {
    id: 'long',
    name: 'Long Track',
    subtitle: 'LONG TRACK',
    staminaRequirement: 150
  }
];

function getTrack(index) {
  const idx = Number.isFinite(index) ? index : 0;
  return TRACKS[idx] || TRACKS[TRACKS.length - 1];
}

function getTrackCount() {
  return TRACKS.length;
}

function hasMoreTracks(index) {
  return index < TRACKS.length - 1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRACKS,
    getTrack,
    getTrackCount,
    hasMoreTracks
  };
}