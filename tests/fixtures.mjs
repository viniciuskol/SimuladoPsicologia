// Bancos sintéticos: os testes não dependem de quantas questões já foram extraídas.
import fs from "node:fs";
import path from "node:path";

export const AREAS = ["etica", "resolucoes", "psi-org", "diag-org", "psi-social", "saude-trab", "portugues", "ingles"]
  .map(id => ({ id, label: id }));

export function seeded(s) {
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

export function question(id, area, extra = {}) {
  const { source, ...rest } = extra;
  return {
    id, area,
    subtopic: `${area} assunto`,
    stem: `Enunciado de ${id}`,
    alternatives: ["A", "B", "C", "D", "E"].map(key => ({ key, text: `Alternativa ${key}` })),
    correctKey: "C",
    explanationSummary: "Resumo.",
    source: { file: `prova-${area}.pdf`, year: 2021, originalNumber: 1, ...source },
    ...rest
  };
}

export const official = (area, n, prefix = "o") =>
  Array.from({ length: n }, (_, i) => question(`${prefix}-${area}-${i + 1}`, area, { source: { originalNumber: i + 1 } }));

export const authored = (area, n) =>
  Array.from({ length: n }, (_, i) => question(`a-${area}-${i + 1}`, area, {
    source: { file: undefined, year: undefined, originalNumber: undefined, authored: true, basis: "Resolução CFP 6/2019, art. 1º" }
  }));

// 4 textos de 4 questões cada e 4 avulsas.
export function languageBank(area) {
  return official(area, 20).map((q, i) => (i < 16 ? { ...q, passage: `Texto ${area} ${Math.floor(i / 4)}` } : q));
}

export function fullBank(perArea = 20) {
  const specifics = AREAS.filter(a => !["portugues", "ingles"].includes(a.id)).flatMap(a => official(a.id, perArea));
  return [...languageBank("portugues"), ...languageBank("ingles"), ...specifics];
}

export const realData = name => JSON.parse(fs.readFileSync(path.join(process.env.STUDY_DATA, name), "utf-8"));
