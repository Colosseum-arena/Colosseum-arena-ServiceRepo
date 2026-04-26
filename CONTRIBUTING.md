# 기여 및 작업 플로우

## 기본 원칙
- 기본 브랜치는 `develop` 입니다.
- 모든 작업은 반드시 `develop` 최신 기준에서 시작합니다.
- 작업 시작 전 GitHub 이슈를 먼저 생성합니다.
- 이슈, 브랜치, 커밋, PR 제목은 한국어로 작성합니다.
- PR의 base 브랜치는 항상 `develop` 입니다.

## 작업 순서
1. `develop` 브랜치 최신화
   - `git checkout develop`
   - `git pull origin develop`
2. GitHub 이슈 생성
3. 이슈 번호로 작업 브랜치 생성
   - 형식: `타입/이슈번호-작업-제목`
   - 예시: `feat/264-로드맵-수정-채팅-내역-조회-api-추가`
4. 작업 후 커밋
5. 원격 브랜치 푸시
6. `develop` 대상 PR 생성
7. 리뷰 후 `develop`으로 머지

## 브랜치 규칙
- 브랜치 형식: `타입/이슈번호-작업-제목`
- 타입 예시
  - `feat`: 기능 추가
  - `fix`: 버그 수정
  - `refactor`: 리팩터링
  - `chore`: 설정/문서/환경 정리
  - `test`: 테스트 작업
  - `docs`: 문서 작업

## 커밋 규칙
- 제목 형식: `타입 (#이슈번호) : 작업 제목`
- 예시: `feat (#264) : 로드맵 수정 채팅 내역 조회 API 추가`
- 커밋 설명은 최대한 간결하게 작성합니다.
- 본문이 필요하면 한두 줄로만 요약합니다.
- 저장소 규칙에 따라 Lore trailer는 유지합니다.

## PR 규칙
- PR 제목과 내용은 한국어로 작성합니다.
- PR 제목은 커밋 제목과 유사한 수준으로 간결하게 작성합니다.
- PR 본문에는 변경 내용, 테스트 결과, 영향 범위를 짧게 정리합니다.
- 머지 대상은 항상 `develop` 입니다.

## 권장 명령어 예시
```bash
git checkout develop
git pull origin develop
git checkout -b feat/264-로드맵-수정-채팅-내역-조회-api-추가

# 작업 후
git add .
git commit
# 제목 예시: feat (#264) : 로드맵 수정 채팅 내역 조회 API 추가

git push -u origin feat/264-로드맵-수정-채팅-내역-조회-api-추가
gh pr create --base develop
```
