import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const path = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(path)) console.log('backend/.env already exists. Its access key and settings were preserved.');
else {
  writeFileSync(path, `PROJECTS_TOKEN=${randomBytes(32).toString('hex')}\nPROJECTS_ALLOWED_ORIGINS=https://cakirmert.github.io,http://127.0.0.1:5173,http://localhost:5173\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created private backend/.env with a random access key.');
}
console.log('Run npm run backend:up. Connect Projects to http://127.0.0.1:8789 with the PROJECTS_TOKEN value from backend/.env.');
