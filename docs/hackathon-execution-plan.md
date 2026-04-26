# 서비스 실행 계획

## 목표

현재 서비스의 목표는 하나의 사용자 요청을 3개의 AI 자율 에이전트가 각자 전략을 세워 풀고, 상호 비평을 거쳐 가장 나은 결과를 로컬 프로젝트 파일에 직접 반영하는 것입니다.

성공 기준:

- 정확성: 서로 다른 구현안 중 더 적합한 안을 고른다.
- 적용성: 결과가 단순 텍스트가 아니라 실제 파일 변경으로 이어진다.
- 운영성: provider 인증, 에이전트별 provider/model 설정, 재실행이 안정적이다.
- 확장성: 새 provider/model을 에이전트 단위로 바꿀 수 있다.

## 현재 오케스트레이션

기본 에이전트 3종:

- `alpha`
- `beta`
- `gamma`

실행 순서:

```text
사용자 요청
-> 워크스페이스 스냅샷 수집
-> 3개 자율 전략 생성
-> 3개 에이전트 상호 비평 및 투표
-> 승자 전략 재정제
-> 로컬 파일 반영
```

## 반드시 포함할 기능

- 에이전트별 provider 지정
- 에이전트별 model 지정
- 로컬 파일 직접 수정
- dry-run 미리보기
- provider 재사용 인증
- 실패 시 명확한 오류 메시지

## 이번 범위에서 제외

- 웹 대시보드
- 장기 서버형 오케스트레이션
- 복잡한 정적 분석 엔진 내장

## 운영 사용자 기준 실행 흐름

### 1. 초기 설정

```bash
multiverse-sec /login codex
multiverse-sec /login claude
multiverse-sec /login gemini
multiverse-sec /assign alpha codex
multiverse-sec /assign beta claude
multiverse-sec /assign gamma gemini
```

### 2. 모델 지정

```bash
multiverse-sec /model alpha gpt-5-mini
multiverse-sec /model beta claude-sonnet-4-5
multiverse-sec /model gamma gemini-2.5-flash
```

### 3. 서비스 실행

```bash
multiverse-sec "로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘"
```

### 4. 결과 확인

- 각 에이전트 전략 요약
- 상호 비평 및 토론 결과
- 승자 전략 및 투표 결과
- 실제 적용된 파일 목록

### 5. 실패 시 복구

- provider 상태 확인: `multiverse-sec /providers`
- agent 설정 확인: `multiverse-sec /agents`
- provider 재지정: `multiverse-sec /assign <agent> <provider>`
- model 재지정: `multiverse-sec /model <agent> <model>`

## 품질 게이트

- [ ] dry-run에서는 파일이 바뀌지 않는다.
- [ ] 실제 run에서는 파일이 바뀐다.
- [ ] 에이전트별 provider/model 설정이 실제 호출에 반영된다.
- [ ] 재실행 시 인증/설정이 정상 재사용된다.
- [ ] 테스트 스위트가 통과한다.

## 결론

이 프로젝트의 핵심은 "3개의 AI가 미리 정해진 패턴으로 답안을 내는 것"이 아니라, "각자 전략을 세우고 토론한 뒤 실제 프로젝트 파일에 적용 가능한 결과만 남기는 것"입니다.
