import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const demoResult = spawnSync('node', ['./src/cli.js', '회원가입 API 만들어줘', '--no-delay'], {
  encoding: 'utf8'
});

assert.equal(demoResult.status, 0, demoResult.stderr);
assert.match(demoResult.stdout, /분할형 멀티 에이전트 대시보드/);
assert.match(demoResult.stdout, /좌상단 \| Architect 패널/);
assert.match(demoResult.stdout, /좌중단 \| Red Team 패널/);
assert.match(demoResult.stdout, /좌하단 \| Blue Team 패널/);
assert.match(demoResult.stdout, /우측 상단 \| Consensus Board/);
assert.match(demoResult.stdout, /우측 하단 \| Final Decision/);
assert.match(demoResult.stdout, /AI 의견 충돌 \/ 조율 \/ 최종 판정/);
assert.match(demoResult.stdout, /final-code\.js/);
assert.match(demoResult.stdout, /issueAccessToken/);

const helpResult = spawnSync('node', ['./src/cli.js', '--help'], {
  encoding: 'utf8'
});

assert.equal(helpResult.status, 0, helpResult.stderr);
assert.match(helpResult.stdout, /사용법:/);
assert.match(helpResult.stdout, /좌측은 AI 작업 패널, 우측은 합의\/최종 결정 패널/);

console.log('CLI split dashboard smoke test passed');
