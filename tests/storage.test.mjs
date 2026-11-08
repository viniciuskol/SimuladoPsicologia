// Rode com tests/run.sh: ele copia storage.js para cá como storage.mjs e fixa o fuso.
import test from "node:test";
import assert from "node:assert/strict";

const RealDate = Date;
let nowMs = 0;
globalThis.Date = class extends RealDate {
  constructor(...a) { a.length ? super(...a) : super(nowMs); }
  static now() { return nowMs; }
};
const setNow = s => { nowMs = new RealDate(s).getTime(); };

let store = {}, failWrites = false;
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { if (failWrites) throw new Error("quota"); store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const S = await import("./storage.mjs");
const EXAM = "2026-12-06";
const srs = () => JSON.parse(store["transpetro2026-psi:srs"] || "{}");
const reset = () => { store = {}; failWrites = false; };

test("nenhum card fica para depois da prova sem revisão na janela final", () => {
  reset();
  setNow("2026-11-04T12:00:00-03:00");
  const dates = [];
  let today = new RealDate("2026-11-04T12:00:00-03:00");
  for (let i = 0; i < 40; i++) {
    setNow(today.toISOString());
    const c = [{ id: "fc-a-001" }];
    if (S.dueCards(c).length) { S.rateCard("fc-a-001", 3, EXAM); dates.push(today.toISOString().slice(0, 10)); }
    today = new RealDate(today.getTime() + 86400000);
    if (today >= new RealDate("2026-12-06T12:00:00-03:00")) break;
  }
  const last = dates[dates.length - 1];
  assert.ok(last >= "2026-12-02" && last <= "2026-12-05", last);
});

test("cards longos se espalham pelos 4 dias finais", () => {
  reset();
  setNow("2026-11-27T12:00:00-03:00");
  const count = {};
  store["transpetro2026-psi:srs"] = JSON.stringify(Object.fromEntries(
    Array.from({ length: 367 }, (_, i) => [`fc-a-${i}`, { interval: 20, easeFactor: 2.5, reps: 4, dueDate: "2026-11-27" }])));
  for (let i = 0; i < 367; i++) S.rateCard(`fc-a-${i}`, 3, EXAM);
  for (const s of Object.values(srs())) count[s.dueDate] = (count[s.dueDate] || 0) + 1;
  assert.deepEqual(Object.keys(count).sort(), ["2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]);
});

test("revisão antecipada não infla, mas Errei ainda rebaixa", () => {
  reset();
  setNow("2026-11-04T12:00:00-03:00");
  for (let i = 0; i < 4; i++) S.rateCard("x", 3, EXAM);
  assert.equal(srs().x.interval, 1);
  assert.equal(srs().x.dueDate, "2026-11-05");
  setNow("2026-11-05T12:00:00-03:00"); S.rateCard("x", 3, EXAM);
  const ef = srs().x.easeFactor; const iv = srs().x.interval;
  assert.ok(iv > 1);
  S.rateCard("x", 1, EXAM);
  assert.equal(srs().x.interval, 1); assert.equal(srs().x.reps, 0); assert.equal(srs().x.easeFactor, ef - 0.2);
  S.rateCard("x", 1, EXAM);
  assert.equal(srs().x.easeFactor, ef - 0.2);
});

test("o dia vira à meia-noite local, não às 21h", () => {
  reset();
  setNow("2026-11-10T20:59:00-03:00");
  S.rateCard("y", 3, EXAM);
  assert.equal(srs().y.dueDate, "2026-11-11");
  setNow("2026-11-10T21:01:00-03:00");
  assert.equal(S.dueCards([{ id: "y" }]).length, 0);
  setNow("2026-11-11T00:01:00-03:00");
  assert.equal(S.dueCards([{ id: "y" }]).length, 1);
});

test("falha de gravação não lança e a sessão mantém o estado", () => {
  reset();
  setNow("2026-11-10T12:00:00-03:00");
  failWrites = true;
  assert.equal(S.recordAttempt({ questionId: "q", area: "a", correct: true }), false);
  assert.equal(S.rateCard("z", 3, EXAM), false);
  assert.equal(S.dueCards([{ id: "z" }]).length, 0);
  failWrites = false;
  assert.equal(S.rateCard("w", 1, EXAM), true);
  assert.ok(srs().z && srs().w);
});

test("storage estranho não quebra", () => {
  reset();
  setNow("2026-11-10T12:00:00-03:00");
  for (const bad of ["5", "[1]", "null", "{oops", '{"a":{"interval":1}}']) {
    store["transpetro2026-psi:srs"] = bad;
    assert.equal(S.dueCards([{ id: "a" }]).length, 1, bad);
  }
});

test("exportar e importar devolve o mesmo progresso", () => {
  reset();
  setNow("2026-11-10T12:00:00-03:00");
  S.recordAttempt({ questionId: "q1", area: "ux", chosenKey: "A", correct: false });
  S.rateCard("c1", 3, EXAM);
  S.setPlanCheck("b1#k", true);
  const text = JSON.stringify(S.exportProgress());
  store = {};
  const b = S.parseBackup(text);
  assert.deepEqual(b.counts, { attempts: 1, srs: 1, plan: 1 });
  assert.equal(S.restoreProgress(b), true);
  assert.equal(S.loadAttempts().length, 1);
  assert.equal(S.loadSRS().c1.reps, 1);
  assert.equal(S.loadPlanChecks()["b1#k"], true);
  for (const bad of ["x", "{}", '{"app":"outro","attempts":[]}', '{"app":"transpetro2026-psi"}']) assert.equal(S.parseBackup(bad), null);
});

test("importação com falha preserva o estado anterior", () => {
  reset();
  setNow("2026-11-10T12:00:00-03:00");
  S.recordAttempt({ questionId: "old", area: "ux", correct: true });
  const b = S.parseBackup(JSON.stringify({ app: "transpetro2026-psi", attempts: [{ questionId: "new", area: "ux" }], srs: {}, plan: {} }));
  const real = localStorage.setItem; let n = 0;
  localStorage.setItem = (k, v) => { if (++n === 2) throw new Error("quota"); real(k, v); };
  assert.equal(S.restoreProgress(b), false);
  localStorage.setItem = real;
  assert.equal(S.loadAttempts()[0].questionId, "old");
});

test("chave do plano continua a mesma depois do refactor", () => {
  let h = 0x811c9dc5; const s = "texto";
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  assert.equal(S.planItemKey(3, "texto"), `b3#${h.toString(36)}`);
});
