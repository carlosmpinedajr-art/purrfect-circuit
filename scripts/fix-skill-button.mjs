import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const indexPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let content = readFileSync(indexPath, 'utf8');

content = content.replace(
  "btn.textContent = 'LET'S GO!';",
  'btn.textContent = "LET\'S GO!";'
);

content = content.replace(
  `      gameState.bonusOffered = false;
      gameState.bonusDoneThisTurn = false;
      updateTrainingUI();`,
  `      gameState.bonusOffered = false;
      gameState.bonusDoneThisTurn = false;
      gameState.bonusType = null;
      updateTrainingUI();`
);

writeFileSync(indexPath, content);
console.log('fixed skill button and bonusType reset');