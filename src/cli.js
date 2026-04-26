#!/usr/bin/env node

const color = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  blue: '\u001b[34m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  magenta: '\u001b[35m'
};

const scenario = {
  prompt: '보안이 강화된 login API 만들어줘',
  proposals: [
    {
      agent: 'Architect',
      idea: '레이어를 분리한 OOP 구조로 로그인 API를 설계하겠습니다.',
      detail: 'Controller-Service-Repository를 나눠 책임을 분리합니다.'
    },
    {
      agent: 'Red Team',
      idea: '문자열 결합 쿼리와 인증 누락 가능성을 먼저 의심해야 합니다.',
      detail: '공격 관점에서 SQL Injection과 brute force 위험을 우선 점검합니다.'
    },
    {
      agent: 'Blue Team',
      idea: '입력 검증, rate limit, 감사 로그를 최소 보안 기준으로 묶겠습니다.',
      detail: '패치 우선순위를 낮은 수정 비용 순으로 제안합니다.'
    }
  ],
  debate: [
    {
      from: 'Red Team',
      to: 'Architect',
      message: 'OOP 구조는 명확하지만 쿼리 레이어가 복잡해지면 취약점이 숨어들 수 있습니다.'
    },
    {
      from: 'Blue Team',
      to: 'Red Team',
      message: '그 위험을 줄이기 위해 함수 단위 검증과 파라미터 바인딩을 공통 규칙으로 고정하겠습니다.'
    },
    {
      from: 'Judge',
      to: 'All',
      message: '복잡한 구조보다 설명 가능한 보안 흐름이 중요하니 Functional 중심 대안을 채택합시다.'
    }
  ],
  decision: {
    winner: 'Functional 보안 흐름',
    summary: '입력 검증 → rate limit → 사용자 조회 → 비밀번호 검증 → 감사 로그 → 토큰 발급',
    reason: [
      '각 단계가 분리되어 심사위원이 보안 의도를 바로 이해할 수 있습니다.',
      'Red Team의 공격 포인트를 Blue Team의 방어 정책으로 바로 연결할 수 있습니다.',
      'Judge가 최종 선택 이유를 짧고 명확하게 설명할 수 있습니다.'
    ]
  }
};

function paint(text, tone) {
  return `${color[tone] ?? ''}${text}${color.reset}`;
}

function header(title) {
  console.log(`\n${paint(title, 'bold')}`);
}

function logLine(label, text, tone = 'dim') {
  console.log(`${paint(label, tone)} ${text}`);
}

console.log(paint('Multiverse Secure Demo', 'cyan'));
console.log(paint('AI 아이디어 제안 → 반박 → 조율 → 최종 합의', 'dim'));
logLine('Prompt', scenario.prompt, 'magenta');

header('1. 에이전트별 아이디어 제안');
for (const proposal of scenario.proposals) {
  logLine(`[${proposal.agent}]`, proposal.idea, 'cyan');
  logLine('  └', proposal.detail, 'dim');
}

header('2. 에이전트 간 충돌과 조율');
for (const turn of scenario.debate) {
  const tone = turn.from === 'Red Team' ? 'red' : turn.from === 'Blue Team' ? 'blue' : 'yellow';
  logLine(`[${turn.from} → ${turn.to}]`, turn.message, tone);
}

header('3. 최종 합의 결과');
logLine('[Judge]', `${scenario.decision.winner}로 확정`, 'green');
logLine('합의된 흐름', scenario.decision.summary, 'green');
for (const reason of scenario.decision.reason) {
  logLine('  ✓', reason, 'green');
}
