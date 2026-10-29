# baby-rental-level2-backend

햇빛구 육아용품 대여실 관리 웹앱의 **백엔드**(NestJS + PostgreSQL)입니다.
Level 2 기획서의 대여 신청·업무 규칙·현황·초기화 기능을 더하는 중입니다(현재는 Level 1에서 복사한 상태). API와 규칙은 [기획서.md](./기획서.md) 6~8장을 따릅니다. 모든 데이터는 가상입니다.

- 프론트엔드 저장소·배포 주소: 아직 만들지 않았습니다(Level 1 프로젝트와 별도로 새로 만듭니다).

## API

| 번호 | 요청 | 설명 |
|---|---|---|
| B1 | `GET /health` | DB 연결 확인 (`{"status":"ok","db":"connected"}`) |
| B2 | `GET /items` | 용품 목록 + 지금 상태 |
| B3 | `GET /items/:id` | 용품 상세 + 대여·소독 기록 |
| B4 | `POST /items` | 용품 등록 |
| B5 | `POST /items/:id/rentals` | 대여 기록 등록 |
| B6 | `PATCH /rentals/:id/return` | 반납 처리 |
| B7 | `POST /items/:id/sanitizations` | 소독 기록 등록 |

잘못된 입력은 400과 `{ "errors": { "칸이름": "안내 문구" } }`로 돌려줍니다.

### 물품 제품 정보 (선택 입력)

| 칸 (API / DB) | 뜻 | 규칙 |
|---|---|---|
| `brand` / `brand` | 브랜드 (가상) | 30자 이내 |
| `modelName` / `model_name` | 모델명 (가상) | 40자 이내 |
| `purchasedAt` / `purchased_at` | 구매일 | `YYYY-MM-DD`, 미래 날짜 안 됨 |
| `imageUrl` / `image_url` | 대표 사진 경로 | `src/items/item-images.ts`의 데모 그림 15개 중 하나 (예: `/items/stroller.svg`) |

마이그레이션 `20261029100000_item_product_info`가 이 칸들을 빈 값 허용으로 추가하고, 기존 가상 물품 24개에 값을 채웁니다. 기존 기록은 지우지 않습니다.

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

`npm run seed -- --reset`은 기존 용품·대여·소독 기록을 **모두 지우고** 다시 넣습니다.

## 환경변수

| 이름 | 뜻 |
|---|---|
| `DATABASE_URL` | PostgreSQL 주소 |
| `PORT` | 서버 포트 (Render가 자동으로 넣음) |
| `FRONTEND_ORIGIN` | 화면에서 API를 부를 수 있는 프론트엔드 주소 (쉼표로 여러 개) |

`.env`는 GitHub에 올라가지 않습니다.

## 배포 (Render)

`render.yaml`(Blueprint)에 무료 웹 서비스 `baby-rental-level2-api`(Oregon) 설정이 들어 있습니다.

1. Render 대시보드에서 New → Blueprint로 이 저장소를 고릅니다.
2. 변경 목록에 웹 서비스 하나만 있는지 확인합니다. DB는 Level 2 전용 DB를 따로 준비합니다(Level 1 DB 사용 금지).
3. 입력 칸에 값을 넣습니다.
   - `DATABASE_URL`: Level 2 전용 DB의 접속 주소
   - `FRONTEND_ORIGIN`: Vercel 프론트엔드 주소
4. 배포가 끝나면 `https://<서비스 주소>/health`가 `connected`인지 확인합니다.

서버가 켜질 때마다 `prisma migrate deploy`가 먼저 실행되어 새 마이그레이션만 적용됩니다. 무료 웹 서비스는 15분 동안 요청이 없으면 잠들고, 다음 요청 때 1분쯤 걸려 깨어납니다.
