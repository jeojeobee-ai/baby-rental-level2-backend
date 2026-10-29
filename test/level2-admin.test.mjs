// 현황 숫자(B12)와 가상 데이터 초기화(B13) 시험
//   실행: npm run build && node --env-file=.env test/level2-admin.test.mjs
// 이 시험은 서버를 직접 세 개 띄웁니다(초기화 켬 / 끔 / 켰지만 토큰 없음). 토큰은 시험 때마다 무작위로 만들며 출력하지 않습니다.
// 주의: 초기화 시험은 Level 2 DB의 데이터를 가상 데이터로 되돌립니다. DB 이름이 baby_rental_level2 가 아니면 시작하지 않습니다.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const prisma = new PrismaClient({ log: [] });
const results = [];
const token = randomBytes(24).toString('hex');

const servers = [];
async function startServer(port, env) {
  const child = spawn(process.execPath, ['--env-file=.env', 'dist/main'], {
    env: { ...process.env, PORT: String(port), ALLOW_DEMO_RESET: '', DEMO_RESET_TOKEN: '', ...env },
    stdio: 'ignore',
  });
  servers.push(child);
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/health`);
      if ((await r.json()).db === 'connected') return `http://localhost:${port}`;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`서버 ${port} 시작 실패`);
}

async function call(base, method, path, { body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
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

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

// 데이터 지문: 행 수와 내용 해시 (초기화 거부·실패 때 데이터가 그대로인지 확인)
async function fingerprint() {
  const out = {};
  for (const t of ['items', 'rentals', 'sanitizations', 'rental_requests']) {
    const [row] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, '|' ORDER BY x.id), '')) AS h FROM ${t} x`);
    out[t] = [row.n, row.h];
  }
  return out;
}

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
  if (db !== 'baby_rental_level2') throw new Error(`안전장치: 접속한 DB가 ${db} 입니다. 시험을 시작하지 않습니다.`);

  const on = await startServer(4101, { ALLOW_DEMO_RESET: 'true', DEMO_RESET_TOKEN: token });
  const off = await startServer(4102, { DEMO_RESET_TOKEN: token });
  const noToken = await startServer(4103, { ALLOW_DEMO_RESET: 'true' });

  await test('T23 올바른 토큰으로 초기화: 가상 데이터로 복귀, 번호 1부터, 시험 데이터 사라짐', async () => {
    // 시험용으로 데이터를 하나 얹어 둔 뒤 초기화
    await call(on, 'POST', '/items', { body: { code: 'MOV-997', name: 'TEST-초기화 전', category: 'MOBILITY', minAgeMonths: 0, maxAgeMonths: 12, condition: 'GOOD' } });
    const r = await call(on, 'POST', '/admin/reset-demo', { headers: { 'x-reset-token': token } });
    eq(r.status, 200, '상태 코드');
    eq([r.json.ok, r.json.items, r.json.requests], [true, 24, 4], '응답 개수');
    const items = (await call(on, 'GET', '/items')).json;
    eq([items.length, Math.min(...items.map((i) => i.id)), items.some((i) => i.name.startsWith('TEST-'))], [24, 1, false], '용품 24개, id 1부터, 시험 데이터 없음');
    const statuses = new Set(items.map((i) => i.status));
    eq(['AVAILABLE', 'RENTED', 'AWAITING_SANITIZATION', 'NEEDS_RESANITIZATION', 'NEEDS_REPAIR'].every((s) => statuses.has(s)), true, '지금 상태 5가지');
    const reqs = (await call(on, 'GET', '/requests')).json;
    const by = (s) => reqs.filter((x) => x.status === s).length;
    eq([by('PENDING'), by('CANCELLED'), by('APPROVED')], [2, 1, 1], '신청 샘플');
    eq(reqs.find((x) => x.status === 'PENDING' && x.elapsedDays === 3) !== undefined, true, '3일 경과 샘플');
    const approved = reqs.find((x) => x.status === 'APPROVED');
    const detail = (await call(on, 'GET', `/items/${approved.itemId}`)).json;
    eq([detail.status, detail.rentals.some((x) => x.id === approved.rentalId && x.returnedAt === null)], ['RENTED', true], '대여 처리됨 샘플이 진행 중 대여와 연결');
    const again = await call(on, 'POST', '/admin/reset-demo', { headers: { 'x-reset-token': token } });
    eq([again.status, again.json.items], [200, 24], '두 번째 초기화');
  });

  await test('T22 현황 숫자 = 목록의 상태별 개수, 용품·대여 변화에 따라 바뀜', async () => {
    const count = async () => {
      const s = (await call(on, 'GET', '/stats')).json;
      const l = (await call(on, 'GET', '/items')).json;
      eq(s, { totalItems: l.length, rented: l.filter((i) => i.status === 'RENTED').length, available: l.filter((i) => i.status === 'AVAILABLE').length }, '목록과 대조');
      return s;
    };
    const a = await count();
    const item = (await call(on, 'POST', '/items', { body: { code: 'MOV-996', name: 'TEST-현황', category: 'MOBILITY', minAgeMonths: 0, maxAgeMonths: 36, condition: 'GOOD' } })).json;
    eq((await count()).totalItems, a.totalItems + 1, '용품 등록 뒤 전체');
    await call(on, 'POST', `/items/${item.id}/sanitizations`, { body: { sanitizedAt: today, staffName: '테스터', method: 'STEAM', result: 'PASS' } });
    const b = await count();
    eq(b.available, a.available + 1, '소독 뒤 대여 가능');
    const req = (await call(on, 'POST', `/items/${item.id}/requests`, { body: { guardianName: '김하늘', guardianPhone: '010-0000-1234', childAgeMonths: 8, durationDays: 7 } })).json;
    eq((await count()).available, b.available, '신청만으로는 대여 가능 숫자 그대로');
    await call(on, 'POST', `/requests/${req.id}/approve`);
    const c = await count();
    eq([c.rented, c.available], [b.rented + 1, b.available - 1], '대여 처리 뒤');
    // 정리
    await prisma.rentalRequest.deleteMany({ where: { itemId: item.id } });
    await prisma.rental.deleteMany({ where: { itemId: item.id } });
    await prisma.sanitization.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  await test('T24 토큰 없음·틀림·빈 값 → 401, 데이터 그대로', async () => {
    const before = await fingerprint();
    for (const headers of [{}, { 'x-reset-token': 'wrong' }, { 'x-reset-token': '' }, { 'x-reset-token': token + 'x' }, { 'x-reset-token': token.slice(0, -1) }]) {
      const r = await call(on, 'POST', '/admin/reset-demo', { headers });
      eq([r.status, typeof r.json?.errors?.token], [401, 'string'], `헤더 ${JSON.stringify(Object.keys(headers))}`);
    }
    eq(await fingerprint(), before, '데이터 지문');
  });

  await test('T25 환경변수 스위치 꺼짐 / 토큰 미설정 서버 → 403, 올바른 토큰을 보내도 실행 안 됨', async () => {
    const before = await fingerprint();
    for (const base of [off, noToken]) {
      const r = await call(base, 'POST', '/admin/reset-demo', { headers: { 'x-reset-token': token } });
      eq([r.status, r.json.message], [403, '초기화 기능이 꺼져 있어요.'], '꺼진 서버');
    }
    const r2 = await call(noToken, 'POST', '/admin/reset-demo', { headers: { 'x-reset-token': '' } });
    eq(r2.status, 403, '토큰 미설정 + 빈 헤더');
    eq(await fingerprint(), before, '데이터 지문');
  });

  await test('T26 초기화 도중 오류 → 전체 되돌림, 기존 데이터 그대로 (개발용 강제 오류)', async () => {
    const { seedDemoData } = require('../dist/seed.js');
    const real = new PrismaClient({ log: [] });
    let created = 0;
    const wrapTx = (tx) =>
      new Proxy(tx, {
        get(target, key) {
          if (key === 'item') {
            return new Proxy(target.item, {
              get(a, b) {
                if (b === 'create') {
                  return async (...args) => {
                    created += 1;
                    if (created === 10) throw new Error('강제 오류(시험용)');
                    return a.create(...args);
                  };
                }
                const v = a[b];
                return typeof v === 'function' ? v.bind(a) : v;
              },
            });
          }
          const v = target[key];
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    const faulty = new Proxy(real, {
      get(target, key) {
        if (key === '$transaction') return (fn, opts) => target.$transaction((tx) => fn(wrapTx(tx)), opts);
        const v = target[key];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const before = await fingerprint();
    let failed = false;
    try {
      await seedDemoData(faulty, { reset: true });
    } catch {
      failed = true;
    }
    await real.$disconnect();
    eq([failed, created], [true, 10], '강제 오류 발생');
    eq(await fingerprint(), before, '데이터 지문 (TRUNCATE까지 되돌려짐)');
  });

  await test('T27 저장소 파일에 토큰·DB 비밀번호가 없음 (추적 파일 검색)', async () => {
    const { execSync } = await import('node:child_process');
    const password = process.env.DATABASE_URL.match(/\/\/[^:]+:([^@]+)@/)[1];
    const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
    const { readFileSync } = await import('node:fs');
    const leaked = files.filter((f) => {
      try {
        const text = readFileSync(f, 'utf8');
        return text.includes(password) || text.includes(token);
      } catch {
        return false;
      }
    });
    eq(leaked, [], '비밀 값이 들어 있는 추적 파일');
    eq(files.some((f) => /(^|\/)\.env$/.test(f)), false, '.env 추적 여부');
  });

  const failed = results.filter((r) => !r[1]);
  console.log(`\n결과: ${results.length - failed.length} / ${results.length} 통과`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('시험 중단:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const s of servers) s.kill();
    await prisma.$disconnect();
  });
