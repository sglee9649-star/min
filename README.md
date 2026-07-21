# 영어 스피킹 평가 플랫폼

영어 AI 리텔링 대회 운영 + 학생 스피킹 연습(리텔링 / 보고 읽기 / 질문 답변) 웹앱.

- 프로젝트 명세서: [CLAUDE.md](./CLAUDE.md)
- 평가항목 전체 카탈로그: [docs/EVALUATION_CRITERIA.md](./docs/EVALUATION_CRITERIA.md)

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## 현재 상태: 2단계 완료 (AI 문제 생성)

| 화면 | 주소 | 내용 |
|---|---|---|
| 입장 | `/` | 대회명 표시 + 역할 선택 |
| 참가자 | `/participant` | 참가번호 입력 → 자비스 스타일 대기화면 |
| 심사위원 | `/judge` | 접속코드 `judge2026` (임시) |
| 관리자 | `/admin` | 접속코드 `admin2026` (임시) · 대회명/타이머 설정 동작함 |
| 문제 생성 | `/admin/generate` | 학년·레벨·카테고리/키워드 → AI 지문·질문 생성 (API 키 필요) |
| 발표 화면 | `/display` | 프로젝터용 대회명 표시 |

⚠️ 접속코드는 개발용 임시 장치입니다. 실제 대회 전(2단계)에 Supabase 로그인으로 교체됩니다.

## API 키 설정 (문제 생성에 필요)

1. `.env.example`을 복사해 `.env.local` 파일을 만듭니다.
2. `ANTHROPIC_API_KEY=` 뒤에 발급받은 키를 붙여넣습니다.
3. `npm run dev`를 다시 시작합니다.

Vercel에 배포할 때는 Vercel 프로젝트 설정 → Environment Variables에 같은 이름으로 키를 등록하세요.

## 다음 단계

CLAUDE.md의 단계별 계획을 따릅니다. 다음은 3단계 — 녹음 + 타이머입니다.
