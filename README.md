# Colosseum-arena-ServiceRepo

AI 협업 기반 보안 코드 생성 서비스를 위한 CLI 저장소입니다.

이 프로젝트는 여러 AI provider를 역할별로 조합해 동일한 요청을 검토하고,
구조 제안, 보안 공격 관점 점검, 방어 전략 수립, 최종 합의와 코드 반환까지
실행 가능한 서비스 흐름으로 제공하는 것을 목표로 합니다.

## 작업 플로우
- 기본 브랜치: `develop`
- 작업 규칙: [CONTRIBUTING.md](CONTRIBUTING.md)
- 상세 가이드: [docs/git-workflow.md](docs/git-workflow.md)
- 서비스 실행 기준: [docs/hackathon-execution-plan.md](docs/hackathon-execution-plan.md)

## 요구 사항
- Node.js 18+
- tmux 3.x 이상 권장
- provider별 유효한 API Key

## 설치
```bash
npm install
npm link
```

설치 후에는 `multiverse-sec` 명령으로 바로 실행할 수 있습니다.

## 기본 서비스 실행
```bash
multiverse-sec "보안이 강화된 login API 만들어줘"
```

위 명령은 저장된 provider 설정을 사용해 실제 역할별 API 호출을 순차 실행하고,
최종 합의와 결과 코드를 한 번에 출력합니다.

### 명시적 run 명령
```bash
multiverse-sec run "보안이 강화된 login API 만들어줘"
multiverse-sec /run "회원가입 API 만들어줘"
```

## 다중 provider 연결
```bash
multiverse-sec /login openai
multiverse-sec /login claude
multiverse-sec /login gemini
```

## provider 상태 확인
```bash
multiverse-sec /providers
```

## 기본 provider 변경
```bash
multiverse-sec /use openai
```

## 역할별 provider 할당
```bash
multiverse-sec /assign architect claude
multiverse-sec /assign red gemini
multiverse-sec /assign blue openai
multiverse-sec /assign consensus claude
multiverse-sec /assign final gemini
```

## tmux 실분할 실행
```bash
multiverse-sec /tmux "로그인 API 만들어줘"
```

### 패널 구성
- 좌측: Architect / Red Team / Blue Team
- 우측 상단: Consensus Board
- 우측 하단: Final Decision

## 인증 및 설정 관리
### 로그인
```bash
multiverse-sec /login openai
```

### 연결 제거
```bash
multiverse-sec /logout openai
```

### 특징
- 최초 1회 연결 후 자동 재사용
- macOS에서는 기본적으로 Keychain 사용
- 일반 설정 파일에는 민감한 API 키를 저장하지 않음

## 슬래시 명령
```bash
multiverse-sec /mode
multiverse-sec /providers
multiverse-sec /assign architect claude
multiverse-sec /tmux "주문 API 만들어줘"
```

### 참고
- `/oauth` 는 `/login` 별칭입니다.
- provider별 실제 인증 방식은 서로 다를 수 있습니다.

## 실제 provider API 호출
현재 실행 엔진은 mock 텍스트가 아니라 실제 provider API를 호출합니다.

- Architect / Red / Blue는 각자 할당된 provider로 실제 역할 응답을 생성합니다.
- Consensus는 세 역할의 결과를 모아 실제 합의 응답을 생성합니다.
- Final은 합의 결과를 기반으로 최종 코드 초안을 생성합니다.

### 기본 모델
- OpenAI: `gpt-4.1-mini`
- Claude: `claude-sonnet-4-5`
- Gemini: `gemini-2.5-flash`

### 모델 변경
```bash
export MULTIVERSE_SEC_OPENAI_MODEL=gpt-5-mini
export MULTIVERSE_SEC_CLAUDE_MODEL=claude-sonnet-4-5
export MULTIVERSE_SEC_GEMINI_MODEL=gemini-2.5-flash
```

## 테스트
```bash
npm test
```

테스트는 stub provider server를 사용해 실제 호출 경로와 tmux 실행 경로를 함께 검증합니다.
