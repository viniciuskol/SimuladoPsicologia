const ATTEMPTS_KEY = "transpetro2026-psi:attempts";
const SRS_KEY = "transpetro2026-psi:srs";

// Devolve SEMPRE um array de tentativas utilizáveis. JSON válido mas não-array
// (ex.: {"a":1}), item que não é objeto, ou item sem questionId/area são descartados
// em silêncio — assim statsByArea e wrongByArea nunca estouram com storage estranho.
export function loadAttempts() {
  try {
    const v = JSON.parse(localStorage.getItem(ATTEMPTS_KEY));
    if (!Array.isArray(v)) return [];
    return v.filter(a => a && typeof a === "object" && a.questionId && a.area);
  } catch { return []; }
}

// Devolve false se o navegador recusar a gravação (cota estourada, modo privado):
// a tela segue funcionando e decide como avisar, em vez de travar na exceção.
export function recordAttempt(entry) {
  const attempts = loadAttempts();
  attempts.push({ ...entry, timestamp: Date.now() });
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return true;
  } catch { return false; }
}

export function clearAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
}

export function statsByArea(areas) {
  const attempts = loadAttempts();
  const byArea = {};
  for (const a of areas) byArea[a.id] = { label: a.label, total: 0, correct: 0 };
  for (const at of attempts) {
    if (!byArea[at.area]) byArea[at.area] = { label: at.area, total: 0, correct: 0 };
    byArea[at.area].total += 1;
    if (at.correct) byArea[at.area].correct += 1;
  }
  return Object.entries(byArea)
    .map(([id, v]) => ({ id, ...v, pct: v.total ? Math.round((100 * v.correct) / v.total) : null }))
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
}

// SRS (SM-2 simplificado). Estado por cardId: { interval, easeFactor, dueDate, reps }
// Entrada sem dueDate válida é descartada: um card assim nunca venceria.
function sanitizeSRS(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, s] of Object.entries(v)) {
    if (s && typeof s === "object" && /^\d{4}-\d{2}-\d{2}$/.test(s.dueDate) &&
        Number.isFinite(s.interval) && Number.isFinite(s.easeFactor) && Number.isFinite(s.reps)) out[id] = s;
  }
  return out;
}

// Só é preenchido quando o localStorage recusa a gravação: a sessão continua
// valendo em memória, sem esconder o que outra aba gravou no caso normal.
let srsFallback = null;

export function loadSRS() {
  if (srsFallback) return srsFallback;
  try { return sanitizeSRS(JSON.parse(localStorage.getItem(SRS_KEY))); }
  catch { return {}; }
}

function saveSRS(state) {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(state));
    srsFallback = null;
    return true;
  } catch {
    srsFallback = state;
    return false;
  }
}

// Data LOCAL em AAAA-MM-DD: com toISOString o dia viraria às 21h em Brasília.
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

function hashText(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function dueCards(cards) {
  const state = loadSRS();
  const today = localDate();
  return cards.filter(c => {
    const s = state[c.id];
    return !s || s.dueDate <= today;
  });
}

const FINAL_REVIEW_DAYS = 4;

// Reta final: a última revisão acontece nos 4 dias antes da prova. O card cujo
// intervalo passaria da véspera cai num desses dias, escolhido pelo id para não
// empilhar o baralho inteiro na véspera. Quem já foi bem dentro da janela não volta.
function fitToExam(cardId, due, today, examDate) {
  if (!examDate) return due;
  const eve = addDays(examDate, -1);
  if (due <= eve) return due;
  const windowStart = addDays(eve, -(FINAL_REVIEW_DAYS - 1));
  if (today >= windowStart) return due;
  return addDays(windowStart, hashText(cardId) % FINAL_REVIEW_DAYS);
}

// rating: 1=Errei, 2=Difícil, 3=Bom, 4=Fácil. Devolve false se a gravação falhar.
export function rateCard(cardId, rating, examDate) {
  const state = loadSRS();
  const today = localDate();
  const s = state[cardId] || { interval: 0, easeFactor: 2.5, reps: 0 };
  let { interval, easeFactor, reps } = s;

  // Acertar um card que ainda não venceu é treino extra: não pode inflar o intervalo.
  if (rating !== 1 && s.dueDate && s.dueDate > today) return true;

  if (rating === 1) {
    interval = 1;
    // Errar de novo o mesmo card antes de recuperá-lo não penaliza duas vezes.
    if (reps > 0) easeFactor = Math.max(1.3, easeFactor - 0.2);
    reps = 0;
  } else {
    reps += 1;
    if (rating === 2) easeFactor = Math.max(1.3, easeFactor - 0.15);
    if (rating === 4) easeFactor = easeFactor + 0.15;
    interval = reps === 1 ? 1 : Math.round(interval * easeFactor);
  }

  const dueDate = fitToExam(cardId, addDays(today, interval), today, examDate);
  state[cardId] = { interval, easeFactor, reps, dueDate, firstSeen: s.firstSeen || today };
  return saveSRS(state);
}

// Resumo do estado de revisão espaçada (quantos cards já foram vistos ao menos uma vez).
export function srsSummary(cards) {
  const state = loadSRS();
  const seen = cards.filter(c => state[c.id]).length;
  return { seen, total: cards.length };
}

// Agrega o histórico de tentativas do simulado do ponto de vista do erro.
// Uma questão errada N vezes conta como UM erro (com `wrong` = N); `recovered`
// marca quem foi acertada em tentativa POSTERIOR ao último erro — o sinal que
// interessa. Só acrescenta; não altera nenhuma função acima.
export function wrongByArea() {
  const attempts = loadAttempts()   // já vem saneado (array de objetos com questionId e area)
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const byQ = new Map();
  for (const at of attempts) {
    let e = byQ.get(at.questionId);
    if (!e) {
      e = { questionId: at.questionId, area: at.area, wrong: 0, lastWrong: 0, recovered: false };
      byQ.set(at.questionId, e);
    }
    if (at.area) e.area = at.area;
    if (at.correct) { if (e.wrong) e.recovered = true; }
    else { e.wrong += 1; e.lastWrong = at.timestamp || 0; e.recovered = false; }
  }
  const wrong = [...byQ.values()].filter(e => e.wrong > 0);
  const byArea = new Map();
  for (const e of wrong) {
    if (!byArea.has(e.area)) byArea.set(e.area, []);
    byArea.get(e.area).push(e);
  }
  const groups = [...byArea.entries()]
    .map(([area, items]) => ({ area, items: items.sort((x, y) => y.lastWrong - x.lastWrong) }))
    .sort((x, y) => y.items.length - x.items.length || String(x.area).localeCompare(String(y.area)));
  return {
    groups,
    attempts: attempts.length,
    wrongTotal: wrong.length,
    recovered: wrong.filter(e => e.recovered).length
  };
}

/* ---------- Checklist do plano ---------- */

const PLAN_KEY = "transpetro2026-psi:plan";

// A chave de um item é um hash curto do PRÓPRIO TEXTO (FNV-1a 32 bits em base36),
// prefixado pelo número do bloco — nunca o índice: assim reordenar o checklist não
// migra marcação para o item errado, e item cujo texto for reescrito num ciclo
// futuro gera outra chave e volta desmarcado em vez de herdar a marcação do vizinho.
export function planItemKey(blockN, text) {
  return `b${Number(blockN) || 0}#${hashText(text).toString(36)}`;
}

// A memória é a fonte de verdade da sessão, com escrita passante para o
// localStorage: se a gravação falhar (cota estourada, modo privado), o estado
// marcado continua valendo em TODOS os toggles seguintes, e não só no primeiro.
let planCache = null;

// Devolve SEMPRE um mapa { chave: true } utilizável. JSON inválido, array no lugar
// de objeto, null e valores que não sejam `true` são descartados em silêncio — o
// mesmo endurecimento de loadAttempts, para storage editado à mão não quebrar a tela.
export function loadPlanChecks() {
  if (planCache) return { ...planCache };
  let out = {};
  try {
    const v = JSON.parse(localStorage.getItem(PLAN_KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const k of Object.keys(v)) if (v[k] === true) out[k] = true;
    }
  } catch { out = {}; }
  planCache = out;
  return { ...out };
}

// Marca/desmarca um item e devolve o estado já saneado. Só guarda `true`: item
// desmarcado sai do mapa, então o storage não cresce com lixo.
export function setPlanCheck(key, done) {
  const state = loadPlanChecks();
  if (done) state[String(key)] = true;
  else delete state[String(key)];
  planCache = state;   // vale mesmo se o localStorage recusar a gravação abaixo
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(state)); } catch { /* ignora */ }
  return { ...state };
}

// Progresso de um bloco: { done, total }. Conta CHAVES ÚNICAS, não itens — dois
// itens de texto idêntico compartilham a mesma chave e não podem valer 2 de 2 com
// uma caixa marcada. Bloco sem checklist dá 0 de 0.
export function planProgress(block, state) {
  const checks = state || loadPlanChecks();
  const items = Array.isArray(block && block.checklist) ? block.checklist : [];
  const all = new Set(), done = new Set();
  for (const it of items) {
    const k = planItemKey(block && block.n, it);
    all.add(k);
    if (checks[k]) done.add(k);
  }
  return { done: done.size, total: all.size };
}

/* ---------- Sessão do simulado em andamento ---------- */

const SESSION_KEY = "transpetro2026-psi:session";

// Devolve null para qualquer conteúdo que não dê para retomar com segurança.
export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    const plainObject = v => v && typeof v === "object" && !Array.isArray(v);
    if (!plainObject(s) || s.version !== 1) return null;
    if (s.kind !== "prova" && s.kind !== "treino") return null;
    if (s.status !== "active" && s.status !== "finished") return null;
    if (!Array.isArray(s.order) || !s.order.length || !s.order.every(id => typeof id === "string")) return null;
    if (!plainObject(s.answers) || !plainObject(s.flagged) || !plainObject(s.timeMs)) return null;
    if (!Number.isInteger(s.idx) || !Number.isFinite(s.elapsedMs)) return null;
    if (s.limitMs !== null && !Number.isFinite(s.limitMs)) return null;
    return s;
  } catch { return null; }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch { return false; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignora */ }
}

/* ---------- Backup do progresso ---------- */

const BACKUP_APP = "transpetro2026-psi";

export function exportProgress() {
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    attempts: loadAttempts(),
    srs: loadSRS(),
    plan: loadPlanChecks()
  };
}

// Confere o arquivo sem gravar nada: devolve o conteúdo saneado e as contagens,
// ou null se não for um backup deste app.
export function parseBackup(text) {
  let v;
  try { v = JSON.parse(text); } catch { return null; }
  if (!v || v.app !== BACKUP_APP || !Array.isArray(v.attempts)) return null;
  const attempts = v.attempts.filter(a => a && typeof a === "object" && a.questionId && a.area);
  const srs = sanitizeSRS(v.srs);
  const plan = {};
  if (v.plan && typeof v.plan === "object" && !Array.isArray(v.plan)) {
    for (const k of Object.keys(v.plan)) if (v.plan[k] === true) plan[k] = true;
  }
  return { attempts, srs, plan, counts: { attempts: attempts.length, srs: Object.keys(srs).length, plan: Object.keys(plan).length } };
}

// Substitui o progresso deste navegador. Em caso de falha, restaura o estado anterior.
export function restoreProgress(backup) {
  const keys = [ATTEMPTS_KEY, SRS_KEY, PLAN_KEY];
  try {
    const before = keys.map(k => localStorage.getItem(k));
    try {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(backup.attempts));
      localStorage.setItem(SRS_KEY, JSON.stringify(backup.srs));
      localStorage.setItem(PLAN_KEY, JSON.stringify(backup.plan));
    } catch (e) {
      keys.forEach((k, i) => {
        if (before[i] === null) localStorage.removeItem(k);
        else localStorage.setItem(k, before[i]);
      });
      throw e;
    }
  } catch { return false; }
  srsFallback = null;
  planCache = null;
  return true;
}
