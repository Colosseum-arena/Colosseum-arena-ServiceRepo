import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const helpResult = spawnSync('node', ['./src/cli.js', '--help'], {
  encoding: 'utf8'
});
assert.equal(helpResult.status, 0, helpResult.stderr);
assert.match(helpResult.stdout, /--tmux/);
assert.match(helpResult.stdout, /--no-attach/);

const architectResult = spawnSync('node', ['./src/cli.js', '--role', 'architect', '--prompt-b64', Buffer.from('회원가입 API 만들어줘').toString('base64'), '--no-delay'], {
  encoding: 'utf8'
});
assert.equal(architectResult.status, 0, architectResult.stderr);
assert.match(architectResult.stdout, /Architect 패널/);
assert.match(architectResult.stdout, /구조 설계/);

const sessionName = `multiverse-sec-test-${Date.now()}`;
const tmuxResult = spawnSync('node', ['./src/cli.js', '--tmux', '결제 API 만들어줘', '--session-name', sessionName, '--no-delay', '--no-attach'], {
  encoding: 'utf8'
});
assert.equal(tmuxResult.status, 0, tmuxResult.stderr);
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
assert.match(captureResult.stdout, /Consensus Board 패널/);
assert.match(captureResult.stdout, /Judge/);

spawnSync('tmux', ['kill-session', '-t', sessionName], { encoding: 'utf8' });
console.log('CLI tmux split smoke test passed');
