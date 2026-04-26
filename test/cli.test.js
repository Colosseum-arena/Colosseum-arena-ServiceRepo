import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const demoResult = spawnSync('node', ['./src/cli.js', '회원가입 API 만들어줘', '--no-delay'], {
  encoding: 'utf8'
});

assert.equal(demoResult.status, 0, demoResult.stderr);
assert.match(demoResult.stdout, /Multiverse Secure Demo/);
assert.match(demoResult.stdout, /에이전트별 아이디어 제안/);
assert.match(demoResult.stdout, /Red Team → Architect/);
assert.match(demoResult.stdout, /Functional 보안 흐름/);
assert.match(demoResult.stdout, /final-code\.js/);
assert.match(demoResult.stdout, /issueAccessToken/);

const helpResult = spawnSync('node', ['./src/cli.js', '--help'], {
  encoding: 'utf8'
});

assert.equal(helpResult.status, 0, helpResult.stderr);
assert.match(helpResult.stdout, /사용법:/);
assert.match(helpResult.stdout, /--no-delay/);

console.log('CLI smoke test passed');
