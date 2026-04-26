import http from 'node:http';

const badEscapeAttempts = new Map();

function extractModel(req, body) {
  if (req.url === '/v1/responses') return body.model;
  if (req.url === '/v1/messages') return body.model;
  if (req.url?.includes(':generateContent')) {
    const match = req.url.match(/\/models\/([^:]+):generateContent/);
    return match?.[1] ?? 'unknown-gemini-model';
  }
  return 'unknown-model';
}

function detectPhase(text) {
  if (text.includes('"postApplyChecks"')) return 'refine';
  if (text.includes('"preferredAgent"')) return 'critique';
  return 'proposal';
}

function detectAgent(text) {
  if (text.includes('에이전트: alpha')) return 'alpha';
  if (text.includes('에이전트: beta')) return 'beta';
  if (text.includes('에이전트: gamma')) return 'gamma';
  if (text.includes('선정된 에이전트: gamma')) return 'gamma';
  if (text.includes('선정된 에이전트: beta')) return 'beta';
  if (text.includes('선정된 에이전트: alpha')) return 'alpha';
  return 'alpha';
}

function proposalPayload(agent, model) {
  if (agent === 'alpha') {
    return {
      agent,
      strategy: 'Layered Service Strategy',
      summary: '서비스 계층을 얇게 두고 인증 흐름을 모듈별로 분리합니다.',
      approach: 'service/controller 성격의 경계를 유지하면서 확장 가능한 인증 흐름을 만듭니다.',
      plan: ['입력 검증 모듈 분리', '로그인 서비스 작성', '앱 진입점 연결'],
      reasons: ['상태와 책임 분리가 명확합니다.', `model:${model}`],
      risks: ['초기 구조가 다소 무거울 수 있습니다.'],
      changes: [
        {
          path: 'src/login.js',
          action: 'create',
          content: `export class LoginService {\n  async login(input) {\n    return { ok: true, mode: 'oop', model: '${model}', user: input.username };\n  }\n}\n`
        }
      ]
    };
  }
  if (agent === 'beta') {
    return {
      agent,
      strategy: 'Minimal Patch Strategy',
      summary: '기존 진입점을 최대한 유지하면서 최소 수정으로 로그인 흐름을 붙입니다.',
      approach: '검증 -> 조회 -> 응답 순서의 명시적 흐름을 최소 파일 수정으로 정리합니다.',
      plan: ['기존 엔트리 포인트 유지', '단일 로그인 흐름 함수 추가', '빠른 통합'],
      reasons: ['흐름이 단순합니다.', `model:${model}`],
      risks: ['확장 시 분기 관리가 늘어날 수 있습니다.'],
      changes: [
        {
          path: 'src/login.js',
          action: 'create',
          content: `export async function loginHandler(input) {\n  if (!input.username || !input.password) throw new Error('missing credentials');\n  return { ok: true, mode: 'procedural', model: '${model}', user: input.username };\n}\n`
        }
      ]
    };
  }
  return {
    agent,
    strategy: 'Composable Module Strategy',
    summary: '작은 인증 유틸을 조합하는 방식으로 로그인 모듈을 추가합니다.',
    approach: '순수 함수와 조합 가능한 작은 유틸로 나눕니다.',
    plan: ['입력 검증 함수 작성', '로그인 함수 작성', '앱 진입점 교체'],
    reasons: ['테스트와 재사용이 쉽습니다.', `model:${model}`],
    risks: ['추상화 수준을 일정하게 유지해야 합니다.'],
    changes: [
      {
        path: 'src/login.js',
        action: 'create',
        content: `export function validateLoginInput(input) {\n  if (!input.username || !input.password) throw new Error('missing credentials');\n  return { username: input.username, password: input.password };\n}\n\nexport async function login(input) {\n  const valid = validateLoginInput(input);\n  return { ok: true, mode: 'functional', model: '${model}', user: valid.username };\n}\n`
      }
    ]
  };
}

function critiquePayload(agent) {
  return {
    agent,
    preferredAgent: 'gamma',
    strengths: ['함수 경계가 명확합니다.'],
    issues: [`${agent} 관점에서도 gamma 안이 현재 구조에 가장 가볍습니다.`],
    mergeIdeas: ['에러 메시지는 더 명확히 유지합니다.'],
    debatePoints: ['복잡한 계층화보다 작은 모듈 조합이 이번 요청 범위에 더 적합합니다.']
  };
}

function refinementPayload(model, text) {
  if (text.includes('BAD_DELETE_SCENARIO')) {
    return {
      winner: 'gamma',
      winningStrategy: 'Invalid Delete Strategy',
      summary: '잘못된 삭제 변경안을 반환합니다.',
      reasons: ['directory delete failure test'],
      debateResolution: ['삭제 변경안 검증이 필요합니다.'],
      changes: [
        {
          path: 'src/auth',
          action: 'delete'
        }
      ],
      postApplyChecks: ['directory delete should fail']
    };
  }
  return {
    winner: 'gamma',
    winningStrategy: 'Composable Module Strategy',
    summary: 'gamma 전략을 기준으로 입력 검증과 로그인 함수를 최종 반영합니다.',
    reasons: ['3표 모두 gamma 안을 선택했습니다.', `refined-model:${model}`],
    debateResolution: [
      '과도한 계층화보다 작은 인증 모듈 조합이 현재 저장소 규모에 더 적합하다고 정리했습니다.',
      '기존 진입점은 유지하되 로그인 로직은 분리하기로 합의했습니다.'
    ],
    changes: [
      {
        path: 'src/login.js',
        action: 'create',
        content: `export function validateLoginInput(input) {\n  if (!input.username || !input.password) throw new Error('missing credentials');\n  return { username: input.username.trim(), password: input.password };\n}\n\nexport async function login(input) {\n  const valid = validateLoginInput(input);\n  return { ok: true, mode: 'functional-final', model: '${model}', user: valid.username };\n}\n`
      },
      {
        path: 'src/app.js',
        action: 'replace',
        content: `import { login } from './login.js';\n\nexport async function bootstrapLogin(input) {\n  return login(input);\n}\n`
      }
    ],
    postApplyChecks: ['login 함수가 export 되어야 합니다.', 'app.js가 새 로그인 모듈을 import 해야 합니다.']
  };
}

function buildPayload(req, body, text) {
  const model = extractModel(req, body);
  const phase = detectPhase(text);
  const agent = detectAgent(text);
  if (phase === 'proposal') return proposalPayload(agent, model);
  if (phase === 'critique') return critiquePayload(agent);
  return refinementPayload(model, text);
}

function maybeReturnBadEscapedJson(req, body, text) {
  if (!text.includes('BAD_ESCAPE_SCENARIO')) return null;
  if (!req.url?.includes(':generateContent')) return null;
  if (detectPhase(text) !== 'proposal') return null;
  if (detectAgent(text) !== 'gamma') return null;

  const key = `${detectPhase(text)}:${detectAgent(text)}`;
  const count = badEscapeAttempts.get(key) ?? 0;
  badEscapeAttempts.set(key, count + 1);
  if (count > 0) return null;

  return '{"agent":"gamma","strategy":"Broken Escape Strategy","summary":"깨진 JSON 응답 테스트","approach":"bad json","plan":["regex \\s 사용"],"reasons":["broken once"],"risks":[],"changes":[{"path":"src/login.js","action":"create","content":"export const pattern = /\\s+/;\nexport async function login(){\n  return { ok: true };\n}\n"}]}';
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const body = raw ? JSON.parse(raw) : {};

  if (req.url === '/v1/responses') {
    const text = `${body.instructions}\n${body.input}`;
    const malformed = maybeReturnBadEscapedJson(req, body, text);
    if (malformed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output_text: malformed }));
      return;
    }
    const payload = buildPayload(req, body, text);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ output_text: JSON.stringify(payload) }));
    return;
  }

  if (req.url === '/v1/messages') {
    const userText = (body.messages || []).map((item) => item.content).join('\n');
    const text = `${body.system}\n${userText}`;
    const malformed = maybeReturnBadEscapedJson(req, body, text);
    if (malformed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: malformed }] }));
      return;
    }
    const payload = buildPayload(req, body, text);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }] }));
    return;
  }

  if (req.url?.includes(':generateContent')) {
    const systemText = body.system_instruction?.parts?.map((item) => item.text).join('\n') || '';
    const userText = (body.contents || []).flatMap((item) => item.parts || []).map((item) => item.text).join('\n');
    const text = `${systemText}\n${userText}`;
    const malformed = maybeReturnBadEscapedJson(req, body, text);
    if (malformed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: malformed }] } }] }));
      return;
    }
    const payload = buildPayload(req, body, text);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(0, () => {
  const { port } = server.address();
  console.log(String(port));
});
