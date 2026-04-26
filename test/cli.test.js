import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-sec-test-'));
const env = {
  ...process.env,
  MULTIVERSE_SEC_CONFIG_DIR: tempDir,
  MULTIVERSE_SEC_TEST_SECRET_BACKEND: 'file'
};

const helpResult = spawnSync('node', ['./src/cli.js', '--help'], {
  encoding: 'utf8',
  env
});
assert.equal(helpResult.status, 0, helpResult.stderr);
assert.match(helpResult.stdout, /login/);
assert.match(helpResult.stdout, /providers/);
assert.match(helpResult.stdout, /logout/);
assert.match(helpResult.stdout, /--tmux/);

const loginResult = spawnSync('node', ['./src/cli.js', 'login', '--provider', 'openai', '--api-key', 'test-openai-key'], {
  encoding: 'utf8',
  env,
  input: 'Y\n'
});
assert.equal(loginResult.status, 0, loginResult.stderr);
assert.match(loginResult.stdout, /OpenAI 연결 완료/);

const providersResult = spawnSync('node', ['./src/cli.js', 'providers'], {
  encoding: 'utf8',
  env
});
assert.equal(providersResult.status, 0, providersResult.stderr);
assert.match(providersResult.stdout, /OpenAI/);
assert.match(providersResult.stdout, /연결됨/);
assert.match(providersResult.stdout, /기본/);

const architectResult = spawnSync('node', ['./src/cli.js', '--role', 'architect', '--provider', 'openai', '--prompt-b64', Buffer.from('회원가입 API 만들어줘').toString('base64'), '--no-delay'], {
  encoding: 'utf8',
  env
});
assert.equal(architectResult.status, 0, architectResult.stderr);
assert.match(architectResult.stdout, /Provider: OpenAI/);
assert.match(architectResult.stdout, /Architect 패널/);

const sessionName = `multiverse-sec-test-${Date.now()}`;
const tmuxResult = spawnSync('node', ['./src/cli.js', '--tmux', '결제 API 만들어줘', '--session-name', sessionName, '--no-delay', '--no-attach'], {
  encoding: 'utf8',
  env
});
assert.equal(tmuxResult.status, 0, tmuxResult.stderr);
assert.match(tmuxResult.stdout, /Provider: OpenAI/);
assert.match(tmuxResult.stdout, new RegExp(sessionName));

const listResult = spawnSync('tmux', ['list-panes', '-t', `${sessionName}:0`, '-F', '#{pane_id} #{pane_title}'], {
  encoding: 'utf8'
});
assert.equal(listResult.status, 0, listResult.stderr);
assert.match(listResult.stdout, /Architect/);
assert.match(listResult.stdout, /Consensus/);
assert.match(listResult.stdout, /Red Team/);
assert.match(listResult.stdout, /Blue Team/);
assert.match(listResult.stdout, /Final Decision/);

const consensusLine = listResult.stdout.split('\n').find((line) => line.includes('Consensus'));
assert.ok(consensusLine, 'Consensus pane not found');
const consensusPaneId = consensusLine.split(' ')[0];

const captureResult = spawnSync('tmux', ['capture-pane', '-p', '-S', '-200', '-t', consensusPaneId], {
  encoding: 'utf8'
});
assert.equal(captureResult.status, 0, captureResult.stderr);
assert.match(captureResult.stdout, /Provider: OpenAI/);
assert.match(captureResult.stdout, /Consensus Board 패널/);
assert.match(captureResult.stdout, /Judge/);

spawnSync('tmux', ['kill-session', '-t', sessionName], { encoding: 'utf8' });

const logoutResult = spawnSync('node', ['./src/cli.js', 'logout', '--provider', 'openai'], {
  encoding: 'utf8',
  env
});
assert.equal(logoutResult.status, 0, logoutResult.stderr);
assert.match(logoutResult.stdout, /연결을 제거했습니다/);

console.log('CLI auth and tmux smoke test passed');
