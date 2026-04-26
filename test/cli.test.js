import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-sec-test-'));
const server = spawn('node', ['./test/stub-provider-server.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const port = await new Promise((resolve, reject) => {
  server.stdout.once('data', (chunk) => resolve(String(chunk).trim()));
  server.once('error', reject);
  server.once('exit', (code) => {
    if (code !== 0) reject(new Error(`stub server exited: ${code}`));
  });
});

const env = {
  ...process.env,
  MULTIVERSE_SEC_CONFIG_DIR: tempDir,
  MULTIVERSE_SEC_TEST_SECRET_BACKEND: 'file',
  MULTIVERSE_SEC_OPENAI_BASE_URL: `http://127.0.0.1:${port}/v1`,
  MULTIVERSE_SEC_CLAUDE_BASE_URL: `http://127.0.0.1:${port}/v1`,
  MULTIVERSE_SEC_GEMINI_BASE_URL: `http://127.0.0.1:${port}`
};

const run = (args, input = '') => spawnSync('node', ['./src/cli.js', ...args], { encoding: 'utf8', env, input });

let result = run(['--help']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /assign/);
assert.match(result.stdout, /use/);
result = run(['/mode']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /모드 안내/);
assert.match(result.stdout, /\/oauth/);

result = run(['login', '--provider', 'openai', '--api-key', 'test-openai-key'], 'Y\n');
assert.equal(result.status, 0, result.stderr);
result = run(['login', '--provider', 'claude', '--api-key', 'test-claude-key'], 'n\n');
assert.equal(result.status, 0, result.stderr);
result = run(['login', '--provider', 'gemini', '--api-key', 'test-gemini-key'], 'n\n');
assert.equal(result.status, 0, result.stderr);

result = run(['/use', 'openai']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'architect', 'claude']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'red', 'gemini']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'blue', 'openai']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'consensus', 'claude']);
assert.equal(result.status, 0, result.stderr);
result = run(['/assign', 'final', 'gemini']);
assert.equal(result.status, 0, result.stderr);

result = run(['run', '로그인 API 만들어줘', '--no-delay']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /Multiverse Secure Service Run/);
assert.match(result.stdout, /실제 구조 제안/);
assert.match(result.stdout, /실제 합의안/);
assert.match(result.stdout, /return res\.json/);

result = run(['로그인 API 만들어줘', '--no-delay']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /Multiverse Secure Service Run/);

result = run(['providers']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /Claude: .*architect, consensus/);
assert.match(result.stdout, /Gemini: .*red, final/);

const sessionName = `multiverse-sec-test-${Date.now()}`;
result = run(['--tmux', '결제 API 만들어줘', '--session-name', sessionName, '--no-delay', '--no-attach']);
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /architect=Claude/);
assert.match(result.stdout, /red=Gemini/);
assert.match(result.stdout, /blue=OpenAI/);

const listResult = spawnSync('tmux', ['list-panes', '-t', `${sessionName}:0`, '-F', '#{pane_id} #{pane_title}'], { encoding: 'utf8' });
assert.equal(listResult.status, 0, listResult.stderr);
const architectLine = listResult.stdout.split('\n').find((line) => line.includes('Architect'));
const finalLine = listResult.stdout.split('\n').find((line) => line.includes('Final Decision'));
assert.ok(architectLine);
assert.ok(finalLine);
const architectPaneId = architectLine.split(' ')[0];
const finalPaneId = finalLine.split(' ')[0];

await new Promise((resolve) => setTimeout(resolve, 1500));
let capture = spawnSync('tmux', ['capture-pane', '-p', '-S', '-200', '-t', architectPaneId], { encoding: 'utf8' });
assert.equal(capture.status, 0, capture.stderr);
assert.match(capture.stdout, /Provider: Claude/);
assert.match(capture.stdout, /실제 구조 제안/);

capture = spawnSync('tmux', ['capture-pane', '-p', '-S', '-400', '-t', finalPaneId], { encoding: 'utf8' });
assert.equal(capture.status, 0, capture.stderr);
assert.match(capture.stdout, /Provider: Gemini/);
assert.match(capture.stdout, /실제 합의안/);
assert.match(capture.stdout, /return res\.json/);

spawnSync('tmux', ['kill-session', '-t', sessionName], { encoding: 'utf8' });
result = run(['/logout', 'gemini']);
assert.equal(result.status, 0, result.stderr);
server.kill('SIGTERM');
console.log('CLI real-provider engine smoke test passed');
