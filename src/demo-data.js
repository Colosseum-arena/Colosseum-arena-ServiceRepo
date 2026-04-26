export function buildDemoScenario(request) {
  return {
    prompt: request,
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
}
