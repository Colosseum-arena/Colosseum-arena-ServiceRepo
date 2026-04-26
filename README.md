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
1. 에이전트별 아이디어 제안
2. 에이전트 간 충돌과 조율
3. Judge 최종 합의
4. 최종 코드 결과 출력

## 현재 CLI 포인트
- Architect / Red Team / Blue Team / Judge 발화를 구분해 출력합니다.
- 사용자는 어떤 아이디어가 나왔고 어떻게 합의되었는지 터미널에서 바로 볼 수 있습니다.
- `--no-delay` 옵션으로 발표 리허설과 테스트를 빠르게 돌릴 수 있습니다.
