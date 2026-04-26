import http from 'node:http';

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

server.listen(0, () => {
  const { port } = server.address();
  console.log(String(port));
});
