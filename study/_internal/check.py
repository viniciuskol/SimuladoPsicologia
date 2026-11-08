#!/usr/bin/env python3
"""Invariantes do banco e dos dados de estudo. Uso: python3 study/_internal/check.py [--strict]

PROBLEMAS são dados errados e fazem o script sair com 1. PENDÊNCIAS são dados que ainda
faltam (área sem questão, sem conteúdo) e só contam como erro com --strict. Dados
incompletos ou malformados viram linhas do relatório, nunca exceção.
"""
import collections, datetime, json, pathlib, re, sys

S = pathlib.Path(__file__).resolve().parent.parent
D = S / "data"
ALLOW = {'p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'table', 'tr', 'th', 'td', 'br'}
KEYS = ["A", "B", "C", "D", "E"]
LANG = {"portugues": 10, "ingles": 10}
SPECIFIC_NEED = 50
# Sobras do projeto de onde o código foi copiado. O programa desta ênfase não usa nada disto.
OLD_TERMS = re.compile(r"PMBOK|27002|Ênfase 5|Ênfase 6|Processos de Neg[oó]cio|Analista de Sistemas|SimuladoConcurso", re.I)
ID_REF = re.compile(r"\b[a-z][a-z0-9-]*-q\d+\b")

prob, pend = [], []


def load(rel, missing_is_problem=True):
    f = D / rel
    if not f.exists():
        (prob if missing_is_problem else pend).append(f"{rel}: arquivo ausente")
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (ValueError, OSError) as e:
        prob.append(f"{rel}: JSON inválido ({e})")
        return None


def section(name, fn):
    """Um formato inesperado num bloco vira problema relatado e os demais continuam."""
    try:
        fn()
    except Exception as e:  # noqa: BLE001 - o relatório precisa sair mesmo com dado torto
        prob.append(f"{name}: não foi possível verificar ({type(e).__name__}: {e})")


def as_list(v):
    return v if isinstance(v, list) else []


def as_dict(v):
    return v if isinstance(v, dict) else {}


areas_doc = as_dict(load("areas.json"))
areas = [a for a in as_list(areas_doc.get("areas")) if isinstance(a, dict) and a.get("id")]
area_ids = [a["id"] for a in areas]
topics = {a["id"]: as_list(a.get("topics")) for a in areas}
qs = [q for q in as_list(as_dict(load("questions.json")).get("questions")) if isinstance(q, dict)]
qarea = {q.get("id"): q.get("area") for q in qs}
authored = lambda q: bool(as_dict(q.get("source")).get("authored"))


def check_question(q, seen):
    i = q.get("id")
    if not i:
        prob.append(f"questão sem id: {str(q.get('stem'))[:50]!r}")
        i = "(sem id)"
    elif i in seen:
        prob.append(f"{i}: id duplicado")
    seen.add(i)

    area = q.get("area")
    if area not in topics:
        prob.append(f"{i}: área inválida {area!r}")
    elif q.get("subtopic") not in topics[area]:
        prob.append(f"{i}: subtopic não é exato de {area}: {q.get('subtopic')!r}")

    stem = q.get("stem")
    if not isinstance(stem, str) or not stem.strip():
        prob.append(f"{i}: sem enunciado")
        stem = ""

    alts = [a for a in as_list(q.get("alternatives")) if isinstance(a, dict)]
    keys = [a.get("key") for a in alts]
    if keys != KEYS:
        prob.append(f"{i}: alternativas devem ser A a E, veio {keys}")
    if any(not str(a.get("text") or "").strip() for a in alts):
        prob.append(f"{i}: alternativa sem texto")
    if q.get("correctKey") not in keys or q.get("correctKey") not in KEYS:
        prob.append(f"{i}: correctKey inválida {q.get('correctKey')!r}")
    if not q.get("explanationSummary"):
        prob.append(f"{i}: sem explanationSummary")
    if q.get("status") != "confirmed":
        prob.append(f"{i}: status {q.get('status')!r}")
    if q.get("annulled"):
        prob.append(f"{i}: questão anulada no banco")

    src = as_dict(q.get("source"))
    ver = as_dict(q.get("verification"))
    if src.get("authored"):
        if not str(src.get("basis") or "").strip():
            prob.append(f"{i}: autoral sem source.basis")
        if ver and ver.get("agree") is False:
            prob.append(f"{i}: autoral com verification.agree falso")
    else:
        for k in ("file", "year", "originalNumber"):
            if not src.get(k):
                prob.append(f"{i}: source.{k} ausente")
        if ver.get("agree") is not True:
            prob.append(f"{i}: verification.agree não é true")
        for k in ("gabaritoAnswer", "independentlyDerivedAnswer"):
            if ver.get(k) != q.get("correctKey"):
                prob.append(f"{i}: verification.{k}={ver.get(k)!r} difere de correctKey={q.get('correctKey')!r}")

    imgs = [m for m in as_list(q.get("images"))]
    marks = {int(m) for m in re.findall(r"\[\[fig:(\d+)\]\]", stem)}
    if marks != set(range(1, len(imgs) + 1)):
        prob.append(f"{i}: marcadores de figura não batem com images")
    for m in imgs:
        m = as_dict(m)
        if not m.get("src") or not (S / str(m.get("src"))).is_file():
            prob.append(f"{i}: figura ausente {m.get('src')}")
        if not m.get("alt"):
            prob.append(f"{i}: figura sem alt")


def check_questions():
    if not qs:
        pend.append("questions.json: banco vazio")
    seen = set()
    for q in qs:
        check_question(q, seen)
    numbers = collections.Counter((as_dict(q.get("source")).get("file"), as_dict(q.get("source")).get("originalNumber"))
                                  for q in qs if not authored(q))
    for (f, n), c in numbers.items():
        if c > 1 and f and n:
            prob.append(f"{f} questão {n}: aparece {c} vezes no banco")


contents = {}


def check_content():
    for a in area_ids:
        c = load(f"content/{a}.json", missing_is_problem=False)
        if not isinstance(c, dict):
            continue
        contents[a] = c
        if c.get("areaId") != a:
            prob.append(f"content/{a}: areaId errado")
        if not c.get("resumo") or not c.get("cheatsheet"):
            pend.append(f"content/{a}: falta resumo ou cheatsheet")
        for n, p in enumerate(as_list(c.get("patterns"))):
            evidence = as_list(as_dict(p).get("evidence"))
            if not evidence:
                prob.append(f"content/{a}.patterns[{n}]: sem evidence")
            for e in evidence:
                if e not in qarea:
                    prob.append(f"content/{a}.patterns[{n}]: id inexistente {e}")
                elif qarea[e] != a:
                    prob.append(f"content/{a}.patterns[{n}]: {e} é de {qarea[e]}")
        txt = json.dumps(c, ensure_ascii=False)
        for t in set(re.findall(r'<(/?[a-zA-Z][a-zA-Z0-9]*)', txt)):
            if t.lstrip('/') not in ALLOW:
                prob.append(f"content/{a}: tag fora da lista permitida <{t}>")
        if re.search(r'<[^>]*\son[a-z]+\s*=|<script', txt, re.I):
            prob.append(f"content/{a}: script ou handler no conteúdo")
        for e in set(ID_REF.findall(txt)):
            if e not in qarea:
                prob.append(f"content/{a}: id citado inexistente {e}")


cards = []


def check_cards():
    doc = load("flashcards.json", missing_is_problem=False)
    cards.extend(c for c in as_list(as_dict(doc).get("cards")) if isinstance(c, dict))
    ids = [c.get("id") for c in cards]
    for i, c in collections.Counter(ids).items():
        if c > 1:
            prob.append(f"flashcards: id duplicado {i}")
    for c in cards:
        i = c.get("id")
        if c.get("area") not in area_ids:
            prob.append(f"{i}: área inválida {c.get('area')!r}")
        if not re.fullmatch(r'fc-[a-z-]+-\d{3}', str(i)):
            prob.append(f"{i}: id fora do padrão")
        s = c.get("sourceQuestionId")
        if s and (s not in qarea or qarea[s] != c.get("area")):
            prob.append(f"{i}: sourceQuestionId inválido {s}")
        if re.search(r'<[a-zA-Z/]', str(c.get("front")) + str(c.get("back"))):
            prob.append(f"{i}: HTML em card")


def check_plan():
    pl = load("plan.json", missing_is_problem=False)
    if not isinstance(pl, dict):
        return
    if set(pl) != {'version', 'examDate', 'sourceNote', 'crossPatterns', 'examDay', 'blocks'}:
        prob.append("plan: chaves do topo diferentes do esperado")
    if pl.get("examDate") != "2026-12-06":
        prob.append(f"plan: examDate {pl.get('examDate')!r}, o edital diz 2026-12-06")
    tot, end = 0, None
    for b in as_list(pl.get("blocks")):
        b = as_dict(b)
        if set(b) != {'n', 'label', 'weeks', 'focus', 'goal', 'checklist'}:
            prob.append(f"plan.blocks[{b.get('n')}]: chaves")
        for f in as_list(b.get("focus")):
            if f not in area_ids:
                prob.append(f"plan.blocks[{b.get('n')}]: focus {f}")
        m = re.search(r'\((\d{2})/(\d{2}) a (\d{2})/(\d{2})\)', str(b.get("weeks")))
        if not m:
            prob.append(f"plan.blocks[{b.get('n')}]: weeks sem intervalo")
            continue
        y = int(str(pl.get("examDate"))[:4])
        start, end = datetime.date(y, int(m[2]), int(m[1])), datetime.date(y, int(m[4]), int(m[3]))
        tot += (end - start).days + 1
    if end and str(end) != pl.get("examDate"):
        prob.append(f"plan: último bloco termina em {end}, examDate {pl.get('examDate')}")
    for n, p in enumerate(as_list(pl.get("crossPatterns"))):
        evidence = as_list(as_dict(p).get("evidence"))
        if [e for e in evidence if e not in qarea]:
            prob.append(f"plan.crossPatterns[{n}]: id inexistente")
        if len({qarea[e] for e in evidence if e in qarea}) < 2:
            prob.append(f"plan.crossPatterns[{n}]: evidência de menos de 2 áreas")
    txt = json.dumps(pl, ensure_ascii=False)
    if re.search(r'<[a-zA-Z/]', txt):
        prob.append("plan: tem tag HTML (o renderizador escapa tudo)")
    for m in re.finditer(r'(\d+)\s+cards?\b', txt):
        if int(m.group(1)) > 100 and int(m.group(1)) != len(cards):
            prob.append(f"plan: cita {m.group(1)} cards, o deck tem {len(cards)}")
    for e in set(ID_REF.findall(txt)):
        if e not in qarea:
            prob.append(f"plan: id citado inexistente {e}")
    print(f"plano: {len(as_list(pl.get('blocks')))} blocos, {tot} dias até {pl.get('examDate')}")


def check_old_terms():
    """Código: é problema. Dados e estudo.html são de outros agentes: fica como pendência."""
    code = [S / "simulado.html", *sorted((S / "shared").glob("*"))]
    for f in code:
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if OLD_TERMS.search(line):
                prob.append(f"{f.relative_to(S)}:{n}: referência ao projeto antigo")
    others = [S / "estudo.html", D / "areas.json", *sorted((D / "content").glob("*.json")),
              D / "flashcards.json", D / "plan.json", D / "README.md"]
    for f in others:
        if not f.exists():
            continue
        hits = [n for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1) if OLD_TERMS.search(line)]
        if hits:
            pend.append(f"{f.relative_to(S)}: referência ao projeto antigo nas linhas {hits[:8]}")
    # Só o texto da questão: source.file e source.reused registram a origem de propósito.
    for q in qs:
        text = json.dumps({k: q.get(k) for k in ("stem", "passage", "alternatives", "explanationSummary")}, ensure_ascii=False)
        if OLD_TERMS.search(text):
            pend.append(f"{q.get('id')}: texto da questão cita o projeto antigo")


def report():
    print(f"{'área':12} {'ofic.':>5} {'autor.':>6} {'total':>5} {'assuntos':>9} {'figs':>4} {'cards':>5} conteúdo")
    for a in area_ids:
        inside = [q for q in qs if q.get("area") == a]
        n_auth = sum(authored(q) for q in inside)
        covered = {q.get("subtopic") for q in inside} & set(topics[a])
        figs = sum(1 for q in inside if q.get("images"))
        n_cards = sum(1 for c in cards if c.get("area") == a)
        print(f"{a:12} {len(inside) - n_auth:5} {n_auth:6} {len(inside):5} {len(covered):4}/{len(topics[a]):<4} {figs:4} {n_cards:5} {'sim' if a in contents else 'não'}")
        need = LANG.get(a)
        if need and len(inside) < need:
            pend.append(f"{a}: {len(inside)} questões, a prova pede {need}")
        if not need and not inside:
            pend.append(f"{a}: nenhuma questão no banco")
        missing_topics = [t for t in topics[a] if t not in covered]
        if inside and missing_topics:
            pend.append(f"{a}: {len(missing_topics)} assunto(s) sem questão, ex.: {missing_topics[0]}")
    specific = sum(1 for q in qs if q.get("area") in area_ids and q.get("area") not in LANG)
    if specific < SPECIFIC_NEED:
        pend.append(f"específicas: {specific} questões, a prova sorteada pede {SPECIFIC_NEED}")
    n_auth = sum(authored(q) for q in qs)
    files = collections.Counter(as_dict(q.get("source")).get("file") for q in qs if not authored(q))
    print(f"banco: {len(qs)} questões, {len(qs) - n_auth} oficiais, {n_auth} autorais, {len(files)} provas de origem")
    print(f"específicas: {specific}/{SPECIFIC_NEED} para a prova sorteada")
    queue = D.parent / "_internal" / "review-queue.json"
    if queue.exists():
        try:
            v = json.loads(queue.read_text(encoding="utf-8"))
            items = v if isinstance(v, list) else as_list(as_dict(v).get("items") or as_dict(v).get("questions"))
            print(f"fila de revisão: {len(items)} item(ns) fora do banco")
        except ValueError as e:
            prob.append(f"_internal/review-queue.json: JSON inválido ({e})")


section("questões", check_questions)
section("conteúdo", check_content)
section("flashcards", check_cards)
section("plano", check_plan)
section("sobras do projeto antigo", check_old_terms)
section("relatório", report)

print(f"PENDÊNCIAS: {len(pend)}")
for p in pend[:40]:
    print("  -", p)
if len(pend) > 40:
    print(f"  ... e mais {len(pend) - 40}")
print(f"PROBLEMAS: {len(prob)}")
for p in prob[:60]:
    print("  -", p)
if len(prob) > 60:
    print(f"  ... e mais {len(prob) - 60}")
sys.exit(1 if prob or ("--strict" in sys.argv and pend) else 0)
