import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  GF_CAMERAS_DEFAULT,
  AA_CAMERAS_DEFAULT,
  FF_CAMERAS_DEFAULT,
  GF_ZONES_ACCURATE,
  AA_ZONES_ACCURATE,
  FF_ZONES_ACCURATE
} from '../frontend/src/features/layout-engine/templates/accurateBlueprintData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = {
  cameras: [
    ...GF_CAMERAS_DEFAULT.map(c => ({ ...c, floor: 0 })),
    ...AA_CAMERAS_DEFAULT.map(c => ({ ...c, floor: 1 })),
    ...FF_CAMERAS_DEFAULT.map(c => ({ ...c, floor: 2 }))
  ],
  zones: [
    ...GF_ZONES_ACCURATE.map(z => ({ ...z, floor: 0 })),
    ...AA_ZONES_ACCURATE.map(z => ({ ...z, floor: 1 })),
    ...FF_ZONES_ACCURATE.map(z => ({ ...z, floor: 2 }))
  ]
};

const outputPath = path.join(__dirname, 'blueprint_data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully exported accurate blueprint data to ${outputPath}`);
