// Level 2 API 시험 (신청·취소·대여 처리, 업무 규칙 R1~R6, 동시성, Level 1 회귀 일부)
//   실행: 서버를 켠 뒤  BASE=http://localhost:4100 node --env-file=.env test/level2-api.test.mjs
// 시험이 만든 데이터는 이름이 "TEST-"로 시작하고, 끝나면 지웁니다.
// 안전장치: 접속한 DB 이름이 baby_rental_level2 가 아니면 시작하지 않습니다.
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE ?? 'http://localhost:4100';
const prisma = new PrismaClient({ log: [] });
const results = [];
let seq = 900;

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const MSG = {
  RENTED: '이미 대여 중인 용품이에요. 반납 처리를 한 뒤 진행해 주세요.',
  AWAITING: '반납 뒤 소독 기록이 없는 용품이에요. 소독 기록을 먼저 남겨 주세요.',
  RESANITIZE: '마지막 소독이 완료되지 않은 용품이에요. 다시 소독한 뒤 진행해 주세요.',
  REPAIR: '수리가 필요한 용품이라 빌려줄 수 없어요.',
  EXISTS: '이미 신청 중인 용품이에요. 먼저 신청한 건을 대여 처리하거나 취소해 주세요.',
  PENDING_BLOCK: '신청 중인 건이 있는 용품이에요. 신청 목록에서 대여 처리하거나 신청을 취소해 주세요.',
  APPROVED_CANCEL: '이미 대여 처리된 신청이에요. 대여 처리된 신청은 취소할 수 없어요. 반납은 용품 상세에서 처리해 주세요.',
  APPROVED: '이미 대여 처리된 신청이에요.',
  CANCELLED: '이미 취소된 신청이에요.',
};

async function mkItem({ min = 6, max = 36, condition = 'GOOD', ready = true } = {}) {
  seq += 1;
  const r = await api('POST', '/items', {
    code: `MOV-${seq}`,
    name: `TEST-유모차 ${seq}`,
    category: 'MOBILITY',
    minAgeMonths: min,
    maxAgeMonths: max,
    condition,
  });
  if (r.status !== 201) throw new Error(`item create failed ${r.status} ${JSON.stringify(r.json)}`);
  const item = r.json;
  if (ready && condition !== 'NEEDS_REPAIR') await sanitize(item.id, 'PASS');
  return item;
}
const sanitize = (id, result = 'PASS', date = today) =>
  api('POST', `/items/${id}/sanitizations`, { sanitizedAt: date, staffName: '테스터', method: 'STEAM', result });
const reqBody = (o = {}) => ({ guardianName: '김하늘', guardianPhone: '010-0000-1234', childAgeMonths: 8, durationDays: 7, ...o });
const rentBody = (o = {}) => ({ guardianName: '김하늘', guardianPhone: '010-0000-1234', childAgeMonths: 8, rentedAt: today, dueDate: addDays(today, 7), ...o });
const request = (id, o) => api('POST', `/items/${id}/requests`, reqBody(o));
const rent = (id, o) => api('POST', `/items/${id}/rentals`, rentBody(o));
const detail = async (id) => (await api('GET', `/items/${id}`)).json;
const listItem = async (id) => (await api('GET', '/items')).json.find((i) => i.id === id);

function eq(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: 기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
  }
}
const form = (r) => r.json?.errors?._form;
async function test(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`통과  ${name}`);
  } catch (e) {
    results.push([name, false, e.message]);
    console.log(`실패  ${name}\n      ${e.message}`);
  }
}

async function cleanup() {
  const items = await prisma.item.findMany({ where: { name: { startsWith: 'TEST-' } }, select: { id: true } });
  const ids = items.map((i) => i.id);
  await prisma.rentalRequest.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.rental.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.sanitization.deleteMany({ where: { itemId: { in: ids } } });
  await prisma.item.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
  if (db !== 'baby_rental_level2') throw new Error(`안전장치: 접속한 DB가 ${db} 입니다. 시험을 시작하지 않습니다.`);
  await cleanup();

  // ----- 신청 · 취소 · 대여 처리 -----
  await test('T1 정상 신청: PENDING, 목록 "신청 중" 표시, 지금 상태는 그대로 대여 가능', async () => {
    const item = await mkItem();
    const r = await request(item.id);
    eq(r.status, 201, '상태 코드');
    eq(r.json.status, 'PENDING', '신청 상태');
    eq(r.json.elapsedDays, 0, '경과일');
    const li = await listItem(item.id);
    eq([li.hasPendingRequest, li.status], [true, 'AVAILABLE'], '목록 표시');
    const pending = (await api('GET', '/requests?status=PENDING')).json;
    eq(pending.some((x) => x.id === r.json.id && x.item.code === item.code), true, '신청 목록');
    eq((await detail(item.id)).requests.length, 1, '상세 신청 이력');
  });

  await test('T2 신청 입력 오류: 이름 1자·연락처·월령 73·기간 0/31/1.5', async () => {
    const item = await mkItem();
    const r = await request(item.id, { guardianName: '김', guardianPhone: '01012345678', childAgeMonths: 73, durationDays: 0 });
    eq(r.status, 400, '상태 코드');
    eq(Object.keys(r.json.errors).sort(), ['childAgeMonths', 'durationDays', 'guardianName', 'guardianPhone'], '오류 칸');
    for (const d of [31, 1.5, '', 'abc']) eq((await request(item.id, { durationDays: d })).json.errors.durationDays !== undefined, true, `기간 ${d}`);
    eq((await detail(item.id)).requests.length, 0, '저장 안 됨');
  });

  await test('T3·T4 신청 취소 후 재신청', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    const c = await api('PATCH', `/requests/${a.json.id}/cancel`);
    eq([c.status, c.json.status, c.json.cancelledAt !== null], [200, 'CANCELLED', true], '취소');
    eq((await listItem(item.id)).hasPendingRequest, false, '신청 중 표시 해제');
    eq((await request(item.id)).status, 201, '재신청');
  });

  await test('T5 대여 처리: 대여 기록 1건, 신청 APPROVED + rentalId, 용품 대여 중, 반납 예정일 = 오늘 + 7', async () => {
    const item = await mkItem();
    const a = await request(item.id, { durationDays: 7 });
    const r = await api('POST', `/requests/${a.json.id}/approve`);
    eq(r.status, 201, '상태 코드');
    eq([r.json.rentedAt, r.json.dueDate, r.json.returnedAt], [today, addDays(today, 7), null], '대여 기록 날짜');
    const d = await detail(item.id);
    eq([d.status, d.rentals.length], ['RENTED', 1], '용품 상태');
    eq([d.requests[0].status, d.requests[0].rentalId], ['APPROVED', r.json.id], '신청 연결');
  });

  await test('T6 기간 1일·30일 → 반납 예정일 오늘+1, 오늘+30 (Level 1 30일 규칙 통과)', async () => {
    for (const n of [1, 30]) {
      const item = await mkItem();
      const a = await request(item.id, { durationDays: n });
      const r = await api('POST', `/requests/${a.json.id}/approve`);
      eq([r.status, r.json.dueDate], [201, addDays(today, n)], `기간 ${n}`);
    }
  });

  await test('T7 대여 처리된 신청 재처리·취소 차단, 대여 기록 늘지 않음', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    await api('POST', `/requests/${a.json.id}/approve`);
    const again = await api('POST', `/requests/${a.json.id}/approve`);
    eq([again.status, form(again)], [400, MSG.APPROVED], '재처리');
    const cancel = await api('PATCH', `/requests/${a.json.id}/cancel`);
    eq([cancel.status, form(cancel)], [400, MSG.APPROVED_CANCEL], '취소');
    eq((await detail(item.id)).rentals.length, 1, '대여 기록 수');
    // 취소된 신청 처리
    const item2 = await mkItem();
    const b = await request(item2.id);
    await api('PATCH', `/requests/${b.json.id}/cancel`);
    eq(form(await api('POST', `/requests/${b.json.id}/approve`)), MSG.CANCELLED, '취소된 신청 대여 처리');
    eq(form(await api('PATCH', `/requests/${b.json.id}/cancel`)), MSG.CANCELLED, '취소된 신청 재취소');
  });

  await test('T8 대여 처리 뒤 반납 → 소독 대기 → 소독 → 대여 가능', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    const r = await api('POST', `/requests/${a.json.id}/approve`);
    eq((await api('PATCH', `/rentals/${r.json.id}/return`, { returnedAt: today })).status, 200, '반납');
    eq((await detail(item.id)).status, 'AWAITING_SANITIZATION', '반납 직후');
    eq((await sanitize(item.id)).status, 201, '소독');
    eq((await detail(item.id)).status, 'AVAILABLE', '소독 후');
  });

  // ----- 업무 규칙 -----
  await test('T9 R1: 대여 중·소독 대기·재소독 필요·수리 필요 용품 신청 차단', async () => {
    const rented = await mkItem();
    await rent(rented.id);
    const awaiting = await mkItem({ ready: false });
    const resan = await mkItem({ ready: false });
    await sanitize(resan.id, 'FAIL');
    const repair = await mkItem({ condition: 'NEEDS_REPAIR' });
    for (const [item, msg] of [[rented, MSG.RENTED], [awaiting, MSG.AWAITING], [resan, MSG.RESANITIZE], [repair, MSG.REPAIR]]) {
      const r = await request(item.id);
      eq([r.status, form(r)], [400, msg], `신청 ${item.code}`);
      const d = await rent(item.id);
      eq([d.status, form(d)], [400, msg], `직접 대여 ${item.code} (T10)`);
    }
  });

  await test('T11 R2: 월령 범위(6~36) 경계 6·36 성공, 5·37 실패 — 신청과 직접 대여 모두', async () => {
    for (const age of [6, 36]) {
      eq((await request((await mkItem()).id, { childAgeMonths: age })).status, 201, `신청 ${age}`);
      eq((await rent((await mkItem()).id, { childAgeMonths: age })).status, 201, `직접 대여 ${age}`);
    }
    for (const age of [5, 37]) {
      const r = await request((await mkItem()).id, { childAgeMonths: age });
      eq([r.status, r.json.errors.childAgeMonths], [400, '이 용품은 6~36개월 아기용이에요. 아기 월령을 확인해 주세요.'], `신청 ${age}`);
      const d = await rent((await mkItem()).id, { childAgeMonths: age });
      eq([d.status, d.json.errors.childAgeMonths !== undefined], [400, true], `직접 대여 ${age}`);
    }
  });

  await test('T12 R3: 같은 용품 두 번째 신청 차단, 동시 5건이면 1건만 저장', async () => {
    const item = await mkItem();
    eq((await request(item.id)).status, 201, '첫 신청');
    const second = await request(item.id);
    eq([second.status, form(second)], [400, MSG.EXISTS], '두 번째');
    const item2 = await mkItem();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => request(item2.id)));
    eq(rs.map((r) => r.status).sort(), [201, 400, 400, 400, 400], '동시 5건');
    eq((await detail(item2.id)).requests.filter((r) => r.status === 'PENDING').length, 1, '신청 중 1건');
  });

  await test('T13 R6: 신청 중인 용품 직접 대여 차단, 취소 뒤에는 가능', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    const d = await rent(item.id);
    eq([d.status, form(d)], [400, MSG.PENDING_BLOCK], '직접 대여');
    await api('PATCH', `/requests/${a.json.id}/cancel`);
    eq((await rent(item.id)).status, 201, '취소 뒤 직접 대여');
  });

  await test('T14 R4: 같은 신청에 취소와 대여 처리를 동시에 (8회) → 한쪽만 성공, 상태 일관', async () => {
    for (let i = 0; i < 8; i++) {
      const item = await mkItem();
      const a = await request(item.id);
      const [c, p] = await Promise.all([api('PATCH', `/requests/${a.json.id}/cancel`), api('POST', `/requests/${a.json.id}/approve`)]);
      const cancelOk = c.status === 200;
      const approveOk = p.status === 201;
      eq(cancelOk !== approveOk, true, `회차 ${i + 1} 한쪽만 성공 (취소 ${c.status}, 처리 ${p.status})`);
      const d = await detail(item.id);
      eq([d.requests[0].status, d.rentals.length], approveOk ? ['APPROVED', 1] : ['CANCELLED', 0], `회차 ${i + 1} 결과`);
    }
  });

  await test('T15 같은 신청의 대여 처리를 동시에 5건 → 대여 기록 1건', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => api('POST', `/requests/${a.json.id}/approve`)));
    eq(rs.map((r) => r.status).sort(), [201, 400, 400, 400, 400], '동시 5건');
    eq((await detail(item.id)).rentals.length, 1, '대여 기록 수');
  });

  await test('T16 R5: 신청 뒤 재소독 필요가 되면 대여 처리 차단, 신청은 PENDING 유지', async () => {
    const item = await mkItem();
    const a = await request(item.id);
    eq((await sanitize(item.id, 'FAIL')).status, 201, '소독 미완료 기록');
    const p = await api('POST', `/requests/${a.json.id}/approve`);
    eq([p.status, form(p)], [400, MSG.RESANITIZE], '대여 처리');
    const d = await detail(item.id);
    eq([d.requests[0].status, d.rentals.length], ['PENDING', 0], '신청 유지');
  });

  await test('T17 직접 대여와 신청을 동시에 (6회) → 한쪽만 성공', async () => {
    for (let i = 0; i < 6; i++) {
      const item = await mkItem();
      const [d, r] = await Promise.all([rent(item.id), request(item.id)]);
      eq([d.status, r.status].filter((s) => s === 201).length, 1, `회차 ${i + 1} 성공 건수 (직접 ${d.status}, 신청 ${r.status})`);
      const det = await detail(item.id);
      eq(det.rentals.length + det.requests.filter((x) => x.status === 'PENDING').length, 1, `회차 ${i + 1} 저장 건수`);
    }
  });

  await test('T18 없는 용품·신청·잘못된 주소·잘못된 상태 값', async () => {
    eq((await api('POST', '/items/999999/requests', reqBody())).status, 404, '없는 용품');
    eq((await api('POST', '/items/abc/requests', reqBody())).status, 404, '숫자 아닌 용품 id');
    eq((await api('PATCH', '/requests/999999/cancel')).status, 404, '없는 신청 취소');
    eq((await api('POST', '/requests/999999/approve')).status, 404, '없는 신청 처리');
    eq((await api('PATCH', '/requests/abc/cancel')).status, 404, '숫자 아닌 신청 id');
    eq((await api('GET', '/requests?status=WHAT')).status, 400, '잘못된 상태 값');
    eq((await api('GET', '/requests')).status, 200, '상태 생략');
  });

  // ----- Level 1 회귀 (일부) -----
  await test('회귀 F1: 대여 중 재대여 차단, 동시 5건 직접 대여는 1건', async () => {
    const item = await mkItem();
    eq((await rent(item.id)).status, 201, '첫 대여');
    eq(form(await rent(item.id)), MSG.RENTED, '재대여');
    const item2 = await mkItem();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => rent(item2.id)));
    eq(rs.map((r) => r.status).sort(), [201, 400, 400, 400, 400], '동시 5건');
    eq((await detail(item2.id)).rentals.filter((r) => r.returnedAt === null).length, 1, '대여 중 1건');
  });

  await test('회귀 F4: 마지막 반납일보다 이른 소독일 차단 / F5: 관리 번호 앞글자와 분류 불일치 차단', async () => {
    const item = await mkItem();
    const r = await rent(item.id, { rentedAt: addDays(today, -10), dueDate: addDays(today, -3) });
    await api('PATCH', `/rentals/${r.json.id}/return`, { returnedAt: addDays(today, -2) });
    const bad = await sanitize(item.id, 'PASS', addDays(today, -5));
    eq([bad.status, bad.json.errors.sanitizedAt !== undefined], [400, true], 'F4');
    const f5 = await api('POST', '/items', { code: 'MOV-899', name: 'TEST-F5', category: 'PLAY', minAgeMonths: 0, maxAgeMonths: 12, condition: 'GOOD' });
    eq([f5.status, f5.json.errors.code !== undefined], [400, true], 'F5');
  });

  await test('회귀: /health 와 용품 목록 응답에 Level 1 칸 유지', async () => {
    eq((await api('GET', '/health')).json, { status: 'ok', db: 'connected' }, 'health');
    const item = await mkItem();
    const li = await listItem(item.id);
    for (const k of ['id', 'code', 'name', 'category', 'minAgeMonths', 'maxAgeMonths', 'condition', 'brand', 'modelName', 'imageUrl', 'status', 'lastSanitizedAt']) {
      eq(k in li, true, `목록 칸 ${k}`);
    }
  });

  const removed = await cleanup();
  console.log(`\n시험 데이터 정리: TEST- 용품 ${removed}개 삭제`);
  const failed = results.filter((r) => !r[1]);
  console.log(`결과: ${results.length - failed.length} / ${results.length} 통과`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('시험 중단:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
