# Colosseum-arena-ServiceRepo

3개의 AI 에이전트가 같은 기능 요청을 보고 각자 구현 전략을 스스로 세우고, 서로 비평과 토론을 거친 뒤, 가장 나은 결과를 현재 로컬 프로젝트 파일에 직접 반영하는 CLI 저장소입니다.

## 핵심 오케스트레이션

- `alpha`
- `beta`
- `gamma`

실행 흐름:

1. 세 에이전트가 현재 워크스페이스 파일을 읽고 각자 구현 전략과 계획을 스스로 제안합니다.
2. 세 에이전트가 서로의 계획을 비교 비평하고 장단점과 흡수할 아이디어를 토론합니다.
3. 가장 많은 표를 받은 전략이 토론 결과를 반영해 최종 패치를 다시 작성합니다.
4. CLI가 그 패치를 현재 로컬 파일에 적용합니다.

TTY 환경에서 `run`을 실행하면 제안 전략, 구현 계획, 토론 포인트, 승자 선정, 적용 파일 목록이 풀스크린 TUI로 단계별 표시됩니다.

## 요구 사항

- Node.js 18+
- provider별 유효한 API Key

## 설치

```bash
npm install
npm link
```

설치 후 `multiverse-sec` 명령을 사용할 수 있습니다.

## 지원 provider

- `codex`
- `claude`
- `gemini`

각 provider는 한 번 로그인하면 재사용됩니다.

provider가 하나만 연결된 상태라면 그 provider 하나를 3개 에이전트가 공통으로 사용해 실행합니다.

## 기본 설정

```bash
multiverse-sec /login codex
multiverse-sec /login claude
multiverse-sec /login gemini
```

## 에이전트별 provider 지정

```bash
multiverse-sec /assign alpha codex
multiverse-sec /assign beta claude
multiverse-sec /assign gamma gemini
```

## 에이전트별 모델 지정

```bash
multiverse-sec /model alpha gpt-5-mini
multiverse-sec /model beta claude-sonnet-4-5
multiverse-sec /model gamma gemini-2.5-flash
```

## 현재 설정 확인

```bash
multiverse-sec /providers
multiverse-sec /agents
```

## 실제 실행

현재 작업 폴더에서 실행하면, 폴더 안의 텍스트 파일을 읽고 최종 패치를 직접 적용합니다.

```bash
multiverse-sec "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘"
```

미리보기만 하려면:

```bash
multiverse-sec run "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘" --dry-run
```

TUI 대신 일반 텍스트 출력으로 보고 싶다면:

```bash
multiverse-sec run "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘" --plain
```

## 실행 테스트 명령어

아래 순서대로 실행하면 설정 확인부터 dry-run, 실제 파일 반영, 자동 테스트까지 바로 점검할 수 있습니다.

```bash
# 1) CLI 도움말 확인
multiverse-sec --help

# 2) provider 연결
multiverse-sec /login codex
multiverse-sec /login claude
multiverse-sec /login gemini

# 3) 에이전트별 provider 지정
multiverse-sec /assign alpha codex
multiverse-sec /assign beta claude
multiverse-sec /assign gamma gemini

# 4) 에이전트별 model 지정
multiverse-sec /model alpha gpt-5-mini
multiverse-sec /model beta claude-sonnet-4-5
multiverse-sec /model gamma gemini-2.5-flash

# 5) 현재 설정 확인
multiverse-sec /providers
multiverse-sec /agents

# 6) 실제 파일 변경 없이 제안/투표 흐름만 확인
multiverse-sec run "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘" --dry-run

# 7) 현재 프로젝트 파일에 실제 반영
multiverse-sec run "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘"

# 8) 저장소 자동 테스트 실행
npm test

# 9) 예전 tmux 분할 실행 잔여 세션 정리
multiverse-sec cleanup
```

## 설정 관련 명령

```bash
multiverse-sec /use codex
multiverse-sec /unassign alpha
multiverse-sec /unmodel beta
multiverse-sec /logout gemini
multiverse-sec /cleanup
```

## 인증 및 저장

- 최초 1회 연결 후 자동 재사용
- macOS에서는 기본적으로 Keychain 사용
- 그 외 환경에서는 권한 제한된 로컬 파일 저장 사용

## 테스트

```bash
npm test
```

테스트는 stub provider server를 이용해 다음을 검증합니다.

- provider 로그인/설정
- 에이전트별 provider/model 지정
- 3개 에이전트의 자율 전략 제안/토론/최종 패치 흐름
- 로컬 파일 실제 수정
