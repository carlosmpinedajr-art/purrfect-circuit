import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const indexPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let content = readFileSync(indexPath, 'utf8');
const old = `      multiplayer.room = res;
      multiplayer.localReady = !!getLocalRoomPlayer()?.ready;`;
const neu = `      multiplayer.room = res;
      if (res.trackIndex != null) gameState.trackIndex = res.trackIndex;
      multiplayer.localReady = !!getLocalRoomPlayer()?.ready;`;
if (!content.includes(old)) throw new Error('block not found');
writeFileSync(indexPath, content.replace(old, neu));
console.log('patched reconnect trackIndex');