// Prioridade por assunto e agenda do dia, sem nada de tela nem de storage: tudo
// entra por parâmetro. Estimativas para ordenar o estudo, não previsão da prova.

const BLOCK_QUESTIONS = { portugues: 10, ingles: 10, especificas: 50 };
const RECENT_FROM_YEAR = 2018;
const AUTHORED_WEIGHT = 0.5;       // autoral indica o assunto, mas não é sinal do que a banca cobra
const RECENT_ATTEMPTS = 10;
const PRIOR_ERROR = 0.5;
const PRIOR_ATTEMPTS = 2;
const SMALL_SAMPLE = 3;
const NO_NEW_CARDS_DAYS = 7;       // o plano veta conteúdo novo na última semana
const FULL_EXAM_MIN_ANSWERS = 30;
const FIRST_FULL_EXAM_DAYS = 22;   // bloco 6 do plano: a partir de 14/11, prova em 06/12
const FULL_EXAM_GAP_DAYS = 4;
const FULL_EXAMS_TARGET = 2;

const blockKey = area => (area === "portugues" || area === "ingles" ? area : "especificas");

// `expected` é quantas questões o assunto deve valer na prova: a fatia dele no bloco
// (2018 em diante pesa em dobro, autoral pesa menos) sobre o tamanho do bloco. O erro olha as últimas
// tentativas e parte de 50%, para 1 erro isolado não virar 100%.
export function subtopicPriority(questions, attempts) {
  const rows = new Map();
  const blockWeight = {};
  const rowOf = {};
  for (const q of questions) {
    if (!q.subtopic) continue;
    const key = `${q.area}|${q.subtopic}`;
    if (!rows.has(key)) rows.set(key, { subtopic: q.subtopic, area: q.area, weight: 0, recent: [] });
    const weight = q.source?.authored ? AUTHORED_WEIGHT : (q.source?.year ?? 0) >= RECENT_FROM_YEAR ? 2 : 1;
    rows.get(key).weight += weight;
    const block = blockKey(q.area);
    blockWeight[block] = (blockWeight[block] || 0) + weight;
    rowOf[q.id] = rows.get(key);
  }
  const ordered = attempts.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  for (const at of ordered) {
    const row = rowOf[at.questionId];
    if (row) row.recent.push(!!at.correct);
  }
  return [...rows.values()].map(row => {
    const recent = row.recent.slice(-RECENT_ATTEMPTS);
    const errors = recent.filter(ok => !ok).length;
    const block = blockKey(row.area);
    const expected = (BLOCK_QUESTIONS[block] * row.weight) / blockWeight[block];
    const estimatedError = (errors + PRIOR_ATTEMPTS * PRIOR_ERROR) / (recent.length + PRIOR_ATTEMPTS);
    return {
      subtopic: row.subtopic,
      area: row.area,
      expected,
      attempts: recent.length,
      errorPct: recent.length ? Math.round((100 * errors) / recent.length) : null,
      smallSample: recent.length < SMALL_SAMPLE,
      score: expected * estimatedError
    };
  }).sort((a, b) => b.score - a.score);
}

// Reconhece "Resolução CFP nº 07/2003", "Res. CFP 7/03", "Resolução do CFP n. 007, de 2003"
// e "Resolução CFP nº 6, de 29 de março de 2019".
const cfpResolution = (n, year) => new RegExp(
  "(?:Resolu[cç][aã]o|Res\\.)\\s+(?:do\\s+)?(?:CFP|Conselho Federal de Psicologia)?\\s*(?:n[.º°o]*\\s*)?" +
  `0*${n}(?:\\s*/\\s*|,?\\s+de\\s+(?:\\d{1,2}\\s+de\\s+\\S+\\s+de\\s+)?)(?:20)?${String(year).slice(2)}\\b`, "i");

// Norma citada pela questão que já não vale. `until`: só avisa em prova anterior a esse
// ano, pois prova mais nova pode citar a norma antiga justamente para falar da revogação.
// Cada revogação foi conferida no texto ou no site do CFP em 05/11/2026 (ver README.md).
const REVOKED_CFP = [
  { re: cfpResolution(7, 2003), until: 2019, text: "cita a Resolução CFP 07/2003, revogada pela Resolução CFP 06/2019, a norma atual sobre documentos escritos." },
  { re: cfpResolution(2, 2003), until: 2018, text: "cita a Resolução CFP 02/2003, revogada pela Resolução CFP 09/2018, que por sua vez foi revogada pela Resolução CFP 31/2022, a norma atual sobre avaliação psicológica e SATEPSI." },
  { re: cfpResolution(9, 2018), until: 2023, text: "cita a Resolução CFP 09/2018, revogada pela Resolução CFP 31/2022, a norma atual sobre avaliação psicológica e SATEPSI." },
  { re: cfpResolution(11, 2018), until: 2024, text: "cita a Resolução CFP 11/2018, revogada pela Resolução CFP 09/2024, a norma atual sobre o exercício mediado por tecnologias digitais." }
];

// Assunto do edital regido por norma mais nova que a prova. Só diz que a prova é
// anterior: não afirma o que mudou, porque a questão não cita a norma antiga.
const NEWER_NORM_BY_TOPIC = [
  { topic: "2.4 ", year: 2025, norm: "Resolução CFP 8/2025" },
  { topic: "2.5 ", year: 2019, norm: "Resolução CFP 6/2019" },
  { topic: "2.6 ", year: 2023, norm: "Resolução CFP 31/2022" },
  { topic: "2.7 ", year: 2023, norm: "Resolução CFP 14/2023" },
  { topic: "2.8 ", year: 2024, norm: "Resolução CFP 09/2024" }
];

const CIPA = /\bCIPAS?\b|Comiss[aã]o Interna de Preven[cç][aã]o de Acidentes/i;
const NR1 = /\bNR[\s-]*0?1\b|Norma Regulamentadora\s*(?:n[.º°o]*\s*)?0?1\b/i;
const CID10 = /\bCID[\s-]*10\b/i;
const OLD_DSM = /\bDSM[\s-]*(?:III|IV|3|4)\b/i;

// Questão oficial anterior à norma vigente mantém o gabarito da prova e ganha um aviso.
// Autoral é escrita pela norma vigente e questões de língua não tratam de norma.
function normNotices(q) {
  if (q.source?.authored || blockKey(q.area) !== "especificas") return [];
  const year = q.source?.year || 0;
  const before = limit => year > 0 && year < limit;
  const lead = year ? `Questão de ${year}: ` : "Esta questão ";
  const text = [q.stem, ...(q.alternatives || []).map(a => a.text)].join(" ");
  const notices = [];

  for (const r of REVOKED_CFP) {
    if ((!year || before(r.until)) && r.re.test(text)) notices.push(`${lead}${r.text} O gabarito é o oficial da prova; confira o texto vigente.`);
  }
  if (!notices.length) {
    const t = NEWER_NORM_BY_TOPIC.find(x => q.subtopic?.startsWith(x.topic) && before(x.year));
    if (t) notices.push(`Questão de ${year}, anterior à ${t.norm}, que é a norma do edital para este assunto. O gabarito é o oficial da prova; confira o texto vigente.`);
  }
  if (before(2023) && CIPA.test(text)) {
    notices.push(`Questão de ${year}. Depois da Lei 14.457/2022, a CIPA passou a ser a Comissão Interna de Prevenção de Acidentes e de Assédio, e a prevenção do assédio entrou nas suas atribuições.`);
  }
  if (before(2024) && NR1.test(text)) {
    notices.push(`Questão de ${year}, anterior à inclusão dos fatores de risco psicossociais no gerenciamento de riscos da NR-1 (Portaria MTE 1.419/2024, em vigor desde 26/05/2026).`);
  }
  if (before(2022) && CID10.test(text)) {
    notices.push(`Questão de ${year}, que cita a CID-10. A CID-11 está em vigor na OMS desde 2022, e a adoção no Brasil é gradual. Confira qual classificação a norma cobrada usa.`);
  }
  if (OLD_DSM.test(text)) {
    notices.push(`${lead}cita edição antiga do DSM. A edição atual é o DSM-5-TR.`);
  }
  return notices;
}

// Avisos da correção: norma mais nova que a questão e explicação menos segura.
// Só aparecem depois de responder, para não mudar a questão em relação à prova.
export function contentNotices(q) {
  const notices = normNotices(q);
  if (q.verification?.confidence === "medium") {
    notices.push(q.source?.authored
      ? "Questão autoral com confiança média: a norma foi lida em reprodução não oficial. Se discordar, confira no texto publicado pelo CFP."
      : "O gabarito é o oficial, mas a explicação tem confiança média. Se discordar, confira na prova ou na fonte.");
  }
  return notices;
}

// Cards citados pela própria questão primeiro, depois os de outras questões do assunto.
export function cardsForQuestion(q, cards, byId) {
  const own = cards.filter(c => c.sourceQuestionId === q.id);
  const related = cards.filter(c => c.sourceQuestionId && c.sourceQuestionId !== q.id &&
    byId[c.sourceQuestionId]?.subtopic === q.subtopic && byId[c.sourceQuestionId]?.area === q.area);
  return [...own, ...related];
}

export function cardsForQuestions(list, cards, byId) {
  const seen = new Map();
  for (const q of list) for (const c of cardsForQuestion(q, cards, byId)) seen.set(c.id, c);
  return [...seen.values()];
}

// `wrong` é o retorno de wrongByArea(). Pendente é o erro ainda sem acerto posterior.
export function pendingErrorIds(wrong, byId, area = "") {
  return wrong.groups
    .flatMap(g => g.items)
    .filter(it => !it.recovered && byId[it.questionId] && (!area || byId[it.questionId].area === area))
    .map(it => it.questionId);
}

// Card sem questão de origem herda a média dos assuntos da sua área.
function cardScorer(rows, byId) {
  const score = new Map(rows.map(r => [`${r.area}|${r.subtopic}`, r.score]));
  const areaTotal = {}, areaCount = {};
  for (const r of rows) {
    areaTotal[r.area] = (areaTotal[r.area] || 0) + r.score;
    areaCount[r.area] = (areaCount[r.area] || 0) + 1;
  }
  return card => {
    const q = byId[card.sourceQuestionId];
    const linked = q && score.get(`${q.area}|${q.subtopic}`);
    return linked ?? (areaCount[card.area] ? areaTotal[card.area] / areaCount[card.area] : 0);
  };
}

// Cards de hoje: todas as revisões vencidas e uma cota de novos que divide os ainda
// não vistos pelos dias até a última semana, começando pelos assuntos prioritários.
export function dailyCards({ cards, srs, today, daysLeft, rows, byId }) {
  const reviews = cards.filter(c => srs[c.id] && srs[c.id].dueDate <= today);
  const unseen = cards.filter(c => !srs[c.id]);
  const newToday = cards.filter(c => srs[c.id]?.firstSeen === today).length;
  const days = daysLeft - NO_NEW_CARDS_DAYS;
  const quota = days > 0 ? Math.max(0, Math.ceil((unseen.length + newToday) / days) - newToday) : 0;
  const scoreOf = cardScorer(rows, byId);
  const newCards = unseen
    .map(card => ({ card, score: scoreOf(card) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, quota)
    .map(x => x.card);
  return { reviews, newCards, unseen: unseen.length, newToday };
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A tentativa não guarda de qual prova veio: dia com 30 ou mais respostas do modo
// prova conta como uma prova completa.
export function fullExamDays(attempts) {
  const perDay = {};
  for (const at of attempts) {
    if (at.mode !== "prova" || !at.timestamp) continue;
    const day = dayKey(at.timestamp);
    perDay[day] = (perDay[day] || 0) + 1;
  }
  return Object.keys(perDay).filter(day => perDay[day] >= FULL_EXAM_MIN_ANSWERS).sort();
}

export function answeredOn(attempts, today) {
  return attempts.filter(at => at.timestamp && dayKey(at.timestamp) === today).length;
}

// "soon": ainda não é a hora · "now": faça hoje · "gap": espere o intervalo ·
// "done": meta cumprida · "late": perto demais da prova para uma prova inteira.
export function fullExamAdvice(days, today, daysLeft) {
  if (days.length >= FULL_EXAMS_TARGET) return { status: "done", count: days.length };
  if (daysLeft <= 1) return { status: "late", count: days.length };
  if (daysLeft > FIRST_FULL_EXAM_DAYS) return { status: "soon", count: days.length, inDays: daysLeft - FIRST_FULL_EXAM_DAYS };
  const last = days[days.length - 1];
  if (last) {
    const [y1, m1, d1] = last.split("-").map(Number);
    const [y2, m2, d2] = today.split("-").map(Number);
    const since = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
    if (since < FULL_EXAM_GAP_DAYS) return { status: "gap", count: days.length, inDays: FULL_EXAM_GAP_DAYS - since };
  }
  return { status: "now", count: days.length };
}
