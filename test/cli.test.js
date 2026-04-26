import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, 'src/cli.js');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-sec-test-'));
const workspaceDir = path.join(tempDir, 'workspace');
fs.mkdirSync(path.join(workspaceDir, 'src'), { recursive: true });
fs.writeFileSync(
  path.join(workspaceDir, 'src/app.js'),
  "export function bootstrapLogin() {\n  return { ok: false };\n}\n",
  'utf8'
);

const server = spawn('node', [path.join(repoRoot, 'test/stub-provider-server.js')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const port = await new Promise((resolve, reject) => {
  server.stdout.once('data', (chunk) => resolve(String(chunk).trim()));
  server.once('error', reject);
  server.once('exit', (code) => {
    if (code !== 0) reject(new Error(`stub server exited: ${code}`));
  });
});

const env = {
  ...process.env,
  MULTIVERSE_SEC_CONFIG_DIR: path.join(tempDir, 'config'),
  MULTIVERSE_SEC_TEST_SECRET_BACKEND: 'file',
  MULTIVERSE_SEC_CODEX_BASE_URL: `http://127.0.0.1:${port}/v1`,
  MULTIVERSE_SEC_CLAUDE_BASE_URL: `http://127.0.0.1:${port}/v1`,
  MULTIVERSE_SEC_GEMINI_BASE_URL: `http://127.0.0.1:${port}`
};

const run = (args, input = '') => spawnSync('node', [cliPath, ...args], {
  cwd: workspaceDir,
  encoding: 'utf8',
  env,
  input
});

const runWith = (extraEnv, cwd, args, input = '') => spawnSync('node', [cliPath, ...args], {
  cwd,
  encoding: 'utf8',
  env: {
    ...env,
    ...extraEnv
  },
  input
});

let result = run(['--help']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /agents/);
assert.match(result.stdout, /--dry-run/);
assert.match(result.stdout, /tui/);

result = run(['/mode']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /alpha, beta, gamma/);
assert.match(result.stdout, /\/tui/);

result = run(['login', '--provider', 'codex', '--api-key', 'test-codex-key'], 'Y\n');
assert.equal(result.status, 0, result.stderr);
result = run(['login', '--provider', 'claude', '--api-key', 'test-claude-key'], 'n\n');
assert.equal(result.status, 0, result.stderr);
result = run(['login', '--provider', 'gemini', '--api-key', 'test-gemini-key'], 'n\n');
assert.equal(result.status, 0, result.stderr);

result = run(['/assign', 'alpha', 'codex']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'beta', 'claude']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'gamma', 'gemini']);
assert.equal(result.status, 0, result.stderr);

result = run(['/model', 'alpha', 'gpt-alpha-test']);
assert.equal(result.status, 0, result.stderr);
result = run(['/model', 'beta', 'claude-beta-test']);
assert.equal(result.status, 0, result.stderr);
result = run(['/model', 'gamma', 'gemini-gamma-test']);
assert.equal(result.status, 0, result.stderr);

result = run(['agents']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /gpt-alpha-test/);
assert.match(result.stdout, /claude-beta-test/);
assert.match(result.stdout, /gemini-gamma-test/);

result = run(['providers']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /Codex: .*alpha/);
assert.match(result.stdout, /Gemini: .*gamma/);

result = run(['cleanup']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /tmux 세션|정리할 multiverse-sec tmux 세션이 없습니다/);

result = run(['run', '로그인 기능을 프로젝트에 추가해줘', '--dry-run']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /selected: gamma/);
assert.match(result.stdout, /strategy: Composable Module Strategy/);
assert.match(result.stdout, /Planned Changes/);
assert.equal(fs.existsSync(path.join(workspaceDir, 'src/login.js')), false);

result = run(['run', '로그인 기능을 프로젝트에 추가해줘']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /selected: gamma/);
assert.match(result.stdout, /Applied Changes/);

const loginFile = fs.readFileSync(path.join(workspaceDir, 'src/login.js'), 'utf8');
assert.match(loginFile, /functional-final/);
assert.match(loginFile, /gemini-gamma-test/);

const appFile = fs.readFileSync(path.join(workspaceDir, 'src/app.js'), 'utf8');
assert.match(appFile, /import \{ login \} from '\.\/login\.js'/);

result = run(['/unmodel', 'gamma']);
assert.equal(result.status, 0, result.stderr);
result = run(['/logout', 'gemini']);
assert.equal(result.status, 0, result.stderr);

const singleConfigDir = path.join(tempDir, 'single-config');
const singleWorkspaceDir = path.join(tempDir, 'single-workspace');
fs.mkdirSync(path.join(singleWorkspaceDir, 'src'), { recursive: true });
fs.writeFileSync(
  path.join(singleWorkspaceDir, 'src/app.js'),
  "export function bootstrapLogin() {\n  return { ok: false };\n}\n",
  'utf8'
);

result = runWith({ MULTIVERSE_SEC_CONFIG_DIR: singleConfigDir }, singleWorkspaceDir, ['login', '--provider', 'codex', '--api-key', 'single-codex-key'], 'Y\n');
assert.equal(result.status, 0, result.stderr);

result = runWith({ MULTIVERSE_SEC_CONFIG_DIR: singleConfigDir }, singleWorkspaceDir, ['agents']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /fallback: 단일 연결 provider\(Codex\)를 3개 에이전트가 함께 사용/);

result = runWith({ MULTIVERSE_SEC_CONFIG_DIR: singleConfigDir }, singleWorkspaceDir, ['run', '로그인 기능을 프로젝트에 추가해줘', '--plain']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /Single provider fallback active: Codex provider 하나로 3개 에이전트를 모두 실행했습니다/);
assert.match(result.stdout, /selected: gamma/);

const singleLoginFile = fs.readFileSync(path.join(singleWorkspaceDir, 'src/login.js'), 'utf8');
assert.match(singleLoginFile, /gpt-5-mini/);

const badEscapeConfigDir = path.join(tempDir, 'bad-escape-config');
const badEscapeWorkspaceDir = path.join(tempDir, 'bad-escape-workspace');
fs.mkdirSync(path.join(badEscapeWorkspaceDir, 'src'), { recursive: true });
fs.writeFileSync(
  path.join(badEscapeWorkspaceDir, 'src/app.js'),
  "export function bootstrapLogin() {\n  return { ok: false };\n}\n",
  'utf8'
);

result = runWith({ MULTIVERSE_SEC_CONFIG_DIR: badEscapeConfigDir }, badEscapeWorkspaceDir, ['login', '--provider', 'gemini', '--api-key', 'bad-escape-gemini-key'], 'Y\n');
assert.equal(result.status, 0, result.stderr);

result = runWith({ MULTIVERSE_SEC_CONFIG_DIR: badEscapeConfigDir }, badEscapeWorkspaceDir, ['run', 'BAD_ESCAPE_SCENARIO 로그인 기능을 프로젝트에 추가해줘', '--plain']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /selected: gamma/);

const badEscapeLoginFile = fs.readFileSync(path.join(badEscapeWorkspaceDir, 'src/login.js'), 'utf8');
assert.match(badEscapeLoginFile, /gemini-2.5-flash/);

const failureConfigDir = path.join(tempDir, 'failure-config');
const failureWorkspaceDir = path.join(tempDir, 'failure-workspace');
fs.mkdirSync(path.join(failureWorkspaceDir, 'src', 'auth'), { recursive: true });
fs.writeFileSync(
  path.join(failureWorkspaceDir, 'src/app.js'),
  "export function bootstrapLogin() {\n  return { ok: false };\n}\n",
  'utf8'
);

result = runWith(
  {
    MULTIVERSE_SEC_CONFIG_DIR: failureConfigDir
  },
  failureWorkspaceDir,
  ['login', '--provider', 'codex', '--api-key', 'failure-codex-key'],
  'Y\n'
);
assert.equal(result.status, 0, result.stderr);

result = runWith(
  {
    MULTIVERSE_SEC_CONFIG_DIR: failureConfigDir
  },
  failureWorkspaceDir,
  ['run', 'BAD_DELETE_SCENARIO 로그인 기능을 프로젝트에 추가해줘', '--plain']
);
assert.equal(result.status, 1);
assert.match(result.stderr, /디렉터리 삭제는 지원하지 않습니다: src\/auth/);
assert.match(result.stderr, /실패 시점 변경안:/);
assert.match(result.stderr, /오류 로그:/);

const failureLogDir = path.join(failureWorkspaceDir, '.multiverse-sec', 'logs');
const failureLogs = fs.readdirSync(failureLogDir);
assert.ok(failureLogs.some((name) => name.startsWith('run-failure-')));

server.kill('SIGTERM');
console.log('CLI orchestration workspace patch test passed');
