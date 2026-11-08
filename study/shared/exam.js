// Regras do simulado sem nada de tela: montagem da prova, filtros do treino e
// correção. O sorteio recebe `rng` para poder ser testado com sequência fixa.

export const EXAM_SHAPE = { portugues: 10, ingles: 10, especificas: 50 };
export const EXAM_TOTAL = EXAM_SHAPE.portugues + EXAM_SHAPE.ingles + EXAM_SHAPE.especificas;

// Valor do filtro "Prova de origem" que seleciona as questões autorais.
export const AUTHORED_SOURCE = "__autorais__";

// Toda área do edital com questão no banco aparece na prova sorteada com pelo menos
// isto, mesmo que as provas antigas quase não a cobrem.
const MIN_AREA_SHARE = 3;
// Metade das específicas segue o peso de cada área no programa do edital (número de
// subitens do Anexo IV); a outra metade segue o histórico do banco. Sem essa parte, áreas
// novas no edital (as resoluções do CFP) quase não apareciam, porque provas antigas
// não as cobravam. É estimativa: o edital não informa a distribuição por área.
const EDITAL_WEIGHT = 0.5;

const BLOCK_LABELS = {
  portugues: "Língua Portuguesa",
  ingles: "Língua Inglesa",
  especificas: "Conhecimentos Específicos"
};

export function blockOf(area) {
  return area === "portugues" || area === "ingles" ? area : "especificas";
}

export function blockLabel(area) {
  return BLOCK_LABELS[blockOf(area)];
}

// Questão autoral: escrita para o estudo, não veio de prova oficial.
export const isAuthored = q => !!q?.source?.authored;
// Questão de Conhecimentos Gerais aproveitada de prova de outra ênfase.
const isReused = q => !!q?.source?.reused;
const isHistoric = q => !isAuthored(q) && !isReused(q);

function uniqueById(questions) {
  return [...new Map(questions.map(q => [q.id, q])).values()];
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seenCounts(attempts) {
  const seen = new Map();
  for (const at of attempts) seen.set(at.questionId, (seen.get(at.questionId) || 0) + 1);
  return seen;
}

// Menos respondidas primeiro; empate é sorteado. Assim dois simulados seguidos
// repetem o mínimo de questões.
function leastSeenFirst(items, scoreOf, rng) {
  return shuffle(items, rng)
    .map(item => ({ item, score: scoreOf(item) }))
    .sort((a, b) => a.score - b.score)
    .map(x => x.item);
}

const byOriginalNumber = (a, b) => (a.source?.originalNumber ?? 0) - (b.source?.originalNumber ?? 0);

// Questões do mesmo texto ficam juntas e na ordem da prova de origem. Começa por
// um texto, completa com questões avulsas e só então recorre a outro texto.
function pickLanguageBlock(pool, n, seen, rng) {
  const texts = new Map();
  const loose = [];
  for (const q of pool) {
    if (!q.passage) { loose.push(q); continue; }
    if (!texts.has(q.passage)) texts.set(q.passage, []);
    texts.get(q.passage).push(q);
  }
  const avgSeen = group => group.reduce((t, q) => t + (seen.get(q.id) || 0), 0) / group.length;
  const groups = leastSeenFirst([...texts.values()], avgSeen, rng)
    .map(group => group.slice().sort(byOriginalNumber));

  const picked = [];
  const take = group => { picked.push(...group.slice(0, n - picked.length)); };
  if (groups.length) take(groups.shift());
  take(leastSeenFirst(loose, q => seen.get(q.id) || 0, rng));
  while (picked.length < n && groups.length) take(groups.shift());
  return picked;
}

// Autoral só completa o que faltar de questão oficial.
function pickWithComplement(pool, n, seen, rng) {
  const official = pickLanguageBlock(pool.filter(q => !isAuthored(q)), n, seen, rng);
  if (official.length >= n) return official;
  return [...official, ...pickLanguageBlock(pool.filter(isAuthored), n - official.length, seen, rng)];
}

// Quantas questões de cada área técnica entram na prova. É estimativa pelo banco, não
// previsão: o edital não informa a distribuição por área. Nunca passa do que a área tem.
//  1. Piso: cada área com questão recebe a sua fatia do edital (EDITAL_WEIGHT do total,
//     dividido pelo número de subitens), nunca menos que MIN_AREA_SHARE, oficial ou autoral.
//  2. O resto vai só para questões oficiais, proporcional ao que cada área tem no banco
//     (maior média sucessiva, que respeita o limite de cada área).
//  3. Se ainda faltar, autorais, sempre para a área com menos questões até ali.
export function allocateByArea(questions, areas, total) {
  const pool = uniqueById(questions);
  const rows = areas
    .filter(a => blockOf(a.id) === "especificas")
    .map(a => {
      const inArea = pool.filter(q => q.area === a.id);
      const authored = inArea.filter(isAuthored).length;
      return { id: a.id, topics: a.topics?.length || 0, official: inArea.length - authored, authored, n: 0 };
    });
  const allTopics = rows.reduce((t, r) => t + r.topics, 0);
  const floor = r => Math.max(MIN_AREA_SHARE, allTopics ? Math.round((total * EDITAL_WEIGHT * r.topics) / allTopics) : 0);
  let left = total;
  const give = (row, k) => { row.n += k; left -= k; };

  for (const r of rows) give(r, Math.min(floor(r), r.official + r.authored, left));
  while (left > 0) {
    const open = rows.filter(r => r.n < r.official);
    if (!open.length) break;
    give(open.reduce((best, r) => (r.official / (r.n + 1) > best.official / (best.n + 1) ? r : best)), 1);
  }
  while (left > 0) {
    const open = rows.filter(r => r.n < r.official + r.authored);
    if (!open.length) break;
    give(open.reduce((best, r) => (r.n < best.n ? r : best)), 1);
  }
  return Object.fromEntries(rows.map(r => [r.id, r.n]));
}

// Devolve os ids sorteados, sem repetir. Com banco pequeno a lista sai menor que 70:
// quem chama consulta examReadiness para avisar antes.
export function buildExam(questions, areas, attempts = [], rng = Math.random) {
  const pool = uniqueById(questions);
  const seen = seenCounts(attempts);
  const inArea = id => pool.filter(q => q.area === id);
  const picked = [
    ...pickWithComplement(inArea("portugues"), EXAM_SHAPE.portugues, seen, rng),
    ...pickWithComplement(inArea("ingles"), EXAM_SHAPE.ingles, seen, rng)
  ];
  const share = allocateByArea(pool, areas, EXAM_SHAPE.especificas);
  const leastSeen = list => leastSeenFirst(list, q => seen.get(q.id) || 0, rng);
  for (const a of areas) {
    if (!share[a.id]) continue;
    const list = inArea(a.id);
    const ordered = [...leastSeen(list.filter(q => !isAuthored(q))), ...leastSeen(list.filter(isAuthored))];
    picked.push(...ordered.slice(0, share[a.id]));
  }
  return picked.map(q => q.id);
}

// O que o banco permite montar agora, para a tela avisar antes de sortear.
export function examReadiness(questions, areas) {
  const pool = uniqueById(questions);
  const share = allocateByArea(pool, areas, EXAM_SHAPE.especificas);
  const specificIds = areas.map(a => a.id).filter(id => blockOf(id) === "especificas");
  const row = (key, ids, use) => {
    const list = pool.filter(q => ids.includes(q.area));
    const authored = list.filter(isAuthored).length;
    const need = EXAM_SHAPE[key];
    return { key, label: BLOCK_LABELS[key], need, official: list.length - authored, authored, use, short: need - use };
  };
  const language = key => {
    const list = pool.filter(q => q.area === key);
    return row(key, [key], Math.min(EXAM_SHAPE[key], list.length));
  };
  const blocks = [
    language("portugues"),
    language("ingles"),
    row("especificas", specificIds, specificIds.reduce((t, id) => t + (share[id] || 0), 0))
  ];
  const authoredIn = (id, n) => Math.max(0, n - pool.filter(q => q.area === id && !isAuthored(q)).length);
  const authoredUsed = authoredIn("portugues", blocks[0].use) + authoredIn("ingles", blocks[1].use) +
    specificIds.reduce((t, id) => t + authoredIn(id, share[id] || 0), 0);
  const total = blocks.reduce((t, b) => t + b.use, 0);
  const missingAreas = areas.filter(a => specificIds.includes(a.id) && !share[a.id]).map(a => a.id);
  const counts = blocks.map(b => `${b.label}: ${b.use} de ${b.need}`).join("; ");
  const message = total >= EXAM_TOTAL ? "" : total
    ? `O banco ainda não tem questões para uma prova completa. Hoje dá para sortear ${total} de ${EXAM_TOTAL} (${counts}). A prova sai parcial e não equivale à prova real.`
    : `O banco ainda não tem questões para sortear uma prova (${counts}).`;
  return { total, target: EXAM_TOTAL, complete: total >= EXAM_TOTAL, blocks, authoredUsed, missingAreas, message };
}

// Caderno de uma prova na ordem original, com os números que ficaram fora do banco.
// `ref` é o arquivo de origem (texto) ou o ano (número). Autoral nunca entra, nem
// questão aproveitada de outra ênfase. Sem `size`, vale o maior número visto.
export function historicExam(questions, ref, size = null) {
  const same = typeof ref === "string" ? q => q.source?.file === ref : q => q.source?.year === ref;
  const list = questions.filter(q => isHistoric(q) && same(q)).sort(byOriginalNumber);
  const have = new Set(list.map(q => q.source?.originalNumber));
  const last = size ?? Math.max(0, ...list.map(q => q.source?.originalNumber ?? 0));
  const missing = [];
  for (let n = 1; n <= last; n++) if (!have.has(n)) missing.push(n);
  return { order: list.map(q => q.id), missing, size: last };
}

function sourceLabel(q) {
  const { year, org, exam } = q.source;
  // O rótulo da prova já traz órgão e ano; sem ele, ano e órgão.
  const name = exam || org;
  if (isReused(q)) return `${year} · Conhecimentos Gerais de outra ênfase`;
  if (exam) return exam;
  return name ? `${year} · ${name}` : `Prova de ${year}`;
}

// Provas de Psicologia que dá para refazer na ordem original, da mais recente à mais antiga.
// Prova com menos de HISTORIC_MIN questões no banco (a maioria ficou fora do edital) não
// vira prova histórica; as questões dela continuam no treino.
export const HISTORIC_MIN = 25;
export function historicExams(questions, min = HISTORIC_MIN) {
  const files = new Map();
  for (const q of questions) {
    if (isHistoric(q) && q.source?.file && !files.has(q.source.file)) files.set(q.source.file, q);
  }
  return [...files.values()]
    .map(q => ({ file: q.source.file, year: q.source.year, label: sourceLabel(q), ...historicExam(questions, q.source.file) }))
    .filter(h => h.order.length >= min)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.file.localeCompare(b.file));
}

export function filterQuestions(questions, { areaIds, subtopic = "", file = "" }) {
  return questions.filter(q =>
    areaIds.includes(q.area) &&
    (!subtopic || q.subtopic === subtopic) &&
    (!file || (file === AUTHORED_SOURCE ? isAuthored(q) : !isAuthored(q) && q.source?.file === file)));
}

export function buildTraining(pool, limit, rng = Math.random) {
  const order = shuffle(pool.map(q => q.id), rng);
  return limit > 0 ? order.slice(0, limit) : order;
}

// Provas do banco para o filtro, da mais recente para a mais antiga. Autoral não é
// prova: tem opção própria (AUTHORED_SOURCE) na tela.
export function examSources(questions) {
  const files = new Map();
  for (const q of questions) {
    const file = q.source?.file;
    if (!file || isAuthored(q)) continue;
    if (!files.has(file)) files.set(file, { file, year: q.source.year, label: sourceLabel(q), count: 0 });
    files.get(file).count += 1;
  }
  const list = [...files.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.file.localeCompare(b.file));
  const seen = {};
  return list.map(x => {
    const same = list.filter(y => y.label === x.label).length;
    seen[x.label] = (seen[x.label] || 0) + 1;
    return { ...x, label: same > 1 ? `${x.label} (${seen[x.label]})` : x.label };
  });
}

function addTo(map, key, label, ok, blank) {
  if (!map.has(key)) map.set(key, { key, label, correct: 0, total: 0, blank: 0 });
  const row = map.get(key);
  row.total += 1;
  if (ok) row.correct += 1;
  if (blank) row.blank += 1;
}

const withPct = row => ({ ...row, pct: row.total ? Math.round((100 * row.correct) / row.total) : 0 });

// Na prova, questão em branco conta no total. No treino encerrado antes do fim,
// só entra o que foi respondido.
export function summarize(session, byId, areas) {
  const ids = session.order.filter(id => byId[id] && (session.kind !== "treino" || session.answers[id]));
  const blocks = new Map(), byArea = new Map(), subtopics = new Map();
  const blockTime = {};
  const review = [];
  let correct = 0, blank = 0;

  for (const id of ids) {
    const q = byId[id];
    const chosen = session.answers[id];
    const ok = chosen === q.correctKey;
    if (ok) correct += 1; else review.push(id);
    if (!chosen) blank += 1;
    const block = blockOf(q.area);
    addTo(blocks, block, BLOCK_LABELS[block], ok, !chosen);
    addTo(byArea, q.area, (areas.find(a => a.id === q.area) || {}).label || q.area, ok, !chosen);
    if (q.subtopic) addTo(subtopics, q.subtopic, q.subtopic, ok, !chosen);
    blockTime[block] = (blockTime[block] || 0) + (session.timeMs[id] || 0);
  }

  const areaOrder = id => areas.findIndex(a => a.id === id);
  return {
    total: ids.length,
    correct,
    blank,
    pct: ids.length ? Math.round((100 * correct) / ids.length) : 0,
    notReached: session.order.filter(id => byId[id]).length - ids.length,
    elapsedMs: session.elapsedMs,
    avgMs: ids.length ? Math.round(ids.reduce((t, id) => t + (session.timeMs[id] || 0), 0) / ids.length) : 0,
    blocks: ["portugues", "ingles", "especificas"]
      .filter(k => blocks.has(k))
      .map(k => ({ ...withPct(blocks.get(k)), timeMs: blockTime[k] || 0 })),
    areas: [...byArea.values()].map(withPct).sort((a, b) => areaOrder(a.key) - areaOrder(b.key)),
    subtopics: [...subtopics.values()].map(withPct).sort((a, b) => a.pct - b.pct || b.total - a.total),
    review,
    authored: ids.filter(id => isAuthored(byId[id])).length
  };
}

// Subitem 7.1.4.3 do edital: elimina quem ficar abaixo de 50% em Específicos ou em
// Conhecimentos Gerais, ou zerar Português ou Inglês.
// Sem questão de um bloco o critério não se aplica (`evaluable`), e prova com menos
// questões que a real (`complete` falso) só serve de referência.
export function editalCut(result) {
  const block = key => result.blocks.find(b => b.key === key) || { correct: 0, total: 0 };
  const pt = block("portugues"), en = block("ingles"), specific = block("especificas");
  const general = { correct: pt.correct + en.correct, total: pt.total + en.total };
  const specificOk = specific.total > 0 && specific.correct * 2 >= specific.total;
  const generalOk = general.total > 0 && general.correct * 2 >= general.total;
  const noZero = pt.correct > 0 && en.correct > 0;
  const evaluable = specific.total > 0 && pt.total > 0 && en.total > 0;
  const complete = specific.total >= EXAM_SHAPE.especificas && pt.total >= EXAM_SHAPE.portugues && en.total >= EXAM_SHAPE.ingles;
  return { specific, general, portuguese: pt.correct, english: en.correct,
           specificOk, generalOk, noZero, evaluable, complete, passed: specificOk && generalOk && noZero };
}
