#!/usr/bin/env python3
"""Numera os textos-base com as linhas reais do PDF, conferindo marcadores e citações."""
import html, json, os, re, sys, unicodedata

SP = os.path.dirname(os.path.abspath(__file__))
QF = "/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/study/data/questions.json"
data = json.load(open(QF, encoding="utf-8"))
qs = data["questions"]
ALL_LINES = {k: json.load(open(f"{SP}/lines-{k}.json")) for k in ("prova6", "psjpn2018", "transp15", "petro2012", "petro08")}


def sq(s):
    s = unicodedata.normalize("NFKC", html.unescape(re.sub(r"<[^>]+>", "", s)))
    return re.sub(r"[^0-9a-zà-ÿ]+", "", s.lower())


def ordered(exam):
    lines = ALL_LINES[exam]
    for l in lines:
        l["col"] = 1 if l["x"] >= 295 else 0
    return sorted(lines, key=lambda l: (l["page"], l["col"], l["top"]))


def runs_html(line, strip):
    """Linha com itálico preservado; `strip` remove o número de margem colado no texto."""
    if strip:
        return html.escape(strip, quote=False)
    out = ""
    for r in line["runs"]:
        t = html.escape(r["text"].replace("\n", " "), quote=False)
        out += f"<em>{t.strip()}</em>" + (" " if t.endswith(" ") else "") if r["italic"] and t.strip() else t
    return out.strip()


def number_block(exam, paragraphs, report):
    """paragraphs: corpo de um texto. Devolve HTML numerado, por parágrafo."""
    body = [sq(p) for p in paragraphs]
    full = "".join(body)
    ends, acc = [], 0
    for b in body:
        acc += len(b)
        ends.append(acc)
    lines = ordered(exam)
    head = full[:25]
    start = next((i for i, l in enumerate(lines) if sq(l["text"]) and full.startswith(sq(l["text"])) and len(sq(l["text"])) >= 8), None)
    if start is None:
        start = next((i for i, l in enumerate(lines) if head[:15] in sq(l["text"])), None)
    if start is None:
        report.append(f"INÍCIO não encontrado: {head}")
        return None
    pos, n, out, cur, para, skipped, markers, tops = 0, 0, [], [], 0, 0, [], {}
    for l in lines[start:]:
        if pos >= len(full):
            break
        text = l["text"].strip()
        if re.fullmatch(r"\d{1,3}", text):
            markers.append((int(text), l["page"], l["col"], l["top"]))
            continue
        s = sq(text)
        if not s:
            continue
        strip = None
        if not full.startswith(s, pos):
            m = re.fullmatch(r"(?:(\d{1,3})\s+)?(.*?)(?:\s+(\d{1,3}))?", text)
            alt = sq(m.group(2)) if m else ""
            if alt and full.startswith(alt, pos):
                if m.group(1):
                    markers.append((int(m.group(1)), l["page"], l["col"], l["top"]))
                if m.group(3):
                    markers.append((int(m.group(3)), l["page"], l["col"], l["top"]))
                s, strip = alt, m.group(2)
            else:
                skipped += 1
                if skipped > 60:
                    break
                continue
        n += 1
        tops[n] = (l["page"], l["col"], l["top"])
        pos += len(s)
        cur.append(f"{n} {runs_html(l, strip)}")
        while para < len(ends) and pos >= ends[para]:
            para += 1
            if cur:
                out.append("<p>" + "<br>".join(cur) + "</p>")
                cur = []
    if cur:
        out.append("<p>" + "<br>".join(cur) + "</p>")
    if pos < len(full):
        report.append(f"INCOMPLETO em {pos}/{len(full)} perto de {full[pos:pos+40]!r} (linhas={n}, puladas={skipped})")
        return None
    # Marcadores impressos (5, 10...) têm de cair na linha de mesmo número.
    markers = [m for m in markers if m[3] < 760]  # fora o número da página, no rodapé
    bad = [m for m in markers if m[0] in tops and (tops[m[0]][0], tops[m[0]][1]) == (m[1], m[2]) and abs(tops[m[0]][2] - m[3]) > 6]
    good = [m for m in markers if m[0] in tops and (tops[m[0]][0], tops[m[0]][1]) == (m[1], m[2]) and abs(tops[m[0]][2] - m[3]) <= 6]
    report.append(f"linhas={n} marcadores ok={len(good)} divergentes={[(b[0], b[3], tops[b[0]][2]) for b in bad]} puladas={skipped}")
    return out


def split_paragraphs(passage):
    return re.findall(r"<p>.*?</p>", passage, flags=re.S)


def is_label(p):
    inner = re.sub(r"^<p>|</p>$", "", p).strip()
    return bool(re.fullmatch(r"(<(strong|em)>.*?</\2>\s*)+", inner, flags=re.S))


SOURCE = re.compile(r"Adapt|Retrieved|Acesso|Access on|Available|From The Economist|Fragmento|Editora|O Globo|Financial Times", re.I)


def renumber(exam, passage, report):
    ps = split_paragraphs(passage)
    # Separa em blocos: rótulos, corpo, fonte. Um novo rótulo depois de corpo inicia outro texto.
    out, body = [], []

    def flush():
        nonlocal body
        if not body:
            return True
        tail = []
        while body and (is_label(body[-1]) or (SOURCE.search(body[-1]) and len(sq(body[-1])) < 200)):
            tail.insert(0, body.pop())
        numbered = number_block(exam, body, report)
        if numbered is None:
            return False
        out.extend(numbered + tail)
        body = []
        return True

    for p in ps:
        if body and re.match(r"<p>\s*<strong>\s*Text(o)?\s+I", p):
            if not flush():
                return None
            out.append(p)
        elif is_label(p) and not body:
            out.append(p)
        else:
            body.append(p)
    return "".join(out) if flush() else None


CITE = re.compile(r"[“\"]([^”\"]{8,}?)[”\"]\s*\((?:l\.|lines?|linhas?)\s*(\d+)(?:\s*[-–]\s*(\d+))?\)", re.I)


def check_citations(q, new):
    """Confere se cada citação do enunciado/alternativas cai nas linhas numeradas."""
    numbered = {}
    for m in re.finditer(r"(?:^|<br>|<p>)(\d+) (.*?)(?=<br>|</p>)", new):
        numbered.setdefault(int(m.group(1)), []).append(sq(m.group(2)))
    res = []
    for text in [q["stem"]] + [a["text"] for a in q["alternatives"]]:
        for quote, a, b in CITE.findall(text):
            a, b = int(a), int(b or a)
            ok = False
            if not all(k in numbered for k in range(a, b + 1)):
                res.append((False, quote, a, b))
                continue
            for i in range(max(len(numbered[k]) for k in range(a, b + 1))):
                joined = "".join(numbered[k][min(i, len(numbered[k]) - 1)] for k in range(a, b + 1))
                if sq(quote.replace("[...]", ""))[:60] in joined:
                    ok = True
            res.append((ok, quote, a, b))
    return res


groups = {}
for q in qs:
    if q.get("passage"):
        groups.setdefault(q["passage"], []).append(q)

done, failed, total_ok, total_bad = {}, 0, 0, 0
for passage, group in groups.items():
    exam = group[0]["id"].split("-")[0]
    if exam == "transp23e6" or re.search(r"<br>2 ", passage):
        continue
    report = []
    new = renumber(exam, passage, report)
    label = sq(passage)[:28]
    print(f"== {exam} n={len(group)} {label}: {' | '.join(report)}")
    if new is None:
        failed += 1
        continue
    if sq(re.sub(r"(?:^|(?<=<br>)|(?<=<p>))\d+ ", "", new)) != sq(passage):
        a, b = sq(re.sub(r"(?:^|(?<=<br>)|(?<=<p>))\d+ ", "", new)), sq(passage)
        i = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
        print(f"   TEXTO difere em {i}: {a[i-20:i+30]!r} x {b[i-20:i+30]!r}")
        failed += 1
        continue
    done[passage] = new
    for q in group:
        for ok, quote, a, b in check_citations(q, new):
            total_ok += ok
            total_bad += not ok
            if not ok:
                print(f"   CITAÇÃO {q['id']} l.{a}-{b}: {quote[:70]}")
print(f"textos numerados={len(done)} falhas={failed} citações ok={total_ok} divergentes={total_bad}")

if "--write" in sys.argv:
    if failed:
        sys.exit("há falhas; nada gravado")
    for q in qs:
        if q.get("passage") in done:
            q["passage"] = done[q["passage"]]
    open(QF, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("gravado")
