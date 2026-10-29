// Level 1 기능 회귀 시험 (Level 1 검증보고서의 화면 시험 1~8, API 보완 시험 A1·A2·A7을 API로 다시 확인)
//   실행: 서버를 켠 뒤  BASE=http://localhost:4100 node --env-file=.env test/level1-regression.test.mjs
// 시험이 만든 데이터는 이름이 "TEST-"로 시작하고 끝나면 지웁니다. DB 이름이 baby_rental_level2 가 아니면 시작하지 않습니다.
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE ?? 'http://localhost:4100';
const prisma = new PrismaClient({ log: [] });
const results = [];

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

async function api(method, path, body, raw) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}
function eq(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: 기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
  }
}
async function test(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`통과  ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`실패  ${name}\n      ${e.message}`);
  }
}

const itemBody = (n, o = {}) => ({ code: `MOV-${n}`, name: 'TEST-같은 모델 유모차', category: 'MOBILITY', minAgeMonths: 0, maxAgeMonths: 36, condition: 'GOOD', brand: '햇빛베이비', modelName: 'TEST-S1', purchasedAt: '2026-01-10', ...o });
const rentBody = (o = {}) => ({ guardianName: '김하늘', guardianPhone: '010-0000-1234', childAgeMonths: 8, rentedAt: today, dueDate: addDays(today, 7), ...o });
const sanBody = (o = {}) => ({ sanitizedAt: today, staffName: '테스터', method: 'STEAM', result: 'PASS', ...o });
const detail = async (id) => (await api('GET', `/items/${id}`)).json;
const status = async (id) => (await detail(id)).status;
const errs = (r) => r.json?.errors ?? {};

async function cleanup() {
  const ids = (await prisma.item.findMany({ where: { name: { startsWith: 'TEST-' } }, select: { id: true } })).map((i) => i.id);
  await prisma.rentalRequest.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.rental.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.sanitization.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.item.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
  if (db !== 'baby_rental_level2') throw new Error(`안전장치: 접속한 DB가 ${db} 입니다. 시험을 시작하지 않습니다.`);
  await cleanup();

  const ids = [];
  await test('L1-1 목록·상세 열림: 24개 이상, 상세에 대여·소독 기록 배열', async () => {
    const list = (await api('GET', '/items')).json;
    eq(list.length >= 24, true, '목록 개수');
    const d = await detail(list[0].id);
    eq([Array.isArray(d.rentals), Array.isArray(d.sanitizations)], [true, true], '기록 배열');
    eq((await api('GET', '/health')).json.db, 'connected', '/health');
  });

  await test('L1-2·3 같은 이름 유모차 5대 등록: 모두 소독 대기, 관리 번호·id 모두 다름, 제품 정보 저장', async () => {
    for (let n = 801; n <= 805; n++) {
      const r = await api('POST', '/items', itemBody(n));
      eq(r.status, 201, `등록 ${n}`);
      ids.push(r.json.id);
    }
    const list = (await api('GET', '/items')).json.filter((i) => ids.includes(i.id));
    eq(list.length, 5, '5줄');
    eq(new Set(list.map((i) => i.code)).size, 5, '관리 번호 5개');
    eq(new Set(list.map((i) => i.id)).size, 5, 'id 5개');
    eq(list.every((i) => i.status === 'AWAITING_SANITIZATION'), true, '모두 소독 대기');
    eq([list[0].brand, list[0].modelName, list[0].purchasedAt], ['햇빛베이비', 'TEST-S1', '2026-01-10'], '제품 정보');
  });

  await test('L1-4~6 한 대만 대여하면 다른 물품 그대로 → 반납 후 소독 대기 → 소독 후 대여 가능', async () => {
    for (const id of ids) eq((await api('POST', `/items/${id}/sanitizations`, sanBody())).status, 201, '소독');
    const r = await api('POST', `/items/${ids[0]}/rentals`, rentBody());
    eq(r.status, 201, '대여');
    eq(await Promise.all(ids.map(status)), ['RENTED', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE'], '대여 직후');
    eq((await api('PATCH', `/rentals/${r.json.id}/return`, { returnedAt: today })).status, 200, '반납');
    eq(await Promise.all(ids.map(status)), ['AWAITING_SANITIZATION', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE'], '반납 직후');
    eq((await api('POST', `/items/${ids[0]}/sanitizations`, sanBody())).status, 201, '재소독');
    eq(await status(ids[0]), 'AVAILABLE', '소독 후');
    // 소독 미완료는 재소독 필요
    await api('POST', `/items/${ids[1]}/sanitizations`, sanBody({ result: 'FAIL' }));
    eq(await status(ids[1]), 'NEEDS_RESANITIZATION', '소독 미완료');
  });

  await test('L1-7 잘못된 입력 차단: 칸별 안내, 저장 안 됨', async () => {
    const id = ids[2];
    const before = (await detail(id)).rentals.length;
    const bad = async (o) => (await api('POST', `/items/${id}/rentals`, rentBody(o)));
    eq(Object.keys(errs(await api('POST', `/items/${id}/rentals`, {}))).sort(), ['childAgeMonths', 'dueDate', 'guardianName', 'guardianPhone', 'rentedAt'], '필수 누락');
    eq(Object.keys(errs(await bad({ rentedAt: addDays(today, 1), dueDate: addDays(today, 5) }))), ['rentedAt'], '미래 빌린 날');
    eq(Object.keys(errs(await bad({ dueDate: addDays(today, -1) }))), ['dueDate'], '반납 예정일 역순');
    eq(Object.keys(errs(await bad({ dueDate: addDays(today, 31) }))), ['dueDate'], '30일 초과');
    eq((await bad({ dueDate: addDays(today, 30) })).status, 201, '정확히 30일은 통과');
    eq(Object.keys(errs(await bad({ guardianPhone: '01012341234' }))).includes('guardianPhone'), true, '연락처 형식');
    eq((await detail(id)).rentals.length, before + 1, '저장된 것은 30일 한 건뿐');
    // 대여 중 소독, 빌린 날보다 앞선 반납일
    eq(typeof errs(await api('POST', `/items/${id}/sanitizations`, sanBody()))._form, 'string', '대여 중 소독 차단');
    const rental = (await detail(id)).rentals[0];
    eq(Object.keys(errs(await api('PATCH', `/rentals/${rental.id}/return`, { returnedAt: addDays(today, -1) }))), ['returnedAt'], '빌린 날보다 앞선 반납일');
    // 중복 관리 번호
    eq(Object.keys(errs(await api('POST', '/items', itemBody(801)))), ['code'], '중복 관리 번호');
  });

  await test('L1-A1·A2 공백 이름·소수 월령·없는 날짜·공백 연락처 → 400, 없는 id·숫자 아닌 id → 404, 깨진 JSON → 400', async () => {
    eq((await api('POST', '/items', itemBody(806, { name: '   ' }))).status, 400, '공백 이름');
    eq((await api('POST', '/items', itemBody(806, { minAgeMonths: 1.5 }))).status, 400, '소수 월령');
    eq((await api('POST', '/items', itemBody(806, { purchasedAt: '2026-02-30' }))).status, 400, '없는 날짜');
    eq((await api('POST', `/items/${ids[3]}/rentals`, rentBody({ guardianPhone: '010 0000 1234' }))).status, 400, '공백 연락처');
    eq((await api('GET', '/items/99999999')).status, 404, '없는 id');
    eq((await api('GET', '/items/abc')).status, 404, '숫자 아닌 id');
    eq((await api('POST', '/items', undefined, '{broken')).status, 400, '깨진 JSON');
  });

  await test('L1-8 저장 유지: 다시 불러와도 기록 수와 상태가 같음', async () => {
    const a = await detail(ids[0]);
    const b = await detail(ids[0]);
    eq([a.status, a.rentals.length, a.sanitizations.length], [b.status, b.rentals.length, b.sanitizations.length], '재조회');
    eq([a.rentals.length, a.sanitizations.length], [1, 2], '기록 수');
  });

  await cleanup();
  const left = await prisma.item.count({ where: { name: { startsWith: 'TEST-' } } });
  const failed = results.filter((r) => !r[1]);
  console.log(`\n시험 데이터 남은 수: ${left}`);
  console.log(`결과: ${results.length - failed.length} / ${results.length} 통과`);
  if (failed.length || left) process.exitCode = 1;
}

main()
  .catch(async (e) => {
    console.error('시험 중단:', e.message);
    process.exitCode = 1;
    await cleanup().catch(() => {});
  })
  .finally(() => prisma.$disconnect());
