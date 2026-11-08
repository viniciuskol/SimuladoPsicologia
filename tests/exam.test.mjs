import test from "node:test";
import assert from "node:assert/strict";
import * as E from "./exam.mjs";
import { AREAS, seeded, question, official, authored, languageBank, fullBank, realData } from "./fixtures.mjs";

const byId = qs => Object.fromEntries(qs.map(q => [q.id, q]));
const specificsOf = (ids, by) => ids.map(id => by[id]).filter(q => E.blockOf(q.area) === "especificas");
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

test("banco cheio: sempre 10/10/50, sem repetir, com textos contíguos", () => {
  const qs = fullBank(), by = byId(qs);
  for (let seed = 1; seed <= 300; seed++) {
    const o = E.buildExam(qs, AREAS, [], seeded(seed));
    assert.equal(o.length, 70);
    assert.equal(new Set(o).size, 70);
    const l = o.map(id => by[id]);
    assert.ok(l.slice(0, 10).every(q => q.area === "portugues"));
    assert.ok(l.slice(10, 20).every(q => q.area === "ingles"));
    assert.ok(l.slice(20).every(q => E.blockOf(q.area) === "especificas"));
    const closed = new Set();
    let cur = null;
    for (const q of l) {
      if (q.passage === cur) continue;
      if (q.passage) assert.ok(!closed.has(q.passage), `texto separado, semente ${seed}`);
      if (cur) closed.add(cur);
      cur = q.passage;
    }
  }
  const r = E.examReadiness(qs, AREAS);
  assert.equal(r.complete, true);
  assert.equal(r.total, 70);
  assert.equal(r.message, "");
  assert.equal(r.authoredUsed, 0);
});

test("divisão técnica soma 50, acompanha o banco e o sorteio a respeita", () => {
  const qs = [...languageBank("portugues"), ...languageBank("ingles"),
    ...official("etica", 5), ...official("resolucoes", 10), ...official("psi-org", 20),
    ...official("diag-org", 30), ...official("psi-social", 15), ...official("saude-trab", 40)];
  const a = E.allocateByArea(qs, AREAS, 50);
  assert.equal(sum(a), 50);
  assert.ok(Object.values(a).every(n => n >= 3));
  assert.ok(a["saude-trab"] > a["psi-org"] && a["psi-org"] > a.etica);
  const by = byId(qs);
  const picked = specificsOf(E.buildExam(qs, AREAS, [], seeded(7)), by);
  for (const [k, n] of Object.entries(a)) assert.equal(picked.filter(q => q.area === k).length, n);
});

test("segunda prova evita o que foi respondido", () => {
  const qs = fullBank(), by = byId(qs);
  const first = E.buildExam(qs, AREAS, [], seeded(3));
  const att = first.map(questionId => ({ questionId, area: by[questionId].area }));
  const second = E.buildExam(qs, AREAS, att, seeded(4));
  const overlap = second.filter(id => first.includes(id) && E.blockOf(by[id].area) === "especificas");
  assert.equal(overlap.length, 0);
});

test("só Português e Inglês, como o banco de hoje: 20 questões e aviso claro", () => {
  const qs = [...official("portugues", 60), ...official("ingles", 60)];
  for (let seed = 1; seed <= 50; seed++) {
    const o = E.buildExam(qs, AREAS, [], seeded(seed));
    assert.equal(o.length, 20);
    assert.equal(new Set(o).size, 20);
  }
  const r = E.examReadiness(qs, AREAS);
  assert.equal(r.complete, false);
  assert.equal(r.total, 20);
  assert.equal(r.blocks.find(b => b.key === "especificas").short, 50);
  assert.match(r.message, /20 de 70/);
  assert.match(r.message, /Conhecimentos Específicos: 0 de 50/);
  assert.equal(r.missingAreas.length, 6);
});

test("banco vazio ou pequeno não falha nem repete", () => {
  assert.deepEqual(E.buildExam([], AREAS), []);
  const empty = E.examReadiness([], AREAS);
  assert.equal(empty.total, 0);
  assert.match(empty.message, /não tem questões/);

  const qs = [...official("portugues", 3), ...official("etica", 2), ...official("saude-trab", 7)];
  for (let seed = 1; seed <= 50; seed++) {
    const o = E.buildExam(qs, AREAS, [], seeded(seed));
    assert.equal(o.length, 12);
    assert.equal(new Set(o).size, 12);
  }
  const r = E.examReadiness(qs, AREAS);
  assert.equal(r.total, 12);
  assert.deepEqual(r.blocks.map(b => b.use), [3, 0, 9]);
  assert.deepEqual(E.allocateByArea(qs, AREAS, 50), { etica: 2, resolucoes: 0, "psi-org": 0, "diag-org": 0, "psi-social": 0, "saude-trab": 7 });
});

test("id repetido no banco não repete na prova nem infla a contagem", () => {
  const dup = official("etica", 4);
  const qs = [...dup, ...dup];
  const o = E.buildExam(qs, AREAS, [], seeded(1));
  assert.equal(o.length, 4);
  assert.equal(new Set(o).size, 4);
  assert.equal(E.examReadiness(qs, AREAS).total, 4);
});

test("autoral fica fora quando há oficial suficiente em todas as áreas", () => {
  const areasSpecific = AREAS.filter(a => E.blockOf(a.id) === "especificas");
  const qs = [...fullBank(), ...areasSpecific.flatMap(a => authored(a.id, 5)), ...authored("portugues", 5), ...authored("ingles", 5)];
  const by = byId(qs);
  for (let seed = 1; seed <= 100; seed++) {
    assert.ok(E.buildExam(qs, AREAS, [], seeded(seed)).every(id => !E.isAuthored(by[id])));
  }
  assert.equal(E.examReadiness(qs, AREAS).authoredUsed, 0);
});

test("autoral completa só a área sem oficial, e oficial vem antes na mesma área", () => {
  const specificsOfficial = ["etica", "psi-org", "diag-org", "psi-social", "saude-trab"].flatMap(a => official(a, 20));
  const qs = [...languageBank("portugues"), ...languageBank("ingles"), ...specificsOfficial,
    ...authored("resolucoes", 8), ...authored("etica", 8)];
  const by = byId(qs);
  for (let seed = 1; seed <= 50; seed++) {
    const o = E.buildExam(qs, AREAS, [], seeded(seed));
    assert.equal(o.length, 70);
    assert.equal(new Set(o).size, 70);
    const chosen = o.filter(id => E.isAuthored(by[id])).map(id => by[id]);
    assert.equal(chosen.length, 3);
    assert.ok(chosen.every(q => q.area === "resolucoes"));
  }
  const mixed = [...official("etica", 1), ...authored("etica", 5)];
  const o = E.buildExam(mixed, AREAS, [], seeded(2));
  assert.equal(o.length, 6);
  assert.equal(o[0], "o-etica-1");
  assert.equal(E.allocateByArea(mixed, AREAS, 2).etica, 2);
});

test("autoral completa a língua e as específicas quando o banco oficial é curto", () => {
  const qs = [...official("portugues", 6), ...authored("portugues", 10), ...official("ingles", 10),
    ...official("etica", 5), ...authored("etica", 30), ...authored("saude-trab", 30)];
  const by = byId(qs);
  for (let seed = 1; seed <= 50; seed++) {
    const o = E.buildExam(qs, AREAS, [], seeded(seed));
    assert.equal(o.length, 70);
    assert.equal(new Set(o).size, 70);
    const pt = o.map(id => by[id]).filter(q => q.area === "portugues");
    assert.equal(pt.length, 10);
    assert.equal(pt.filter(q => !E.isAuthored(q)).length, 6);
    const specific = specificsOf(o, by);
    assert.equal(specific.length, 50);
    assert.equal(specific.filter(q => !E.isAuthored(q)).length, 5);
  }
  const r = E.examReadiness(qs, AREAS);
  assert.equal(r.complete, true);
  assert.equal(r.authoredUsed, 4 + 45);
});

test("com as oficiais esgotadas, autoral vai para a área com menos questões", () => {
  const qs = [...official("etica", 10), ...authored("etica", 30), ...official("saude-trab", 30), ...authored("saude-trab", 30)];
  const a = E.allocateByArea(qs, AREAS, 50);
  assert.equal(a.etica, 20);
  assert.equal(a["saude-trab"], 30);
});

test("banco só de autorais nas específicas ainda monta a parte possível", () => {
  const qs = [...authored("etica", 4), ...authored("saude-trab", 4)];
  const o = E.buildExam(qs, AREAS, [], seeded(5));
  assert.equal(o.length, 8);
  const r = E.examReadiness(qs, AREAS);
  assert.equal(r.total, 8);
  assert.equal(r.authoredUsed, 8);
  assert.equal(r.complete, false);
});

test("prova histórica: ordem original, lacunas, sem autoral nem questão reaproveitada", () => {
  const file = "cesgranrio-2018-psicologia.pdf";
  const of = (n, extra = {}) => question(`h${n}`, "etica", { source: { file, year: 2018, originalNumber: n, org: "Cesgranrio", exam: "Psicólogo", ...extra } });
  const qs = [of(3), of(1), of(5),
    question("aut", "etica", { source: { file, year: 2018, originalNumber: 2, authored: true, basis: "x" } }),
    question("reuso", "portugues", { source: { file: "outra.html", year: 2018, originalNumber: 1, reused: "banco auditado" } })];
  const h = E.historicExam(qs, 2018);
  assert.deepEqual(h.order, ["h1", "h3", "h5"]);
  assert.deepEqual(h.missing, [2, 4]);
  assert.deepEqual(E.historicExam(qs, file, 6).missing, [2, 4, 6]);
  assert.deepEqual(E.historicExam(qs, 1999), { order: [], missing: [], size: 0 });

  assert.deepEqual(E.historicExams(qs), [], "prova com poucas questões no banco fica só no treino");
  const list = E.historicExams(qs, 1);
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "Psicólogo");
  assert.deepEqual(list[0].order, ["h1", "h3", "h5"]);
});

test("filtro de origem: autoral tem opção própria e não conta como prova", () => {
  const qs = [...official("etica", 2),
    question("r1", "portugues", { source: { file: "x.html", year: 2011, reused: "banco auditado" } }),
    question("r2", "ingles", { source: { file: "y.html", year: 2011, reused: "banco auditado" } }),
    question("aut", "etica", { source: { file: "prova-etica.pdf", authored: true, basis: "x" } })];
  const all = AREAS.map(a => a.id);
  const sources = E.examSources(qs);
  assert.equal(sources.reduce((t, s) => t + s.count, 0), 4);
  assert.equal(sources.find(s => s.file === "prova-etica.pdf").count, 2);
  assert.deepEqual(sources.filter(s => s.year === 2011).map(s => s.label),
    ["2011 · Conhecimentos Gerais de outra ênfase (1)", "2011 · Conhecimentos Gerais de outra ênfase (2)"]);
  assert.deepEqual(E.filterQuestions(qs, { areaIds: all, file: E.AUTHORED_SOURCE }).map(q => q.id), ["aut"]);
  assert.equal(E.filterQuestions(qs, { areaIds: all, file: "prova-etica.pdf" }).length, 2);
  // No treino a autoral entra normalmente.
  assert.equal(E.filterQuestions(qs, { areaIds: ["etica"] }).length, 3);
  assert.equal(E.buildTraining(E.filterQuestions(qs, { areaIds: all }), 3).length, 3);
});

test("correção: em branco conta na prova, treino encerrado só o respondido, autoral é contada", () => {
  const qs = [...fullBank(), ...authored("etica", 1)];
  const by = byId(qs);
  const order = E.buildExam(qs, AREAS, [], seeded(9)).slice(0, 69);
  order.push("a-etica-1");
  const answers = {}, timeMs = {};
  order.slice(0, 30).forEach((id, i) => {
    const q = by[id];
    answers[id] = i % 2 ? q.correctKey : q.alternatives.find(a => a.key !== q.correctKey).key;
    timeMs[id] = 1000;
  });
  const s = { kind: "prova", order, answers, timeMs, elapsedMs: 30000 };
  const r = E.summarize(s, by, AREAS);
  assert.equal(r.total, 70);
  assert.equal(r.correct, 15);
  assert.equal(r.blank, 40);
  assert.equal(r.review.length, 55);
  assert.equal(r.authored, 1);
  assert.equal(r.blocks.reduce((t, b) => t + b.total, 0), 70);
  assert.equal(r.areas.reduce((t, b) => t + b.correct, 0), 15);
  assert.equal(r.subtopics.reduce((t, b) => t + b.total, 0), 70);
  const t = E.summarize({ ...s, kind: "treino" }, by, AREAS);
  assert.equal(t.total, 30);
  assert.equal(t.notReached, 40);
  assert.equal(t.blank, 0);
  assert.equal(t.authored, 0);
});

test("critério do edital: 50% em cada fase e sem zerar língua", () => {
  const mk = (pt, en, esp) => ({ blocks: [{ key: "portugues", correct: pt, total: 10 }, { key: "ingles", correct: en, total: 10 }, { key: "especificas", correct: esp, total: 50 }] });
  assert.equal(E.editalCut(mk(5, 5, 25)).passed, true);
  assert.equal(E.editalCut(mk(5, 5, 25)).complete, true);
  assert.equal(E.editalCut(mk(5, 5, 24)).specificOk, false);
  assert.equal(E.editalCut(mk(5, 4, 25)).generalOk, false);
  const z = E.editalCut(mk(10, 0, 50));
  assert.equal(z.noZero, false);
  assert.equal(z.generalOk, true);
  assert.equal(z.passed, false);
});

test("critério do edital: prova sem específicas não aprova por vazio", () => {
  const cut = E.editalCut({ blocks: [{ key: "portugues", correct: 10, total: 10 }, { key: "ingles", correct: 10, total: 10 }] });
  assert.equal(cut.evaluable, false);
  assert.equal(cut.specificOk, false);
  assert.equal(cut.passed, false);
  const partial = E.editalCut({ blocks: [{ key: "portugues", correct: 3, total: 5 }, { key: "ingles", correct: 3, total: 5 }, { key: "especificas", correct: 10, total: 10 }] });
  assert.equal(partial.evaluable, true);
  assert.equal(partial.complete, false);
});

test("banco real: o sorteio funciona com os dados atuais, sejam quantos forem", () => {
  const qs = realData("questions.json").questions;
  const areas = realData("areas.json").areas;
  const r = E.examReadiness(qs, areas);
  const o = E.buildExam(qs, areas, [], seeded(11));
  assert.equal(o.length, r.total);
  assert.equal(new Set(o).size, o.length);
  assert.equal(r.complete, r.total === 70);
  assert.ok(E.historicExams(qs).every(h => h.order.length > 0));
});
