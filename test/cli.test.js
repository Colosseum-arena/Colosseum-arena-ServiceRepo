import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

function buildRolePayload(role) {
  if (role === 'architect') return { idea: '실제 구조 제안', detail: 'API 계층을 분리합니다.', deliverable: '구현 초안', status: '구조 설계 완료' };
  if (role === 'red') return { idea: '실제 취약점 분석', detail: '인증 우회와 SQL Injection을 점검합니다.', challenge: '쿼리 검증과 인증 미들웨어가 부족합니다.', status: '취약점 분석 완료' };
  if (role === 'blue') return { idea: '실제 방어 전략', detail: '입력 검증과 rate limit를 적용합니다.', response: '파라미터 바인딩과 인증 미들웨어를 추가합니다.', status: '방어 전략 수립 완료' };
  if (role === 'consensus') return { turns: [ { from: 'Architect', to: 'Red Team', message: '기본 구조를 유지하되 보안 요구사항을 반영합시다.' }, { from: 'Blue Team', to: 'All', message: '입력 검증과 인증 미들웨어를 공통 규칙으로 넣겠습니다.' }, { from: 'Judge', to: 'All', message: '설명 가능성과 수정 범위를 고려해 이 방향으로 확정합니다.' } ], winner: '실제 합의안', summary: '입력 검증 → 인증 → rate limit → 감사 로그' };
  return { winner: '실제 합의안', summary: '입력 검증 → 인증 → rate limit → 감사 로그', reasons: ['설명 가능성이 높습니다.', '보안 요구사항이 반영됩니다.', '수정 범위가 명확합니다.'], finalCode: 'export async function loginHandler(req, res) {\n  return res.json({ ok: true });\n}' };
}

function detectRole(text) {
  if (text.includes('Architect 역할')) return 'architect';
  if (text.includes('Red Team 역할')) return 'red';
  if (text.includes('Blue Team 역할')) return 'blue';
  if (text.includes('Judge/Consensus 역할')) return 'consensus';
  if (text.includes('Final 역할')) return 'final';
  return 'architect';
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const body = raw ? JSON.parse(raw) : {};

  if (req.url === '/v1/responses') {
    const role = detectRole(`${body.instructions}\n${body.input}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ output_text: JSON.stringify(buildRolePayload(role)) }));
    return;
  }

  if (req.url === '/v1/messages') {
    const userText = (body.messages || []).map((item) => item.content).join('\n');
    const role = detectRole(`${body.system}\n${userText}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(buildRolePayload(role)) }] }));
    return;
  }

  if (req.url?.includes(':generateContent')) {
    const systemText = body.system_instruction?.parts?.map((item) => item.text).join('\n') || '';
    const userText = (body.contents || []).flatMap((item) => item.parts || []).map((item) => item.text).join('\n');
    const role = detectRole(`${systemText}\n${userText}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(buildRolePayload(role)) }] } }] }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-sec-test-'));
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
assert.match(result.stdout, /OpenAI 연결 완료/);
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

let listResult = spawnSync('tmux', ['list-panes', '-t', `${sessionName}:0`, '-F', '#{pane_id} #{pane_title}'], { encoding: 'utf8' });
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

server.close();
console.log('CLI real-provider engine smoke test passed');
