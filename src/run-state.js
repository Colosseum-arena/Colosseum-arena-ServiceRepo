import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getRoot() {
  if (process.env.MULTIVERSE_SEC_RUNS_DIR) return process.env.MULTIVERSE_SEC_RUNS_DIR;
  if (process.env.MULTIVERSE_SEC_CONFIG_DIR) return path.join(process.env.MULTIVERSE_SEC_CONFIG_DIR, 'runs');
  return path.join(os.homedir(), '.multiverse-sec', 'runs');
}

export function ensureRunDir(runId) {
  const dir = path.join(getRoot(), runId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function writeRoleOutput(runId, role, value) {
  const filePath = path.join(ensureRunDir(runId), `${role}.json`);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  return filePath;
}

export function readRoleOutput(runId, role) {
  const filePath = path.join(ensureRunDir(runId), `${role}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function hasRoleOutput(runId, role) {
  return fs.existsSync(path.join(ensureRunDir(runId), `${role}.json`));
}

export async function waitForRoleOutputs(runId, roles, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (roles.every((role) => hasRoleOutput(runId, role))) {
      return roles.map((role) => readRoleOutput(runId, role));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`역할 출력 대기 시간 초과: ${roles.join(', ')}`);
}
