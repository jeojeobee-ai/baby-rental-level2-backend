# baby-rental-level2-backend

햇빛구 육아용품 대여실 관리 웹앱의 **백엔드**(NestJS + PostgreSQL)입니다.
Level 1(용품·대여·소독 기록)에 **대여 신청·취소·대여 처리, 업무 규칙 R1~R6, 현황 숫자, 가상 데이터 초기화**를 더한 Level 2 버전입니다. 규칙은 화면이 아니라 이 서버가 지킵니다. 모든 데이터는 가상입니다.

- 기획서: [기획서.md](./기획서.md)
- 프론트엔드 저장소: https://github.com/jeojeobee-ai/baby-rental-level2-frontend
- 배포 주소: 아직 없음 (배포 뒤 이 줄에 적습니다)

> **무료 서버 안내** — 이 백엔드는 Render 무료 서버에 올립니다. 15분 동안 요청이 없으면 서버가 잠들고, 그 뒤 첫 접속은 **1분쯤 걸릴 수 있습니다.** 화면이 비어 보이면 잠시 기다렸다가 새로고침해 주세요.

## API

| 번호 | 요청 | 설명 |
|---|---|---|
| B1 | `GET /health` | DB 연결 확인 (`{"status":"ok","db":"connected"}`) |
| B2 | `GET /items` | 용품 목록 + 지금 상태 + 신청 중 여부(`hasPendingRequest`) |
| B3 | `GET /items/:id` | 용품 상세 + 대여·소독 기록 + 신청 기록 |
| B4 | `POST /items` | 용품 등록 |
| B5 | `POST /items/:id/rentals` | 대여 기록 직접 등록 |
| B6 | `PATCH /rentals/:id/return` | 반납 처리 |
| B7 | `POST /items/:id/sanitizations` | 소독 기록 등록 |
| B8 | `POST /items/:id/requests` | 대여 신청 등록 |
| B9 | `GET /requests?status=` | 신청 목록 (PENDING / APPROVED / CANCELLED) |
| B10 | `PATCH /requests/:id/cancel` | 신청 취소 |
| B11 | `POST /requests/:id/approve` | 대여 처리 (대여 기록 생성) |
| B12 | `GET /stats` | 전체·대여 중·대여 가능 숫자 |
| B13 | `POST /admin/reset-demo` | 가상 데이터 초기화 (아래 참고) |

잘못된 입력은 400과 `{ "errors": { "칸이름": "안내 문구" } }`로 돌려줍니다. 칸에 속하지 않는 안내는 `_form` 키에 담깁니다.

## 업무 규칙

| 번호 | 규칙 |
|---|---|
| R1 | "대여 가능" 상태인 용품만 신청·대여할 수 있습니다 (대여 중·소독 대기·재소독 필요·수리 필요는 이유와 함께 거절). |
| R2 | 아기 월령이 용품의 사용 월령 범위 안이어야 합니다 (양 끝 포함). |
| R3 | 한 용품에 신청 중인 건은 하나만 둘 수 있습니다. |
| R4 | 신청 취소와 대여 처리는 동시에 성공할 수 없고, 대여 처리된 신청은 취소할 수 없습니다. |
| R5 | 대여 처리 때 용품 상태를 다시 검사합니다. |
| R6 | 신청 중인 용품에는 직접 대여 기록을 만들 수 없습니다 (신청 목록에서 대여 처리). |

희망 기간은 1~30일이며, 대여 처리하는 날이 빌린 날, 그날부터 N일 뒤가 반납 예정일입니다. 동시에 요청이 와도 용품 줄 잠금과 DB 제약(신청 중 1건 고유 인덱스, CHECK)으로 한 건만 성공합니다.

## 가상 데이터 초기화 (B13)

시연 중 바뀐 내용을 지우고 처음 가상 데이터(용품 24개, 신청 4건)로 되돌립니다. 아래 조건을 **모두** 만족할 때만 동작합니다.

1. 서버 환경변수 `ALLOW_DEMO_RESET`이 `true`
2. 서버 환경변수 `DEMO_RESET_TOKEN`이 설정돼 있고, 요청 헤더 `x-reset-token`이 같은 값 (틀리면 401)
3. 접속한 DB 이름이 `baby_rental_level2` (아니면 403)

삭제와 다시 채우기는 한 트랜잭션이라 중간에 실패하면 원래대로 돌아갑니다. 토큰은 서버에만 있고 GitHub·프론트엔드 코드에는 없습니다.

## 설치

Node.js 22.9 이상과 PostgreSQL이 필요합니다.

```bash
npm install
```

## 실행 (내 컴퓨터)

1. 환경변수 파일을 만들고 `DATABASE_URL`에 DB 주소를 넣습니다.

   ```bash
   cp .env.example .env
   ```

2. 테이블을 만들고 가상 데이터를 넣습니다. 가상 데이터는 DB가 비어 있을 때만 들어갑니다.

   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

3. 서버를 켭니다. 주소는 http://localhost:4000 입니다.

   ```bash
   npm run build && npm start
   ```

`npm run seed -- --reset`은 기존 기록을 **모두 지우고** 다시 넣습니다.

## 환경변수

| 이름 | 뜻 | 비고 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 주소 | 비밀값. Render 대시보드에서 직접 입력 |
| `PORT` | 서버 포트 | Render가 자동으로 넣음 |
| `FRONTEND_ORIGIN` | 화면에서 API를 부를 수 있는 프론트엔드 주소 (쉼표로 여러 개) | 기본값 `http://localhost:3000` |
| `ALLOW_DEMO_RESET` | `true`일 때만 초기화 기능 켜짐 | 기본 꺼짐 |
| `DEMO_RESET_TOKEN` | 초기화 때 입력하는 토큰 | 비밀값. Render 대시보드에서 직접 입력 |

`.env`는 GitHub에 올라가지 않습니다.

## 시험

DB 이름이 `baby_rental_level2`일 때만 시작합니다(그 밖의 DB는 거부). 시험이 만든 `TEST-` 데이터는 끝나면 지웁니다.

```bash
npm run build
PORT=4100 node --env-file=.env dist/main &
BASE=http://localhost:4100 node --env-file=.env test/level2-api.test.mjs
BASE=http://localhost:4100 node --env-file=.env test/level1-regression.test.mjs
node --env-file=.env test/level2-admin.test.mjs
```

## 배포 (Render)

`render.yaml`(Blueprint)에 무료 웹 서비스 `baby-rental-level2-api`(Oregon) 설정이 들어 있습니다.

| 항목 | 값 |
|---|---|
| 빌드 명령 | `npm ci && npx prisma generate && npm run build` |
| 시작 명령 | `npm run start:render` (= `prisma migrate deploy && node dist/main`) |
| 헬스체크 | `/health` |

1. Render 대시보드에서 New → Blueprint로 이 저장소를 고릅니다.
2. 변경 목록에 웹 서비스 하나만 있는지 확인합니다.
3. 입력 칸에 값을 넣습니다 (위 환경변수 표 참고): `DATABASE_URL`, `FRONTEND_ORIGIN`, `DEMO_RESET_TOKEN`.
4. 배포가 끝나면 `https://<서비스 주소>/health`가 `connected`인지 확인합니다.

서버가 켜질 때마다 `prisma migrate deploy`가 먼저 실행되어 새 마이그레이션만 적용됩니다.
