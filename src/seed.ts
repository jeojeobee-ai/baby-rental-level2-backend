// 가상 데이터 넣기 (기획서 6장 "가상 데이터")
//   npm run seed          → DB가 비어 있을 때만 넣습니다.
//   npm run seed -- --reset → 기존 용품·대여·소독 기록을 모두 지우고 다시 넣습니다.
// 모든 이름과 연락처는 가상입니다. 연락처는 010-0000-XXXX 형태만 씁니다.
import { ItemCategory, ItemCondition, Prisma, PrismaClient, SanitizationMethod } from '@prisma/client';
import { addDays, toDbDate, todayInKorea } from './common/dates';

type FinalState = 'AVAILABLE' | 'RENTED' | 'AWAITING' | 'RESANITIZE' | 'REPAIR' | 'NEW';

interface ItemSeed {
  code: string;
  name: string;
  category: ItemCategory;
  ages: [number, number];
  final: FinalState;
  memo?: string;
}

// 분류마다 6개씩 24개. 지금 상태 5가지가 모두 나오도록 마지막 상태를 정해 둡니다.
const ITEMS: ItemSeed[] = [
  { code: 'MOV-001', name: '휴대용 유모차', category: 'MOBILITY', ages: [6, 36], final: 'AVAILABLE' },
  { code: 'MOV-002', name: '디럭스 유모차', category: 'MOBILITY', ages: [0, 36], final: 'RENTED' },
  { code: 'MOV-003', name: '신생아 카시트', category: 'MOBILITY', ages: [0, 15], final: 'AWAITING' },
  { code: 'MOV-004', name: '주니어 카시트', category: 'MOBILITY', ages: [12, 72], final: 'RENTED' },
  { code: 'MOV-005', name: '아기띠', category: 'MOBILITY', ages: [0, 36], final: 'AVAILABLE' },
  { code: 'MOV-006', name: '힙시트', category: 'MOBILITY', ages: [6, 36], final: 'REPAIR', memo: '버클 한쪽이 잘 안 잠김' },
  { code: 'SLP-001', name: '원목 아기침대', category: 'SLEEP', ages: [0, 36], final: 'AVAILABLE' },
  { code: 'SLP-002', name: '접이식 아기침대', category: 'SLEEP', ages: [0, 24], final: 'RENTED' },
  { code: 'SLP-003', name: '범퍼침대', category: 'SLEEP', ages: [0, 48], final: 'RESANITIZE' },
  { code: 'SLP-004', name: '흔들침대', category: 'SLEEP', ages: [0, 9], final: 'AVAILABLE' },
  { code: 'SLP-005', name: '이동식 아기침대', category: 'SLEEP', ages: [0, 12], final: 'AWAITING' },
  { code: 'SLP-006', name: '아기 수면 매트', category: 'SLEEP', ages: [0, 36], final: 'NEW' },
  { code: 'FED-001', name: '젖병소독기', category: 'FEEDING', ages: [0, 24], final: 'AVAILABLE' },
  { code: 'FED-002', name: '아기 욕조', category: 'FEEDING', ages: [0, 24], final: 'RENTED' },
  { code: 'FED-003', name: '접이식 욕조', category: 'FEEDING', ages: [0, 36], final: 'AVAILABLE' },
  { code: 'FED-004', name: '분유 포트', category: 'FEEDING', ages: [0, 18], final: 'AWAITING' },
  { code: 'FED-005', name: '이유식 조리기', category: 'FEEDING', ages: [4, 24], final: 'AVAILABLE' },
  { code: 'FED-006', name: '하이체어', category: 'FEEDING', ages: [6, 48], final: 'REPAIR', memo: '다리 고정 나사 헐거움' },
  { code: 'PLY-001', name: '보행기', category: 'PLAY', ages: [6, 15], final: 'RENTED' },
  { code: 'PLY-002', name: '바운서', category: 'PLAY', ages: [0, 9], final: 'AVAILABLE' },
  { code: 'PLY-003', name: '점퍼루', category: 'PLAY', ages: [4, 12], final: 'RESANITIZE' },
  { code: 'PLY-004', name: '아기 체육관', category: 'PLAY', ages: [0, 12], final: 'AVAILABLE' },
  { code: 'PLY-005', name: '쏘서', category: 'PLAY', ages: [4, 12], final: 'AVAILABLE' },
  { code: 'PLY-006', name: '러닝홈', category: 'PLAY', ages: [6, 36], final: 'AWAITING' },
];

// 가상 제품 정보: [브랜드, 모델명, 구매일, 대표 사진]. 실제 제품·브랜드가 아닙니다.
// 마이그레이션 20261029100000_item_product_info 가 기존 DB에 넣는 값과 같습니다.
const PRODUCTS: Record<string, [string, string, string, string]> = {
  'MOV-001': ['햇빛베이비', '산책 S2 (HB-S210)', '2025-03-12', 'stroller'],
  'MOV-002': ['구름나래', '클라우드 디럭스 (CN-D500)', '2024-11-05', 'stroller'],
  'MOV-003': ['토닥랩', '포근 0+ (TD-C010)', '2025-06-20', 'car-seat'],
  'MOV-004': ['토닥랩', '든든 주니어 (TD-C300)', '2024-09-02', 'car-seat'],
  'MOV-005': ['솔방울키즈', '안아줘 캐리어 (SB-K100)', '2025-08-18', 'carrier'],
  'MOV-006': ['솔방울키즈', '힙업 시트 (SB-H200)', '2024-05-27', 'carrier'],
  'SLP-001': ['햇빛베이비', '나무숲 원목침대 (HB-B300)', '2024-10-14', 'crib'],
  'SLP-002': ['구름나래', '폴딩 미니베드 (CN-B120)', '2025-02-03', 'crib'],
  'SLP-003': ['구름나래', '말랑 범퍼베드 (CN-M200)', '2025-04-09', 'mattress'],
  'SLP-004': ['토닥랩', '살랑 흔들침대 (TD-R050)', '2024-12-16', 'crib'],
  'SLP-005': ['햇빛베이비', '나들이 바시넷 (HB-B110)', '2025-07-07', 'crib'],
  'SLP-006': ['솔방울키즈', '꿀잠 매트 (SB-M090)', '2026-09-30', 'mattress'],
  'FED-001': ['햇빛베이비', '반짝 UV 소독기 (HB-U400)', '2025-01-22', 'sterilizer'],
  'FED-002': ['솔방울키즈', '퐁당 욕조 (SB-T150)', '2024-08-11', 'bath'],
  'FED-003': ['구름나래', '폴딩 욕조 (CN-T220)', '2025-05-30', 'bath'],
  'FED-004': ['토닥랩', '따끈 분유포트 (TD-K070)', '2025-09-08', 'kettle'],
  'FED-005': ['햇빛베이비', '냠냠 쿠커 (HB-F160)', '2025-10-21', 'food-maker'],
  'FED-006': ['구름나래', '맘마 하이체어 (CN-H300)', '2024-06-25', 'high-chair'],
  'PLY-001': ['솔방울키즈', '아장 보행기 (SB-W060)', '2025-03-28', 'walker'],
  'PLY-002': ['토닥랩', '둥실 바운서 (TD-B080)', '2024-11-19', 'bouncer'],
  'PLY-003': ['구름나래', '콩콩 점퍼 (CN-J140)', '2025-02-14', 'activity-center'],
  'PLY-004': ['햇빛베이비', '반짝 플레이짐 (HB-P050)', '2024-07-30', 'play-gym'],
  'PLY-005': ['솔방울키즈', '빙글 쏘서 (SB-S070)', '2025-06-05', 'activity-center'],
  'PLY-006': ['토닥랩', '놀이집 러닝홈 (TD-L200)', '2024-12-02', 'play-house'],
};

const GUARDIANS = [
  '김하늘', '이서준', '박지우', '최민서', '정하윤', '강도윤', '조서연', '윤시우', '장지아', '임주원',
  '한예준', '오수아', '서은우', '신지호', '권하린', '황유준', '안채원', '송건우', '류다은', '홍지안',
];
const STAFF = ['강보람', '박지원', '이서윤'];
const METHODS: SanitizationMethod[] = ['STEAM', 'UV', 'WASH'];

// 기록한 때(created_at)는 그 날짜의 업무 시간으로 넣어, 같은 날의 앞뒤가 실제 순서와 맞게 합니다.
function at(date: string, hour: number): Date {
  // 한국 시간 hour시 = UTC hour-9시
  return new Date(toDbDate(date).getTime() + (hour - 9) * 3_600_000);
}

function buildHistory(seed: ItemSeed, index: number, today: string) {
  const rentals: Omit<Prisma.RentalCreateManyInput, 'itemId'>[] = [];
  const sanitizations: Omit<Prisma.SanitizationCreateManyInput, 'itemId'>[] = [];
  let guardianIndex = index * 3;

  const sanitize = (date: string, result: 'PASS' | 'FAIL', memo?: string) => {
    const n = sanitizations.length + index;
    sanitizations.push({
      sanitizedAt: toDbDate(date),
      staffName: STAFF[n % STAFF.length],
      method: METHODS[n % METHODS.length],
      result,
      memo: memo ?? null,
      createdAt: at(date, 16),
    });
  };

  const rent = (rentedAt: string, days: number, returnedAt: string | null) => {
    const guardian = GUARDIANS[guardianIndex % GUARDIANS.length];
    const phoneSuffix = String(1000 + ((guardianIndex * 37) % 9000)).padStart(4, '0');
    guardianIndex += 1;
    rentals.push({
      guardianName: guardian,
      guardianPhone: `010-0000-${phoneSuffix}`,
      childAgeMonths: Math.min(seed.ages[1], seed.ages[0] + ((guardianIndex * 5) % 12)),
      rentedAt: toDbDate(rentedAt),
      dueDate: toDbDate(addDays(rentedAt, days)),
      returnedAt: returnedAt ? toDbDate(returnedAt) : null,
      createdAt: at(rentedAt, 11),
    });
  };

  if (seed.final === 'NEW') return { rentals, sanitizations };

  // 처음 들어왔을 때 소독, 그 뒤 과거 대여 1~2번 (매번 반납 → 소독 완료)
  let day = addDays(today, -110 + (index % 7));
  sanitize(day, 'PASS');
  const pastCycles = 1 + (index % 2);
  for (let cycle = 0; cycle < pastCycles; cycle += 1) {
    const rentedAt = addDays(day, 2 + ((index + cycle) % 4));
    const keptDays = 14 + ((index * 3 + cycle * 5) % 15);
    const returnedAt = addDays(rentedAt, keptDays);
    rent(rentedAt, 30, returnedAt);
    sanitize(returnedAt, 'PASS');
    day = returnedAt;
  }

  switch (seed.final) {
    case 'AVAILABLE':
    case 'REPAIR':
      break;
    case 'RENTED': {
      // 최근에 빌려 가서 아직 반납 전
      const rentedAt = addDays(today, -(3 + (index % 12)));
      rent(rentedAt, 30, null);
      break;
    }
    case 'AWAITING': {
      // 최근에 반납됐지만 아직 소독 기록이 없음
      const returnedAt = addDays(today, -(index % 3));
      rent(addDays(returnedAt, -20), 30, returnedAt);
      break;
    }
    case 'RESANITIZE': {
      // 반납 뒤 소독했지만 얼룩이 남아 소독 미완료
      const returnedAt = addDays(today, -2);
      rent(addDays(returnedAt, -18), 30, returnedAt);
      sanitize(addDays(returnedAt, 1), 'FAIL', '얼룩이 남아 다시 세척 필요');
      break;
    }
  }
  return { rentals, sanitizations };
}

async function main() {
  const prisma = new PrismaClient();
  const reset = process.argv.includes('--reset');
  try {
    const existing = await prisma.item.count();
    if (existing > 0 && !reset) {
      console.log(`이미 용품 ${existing}개가 있어 가상 데이터를 넣지 않았어요. 지우고 다시 넣으려면: npm run seed -- --reset`);
      return;
    }

    const today = todayInKorea();
    await prisma.$transaction(async (tx) => {
      if (reset) {
        await tx.sanitization.deleteMany();
        await tx.rental.deleteMany();
        await tx.item.deleteMany();
      }
      for (const [index, seed] of ITEMS.entries()) {
        const condition: ItemCondition = seed.final === 'REPAIR' ? 'NEEDS_REPAIR' : index % 4 === 1 ? 'FAIR' : 'GOOD';
        const item = await tx.item.create({
          data: {
            code: seed.code,
            name: seed.name,
            category: seed.category,
            minAgeMonths: seed.ages[0],
            maxAgeMonths: seed.ages[1],
            condition,
            memo: seed.memo ?? null,
            brand: PRODUCTS[seed.code][0],
            modelName: PRODUCTS[seed.code][1],
            purchasedAt: toDbDate(PRODUCTS[seed.code][2]),
            imageUrl: `/items/${PRODUCTS[seed.code][3]}.svg`,
          },
        });
        const { rentals, sanitizations } = buildHistory(seed, index, today);
        await tx.rental.createMany({ data: rentals.map((r) => ({ ...r, itemId: item.id })) });
        await tx.sanitization.createMany({ data: sanitizations.map((s) => ({ ...s, itemId: item.id })) });
      }
    }, { timeout: 60_000 });

    const [items, rentals, sanitizations] = await Promise.all([
      prisma.item.count(),
      prisma.rental.count(),
      prisma.sanitization.count(),
    ]);
    console.log(`가상 데이터를 넣었어요: 용품 ${items}개, 대여 기록 ${rentals}개, 소독 기록 ${sanitizations}개`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
