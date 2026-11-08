import test from "node:test";
import assert from "node:assert/strict";
import * as P from "./planner.mjs";
import { question, official, authored, fullBank, realData } from "./fixtures.mjs";

const t0 = new Date("2026-11-05T12:00:00-03:00").getTime();
const byId = qs => Object.fromEntries(qs.map(q => [q.id, q]));
const cardsFor = (qs, n) => Array.from({ length: n }, (_, i) => ({ id: `fc-etica-${String(i).padStart(3, "0")}`, area: "etica", sourceQuestionId: qs[i % qs.length].id }));

test("valores esperados somam o tamanho de cada bloco", () => {
  const rows = P.subtopicPriority(fullBank(), []);
  const total = f => rows.filter(f).reduce((t, r) => t + r.expected, 0);
  assert.ok(Math.abs(total(r => r.area === "portugues") - 10) < 1e-9);
  assert.ok(Math.abs(total(r => r.area === "ingles") - 10) < 1e-9);
  assert.ok(Math.abs(total(r => !["portugues", "ingles"].includes(r.area)) - 50) < 1e-9);
});

test("questão autoral pesa menos que a oficial na estimativa", () => {
  const qs = [...official("etica", 2).map(q => ({ ...q, subtopic: "A" })), ...authored("etica", 2).map(q => ({ ...q, subtopic: "B" }))];
  const rows = P.subtopicPriority(qs, []);
  assert.ok(rows.find(r => r.subtopic === "A").expected > rows.find(r => r.subtopic === "B").expected);
  // Banco só de autorais não divide por zero.
  assert.ok(P.subtopicPriority(authored("etica", 2), []).every(r => Number.isFinite(r.expected)));
});

test("1 erro isolado não domina; erro repetido sobe; acertos recentes derrubam", () => {
  const qs = fullBank();
  const name = "etica assunto";
  const list = qs.filter(q => q.subtopic === name);
  const at = (i, correct, dt = i) => ({ questionId: list[i % list.length].id, area: list[0].area, correct, timestamp: t0 + dt });
  const find = attempts => P.subtopicPriority(qs, attempts).find(r => r.subtopic === name);
  const base = find([]).score;
  const one = find([at(0, false)]);
  assert.equal(one.errorPct, 100);
  assert.ok(one.smallSample);
  assert.ok(Math.abs(one.score / one.expected - 2 / 3) < 1e-9);
  const wrong = Array.from({ length: 10 }, (_, i) => at(i, false));
  assert.ok(find(wrong).score > base);
  const rec = find([...wrong, ...Array.from({ length: 10 }, (_, i) => at(i, true, 100 + i))]);
  assert.equal(rec.errorPct, 0);
  assert.equal(rec.attempts, 10);
  assert.ok(rec.score < base);
});

test("cards da questão vêm antes dos do assunto, sem repetir", () => {
  const qs = official("etica", 3), by = byId(qs);
  const cards = cardsFor(qs, 6);
  const q = by["o-etica-2"];
  const list = P.cardsForQuestion(q, cards, by);
  assert.equal(list[0].sourceQuestionId, q.id);
  assert.equal(new Set(list.map(x => x.id)).size, list.length);
  assert.ok(list.every(x => by[x.sourceQuestionId].subtopic === q.subtopic));
  assert.equal(P.cardsForQuestions([q, q], cards, by).length, list.length);
});

test("cota de novos reparte até a última semana e não recomeça no mesmo dia", () => {
  const qs = official("etica", 10), by = byId(qs);
  const cards = cardsFor(qs, 240);
  const rows = P.subtopicPriority(qs, []);
  const today = "2026-11-05";
  const d0 = P.dailyCards({ cards, srs: {}, today, daysLeft: 31, rows, byId: by });
  assert.equal(d0.newCards.length, 10);
  assert.equal(d0.reviews.length, 0);
  const srs = Object.fromEntries(d0.newCards.map(c => [c.id, { dueDate: "2026-11-06", firstSeen: today }]));
  const d1 = P.dailyCards({ cards, srs, today, daysLeft: 31, rows, byId: by });
  assert.equal(d1.newCards.length, 0);
  assert.equal(d1.newToday, 10);
  const next = P.dailyCards({ cards, srs, today: "2026-11-06", daysLeft: 30, rows, byId: by });
  assert.equal(next.reviews.length, 10);
  assert.equal(next.newCards.length, 10);
  const week = P.dailyCards({ cards, srs: {}, today: "2026-12-02", daysLeft: 4, rows, byId: by });
  assert.equal(week.newCards.length, 0);
});

test("prova completa: conta o dia, respeita janela, intervalo e meta", () => {
  const prova = (day, n) => Array.from({ length: n }, (_, i) => ({ questionId: "x" + i, area: "etica", mode: "prova", timestamp: new Date(`${day}T15:00:00-03:00`).getTime() + i }));
  assert.deepEqual(P.fullExamDays([...prova("2026-11-14", 70), ...prova("2026-11-15", 10), { questionId: "y", area: "etica", mode: "treino", timestamp: t0 }]), ["2026-11-14"]);
  assert.equal(P.fullExamAdvice([], "2026-11-05", 31).status, "soon");
  assert.equal(P.fullExamAdvice([], "2026-11-05", 31).inDays, 9);
  assert.equal(P.fullExamAdvice([], "2026-11-14", 22).status, "now");
  const gap = P.fullExamAdvice(["2026-11-14"], "2026-11-16", 20);
  assert.equal(gap.status, "gap");
  assert.equal(gap.inDays, 2);
  assert.equal(P.fullExamAdvice(["2026-11-14"], "2026-11-18", 18).status, "now");
  assert.equal(P.fullExamAdvice(["2026-11-14", "2026-11-20"], "2026-11-21", 15).status, "done");
  assert.equal(P.fullExamAdvice([], "2026-12-05", 1).status, "late");
});

test("erros pendentes excluem recuperados e filtram área", () => {
  const qs = official("etica", 2), by = byId(qs);
  const w = { groups: [{ area: "etica", items: [{ questionId: qs[0].id, recovered: false }, { questionId: qs[1].id, recovered: true }, { questionId: "sumiu", recovered: false }] }] };
  assert.deepEqual(P.pendingErrorIds(w, by), [qs[0].id]);
  assert.deepEqual(P.pendingErrorIds(w, by, "nada"), []);
});

/* ---------- Avisos de norma ---------- */

const norm = (stem, year, extra = {}) => {
  const { source, ...rest } = extra;
  return question("n", rest.area || "resolucoes", { stem, source: { year, ...source }, ...rest });
};
const notices = (stem, year, extra) => P.contentNotices(norm(stem, year, extra));

test("resolução revogada citada em prova anterior gera aviso com a norma atual", () => {
  const cases = [
    ["Segundo a Resolução CFP nº 007/2003, o laudo", 2014, /07\/2003, revogada pela Resolução CFP 06\/2019/],
    ["De acordo com a Res. CFP 7/03, o atestado", 2010, /07\/2003/],
    ["A Resolução do CFP n. 02/2003 define testes", 2012, /02\/2003, revogada pela Resolução CFP 09\/2018.*31\/2022/],
    ["A Resolução CFP nº 09/2018 estabelece", 2021, /09\/2018, revogada pela Resolução CFP 31\/2022/],
    ["Conforme a Resolução CFP nº 11, de 11 de maio de 2018, o atendimento", 2020, /11\/2018, revogada pela Resolução CFP 09\/2024/]
  ];
  for (const [stem, year, re] of cases) {
    const list = notices(stem, year);
    assert.equal(list.length, 1, stem);
    assert.match(list[0], re);
    assert.match(list[0], new RegExp(`Questão de ${year}`));
    assert.match(list[0], /gabarito é o oficial/);
  }
});

test("a norma também é procurada nas alternativas, mas não na explicação", () => {
  const q = question("n", "resolucoes", { stem: "Qual norma trata de documentos?", source: { year: 2015 } });
  assert.deepEqual(P.contentNotices(q), []);
  q.alternatives[1].text = "Resolução CFP nº 07/2003";
  assert.equal(P.contentNotices(q).length, 1);
  q.alternatives[1].text = "Outra";
  q.explanationSummary = "A Resolução CFP 07/2003 foi revogada";
  assert.deepEqual(P.contentNotices(q), []);
});

test("sem aviso em prova posterior à revogação e sem confundir números parecidos", () => {
  assert.deepEqual(notices("A Resolução CFP 06/2019 revogou a Resolução CFP 07/2003", 2022), []);
  assert.deepEqual(notices("A Resolução CFP nº 09/2018 estabelece", 2023), []);
  assert.deepEqual(notices("A Resolução CFP nº 17/2003 estabelece", 2010), []);
  assert.deepEqual(notices("A Resolução CFP nº 07/2013 estabelece", 2015), []);
  assert.deepEqual(notices("A Resolução CFP nº 12/2003 estabelece", 2010), []);
  assert.deepEqual(notices("O Código de Ética (Resolução CFP 10/2005) determina", 2010), []);
});

test("assunto do edital com norma mais nova que a prova, sem citar a antiga", () => {
  const docs = "2.5 Resolução CFP 6/2019 (documentos escritos)";
  const old = notices("O relatório psicológico deve conter", 2015, { subtopic: docs });
  assert.equal(old.length, 1);
  assert.match(old[0], /anterior à Resolução CFP 6\/2019/);
  assert.deepEqual(notices("O relatório psicológico deve conter", 2020, { subtopic: docs }), []);
  // Sem repetir o aviso quando a questão já citou a revogada.
  assert.equal(notices("Segundo a Resolução CFP 07/2003", 2015, { subtopic: docs }).length, 1);
  // Sem ano não dá para dizer que é anterior.
  assert.deepEqual(notices("O relatório psicológico deve conter", undefined, { subtopic: docs }), []);
});

test("CIPA, NR-1, CID e DSM antigos", () => {
  const saude = { area: "saude-trab" };
  assert.match(notices("A CIPA tem por objetivo", 2018, saude)[0], /Lei 14\.457\/2022.*Acidentes e de Assédio/);
  assert.deepEqual(notices("A CIPA tem por objetivo", 2023, saude), []);
  assert.match(notices("Segundo a Comissão Interna de Prevenção de Acidentes,", 2015, saude)[0], /14\.457/);

  assert.match(notices("Conforme a NR-1, o empregador", 2021, saude)[0], /Portaria MTE 1\.419\/2024/);
  assert.match(notices("Conforme a NR 01, o empregador", 2021, saude)[0], /psicossociais/);
  assert.deepEqual(notices("Conforme a NR-17, o empregador", 2021, saude), []);
  assert.deepEqual(notices("Conforme a NR-1, o empregador", 2025, saude), []);

  assert.match(notices("Pela CID-10, o transtorno", 2015, saude)[0], /CID-11/);
  assert.deepEqual(notices("Pela CID-10, o transtorno", 2024, saude), []);
  assert.match(notices("Segundo o DSM-IV-TR, o critério", 2015, saude)[0], /DSM-5-TR/);
  assert.deepEqual(notices("Segundo o DSM-5, o critério", 2015, saude), []);
});

test("autoral e questão de língua não recebem aviso de norma; confiança média continua", () => {
  const stem = "Segundo a Resolução CFP 07/2003 e a CIPA";
  assert.deepEqual(notices(stem, 2015, { source: { authored: true, basis: "x" } }), []);
  assert.deepEqual(notices(stem, 2015, { area: "portugues" }), []);
  const list = P.contentNotices(question("c", "etica", { verification: { confidence: "medium" } }));
  assert.equal(list.length, 1);
  assert.match(list[0], /confiança média/);
});

test("sem ano conhecido, a revogação ainda é avisada, sem inventar a data", () => {
  const list = notices("Segundo a Resolução CFP 07/2003", undefined);
  assert.equal(list.length, 1);
  assert.match(list[0], /^Esta questão cita/);
});

test("banco real: os avisos rodam em todas as questões, e nada de norma em língua", () => {
  for (const q of realData("questions.json").questions) {
    const list = P.contentNotices(q);
    assert.ok(Array.isArray(list));
    if (q.area === "portugues" || q.area === "ingles") assert.ok(list.every(t => /confiança média/.test(t)), q.id);
  }
});
