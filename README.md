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
npm run demo
```

### 직접 프롬프트 실행
```bash
node ./src/cli.js "보안이 강화된 login API 만들어줘"
node ./src/cli.js "회원가입 API 만들어줘" --no-delay
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
