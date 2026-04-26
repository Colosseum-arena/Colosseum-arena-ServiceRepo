# Colosseum-arena-ServiceRepo

AI 협업 보안 코드 생성 데모용 CLI 저장소입니다.

## 작업 플로우
- 기본 브랜치: `develop`
- 작업 규칙: [CONTRIBUTING.md](CONTRIBUTING.md)
- 상세 가이드: [docs/git-workflow.md](docs/git-workflow.md)

## 해커톤 데모 실행

### 요구 사항
- Node.js 18+

### 실행
```bash
multiverse-sec "보안이 강화된 login API 만들어줘"
```

### 명시적 run 명령
```bash
multiverse-sec run "보안이 강화된 login API 만들어줘"
multiverse-sec /run "회원가입 API 만들어줘"
```

### 빠른 테스트 실행
```bash
npm test
```

## 데모에서 보여주는 흐름
1. 좌측 패널에서 Architect / Red Team / Blue Team 작업 확인
2. 우측 상단 Consensus Board에서 의견 충돌과 합의 확인
3. 우측 하단 Final Decision에서 확정 이유와 최종 코드 확인

## 현재 CLI 포인트
- 좌측/우측 분할 패널로 각 AI의 작업 위치와 역할을 명확하게 보여줍니다.
- Consensus Board에서 어떤 의견이 충돌했고 왜 그 방향으로 확정됐는지 바로 볼 수 있습니다.
- Final Decision 패널에서 최종 코드 미리보기까지 한 화면에서 확인할 수 있습니다.
- `--no-delay` 옵션으로 발표 리허설과 테스트를 빠르게 돌릴 수 있습니다.


## 실제 tmux 분할 데모

### 실행
```bash
npm run tmux-demo
```

또는
```bash
node ./src/cli.js --tmux "결제 API 만들어줘"
```

### 패널 구성
- 좌측: Architect / Red Team / Blue Team
- 우측 상단: Consensus Board
- 우측 하단: Final Decision

### 참고
- 세션만 만들고 바로 붙지 않으려면 `--no-attach`
- 세션 이름을 바꾸려면 `--session-name my-demo`


## 로그인 저장형 인증

### 개요
- 최초 1회만 provider를 연결하면 다음 실행부터 자동 재사용합니다.
- 민감한 API 키는 일반 설정 파일이 아니라 안전 저장소에 보관합니다.
- macOS에서는 기본적으로 Keychain을 사용합니다.

### 명령어
```bash
node ./src/cli.js login
node ./src/cli.js providers
node ./src/cli.js logout --provider openai
```

### 동작 방식
- `login`: OpenAI / Claude / Gemini 중 하나를 선택해 키를 저장
- `providers`: 현재 연결 상태와 기본 provider 확인
- `logout`: 특정 provider 연결 제거
- 일반 실행 / tmux 실행: 저장된 기본 provider를 자동 재사용


## 다중 provider 연결과 역할별 할당

### 여러 provider 연결
```bash
node ./src/cli.js login --provider openai
node ./src/cli.js login --provider claude
node ./src/cli.js login --provider gemini
```

### 기본 provider 변경
```bash
node ./src/cli.js use --provider openai
```

### 역할별 provider 할당
```bash
node ./src/cli.js assign --assign-role architect --provider claude
node ./src/cli.js assign --assign-role red --provider gemini
node ./src/cli.js assign --assign-role blue --provider openai
node ./src/cli.js assign --assign-role consensus --provider claude
node ./src/cli.js assign --assign-role final --provider gemini
```

### 현재 매핑 확인
```bash
node ./src/cli.js providers
```

### 역할 할당 제거
```bash
node ./src/cli.js unassign --assign-role final
```


## 단축 실행과 슬래시 명령

### 실행 파일처럼 사용
한 번만 아래를 실행하면 이후 `node ./src/cli.js` 없이 바로 실행할 수 있습니다.
```bash
npm link
multiverse-sec /mode
multiverse-sec "로그인 API 만들어줘"
```

### 슬래시 명령 예시
```bash
multiverse-sec /mode
multiverse-sec /login openai
multiverse-sec /providers
multiverse-sec /use openai
multiverse-sec /assign architect claude
multiverse-sec /assign red gemini
multiverse-sec /tmux "주문 API 만들어줘"
```

### 참고
- `/oauth` 는 `/login` 별칭입니다.
- 실제로는 provider별 인증 방식이 다르므로 공통 OAuth 자체를 의미하지는 않습니다.


## 실제 provider API 호출

이제 tmux 실행 시 mock 텍스트가 아니라 역할별 provider에 실제 API 요청을 보냅니다.

- Architect / Red / Blue는 각자 할당된 provider로 실제 역할 응답을 생성합니다.
- Consensus는 세 역할의 결과를 모아 실제 합의 응답을 생성합니다.
- Final은 합의 결과를 기반으로 최종 코드 초안을 생성합니다.

### provider 기본 모델
- OpenAI: `gpt-4.1-mini`
- Claude: `claude-sonnet-4-5`
- Gemini: `gemini-2.5-flash`

### 모델 변경
환경 변수로 바꿀 수 있습니다.
```bash
export MULTIVERSE_SEC_OPENAI_MODEL=gpt-5-mini
export MULTIVERSE_SEC_CLAUDE_MODEL=claude-sonnet-4-5
export MULTIVERSE_SEC_GEMINI_MODEL=gemini-2.5-flash
```
