#!/usr/bin/env python3
"""Funde staging/*.json e as questões autorais revisadas em study/data/questions.json.

Uso: python3 -I tools/merge.py [--dry-run]
Mantém as questões de PT/EN reaproveitadas (source.reused), substitui todo o resto.
Só aceita questão que passa nos invariantes; o resto vai para a fila com o motivo.
"""
import json, pathlib, sys, collections

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "study" / "data"
ST = R / "study" / "_internal" / "staging"
AUT = R / "docs" / "normas" / "questoes-autorais-revisadas.json"
dry = "--dry-run" in sys.argv

areas = json.load(open(D / "areas.json", encoding="utf-8"))["areas"]
topics = {a["id"]: set(a["topics"]) for a in areas}
current = json.load(open(D / "questions.json", encoding="utf-8"))["questions"]
# Provas de 2008 e 2012 da Petrobras têm o mesmo caderno de básicos nas duas ênfases: a
# versão extraída aqui substitui a reaproveitada (a de 2008 tinha palavras coladas).
SUPERSEDED = ("petro08-", "petro2012-")
kept = [q for q in current if (q.get("source") or {}).get("reused") and not q["id"].startswith(SUPERSEDED)]

incoming, queue, fora, report = [], [], [], collections.Counter()
for f in sorted(ST.glob("*.json")):
    s = json.load(open(f, encoding="utf-8"))
    incoming += [(f.stem, q) for q in s.get("questions", [])]
    queue += [dict(item, concurso=f.stem) for item in s.get("queue", [])]
    fora += [dict(item, concurso=f.stem) for item in s.get("fora", [])]
if AUT.exists():
    a = json.load(open(AUT, encoding="utf-8"))
    incoming += [("autoral", q) for q in (a["questions"] if isinstance(a, dict) else a)]


def problems(q):
    p = []
    keys = [x.get("key") for x in q.get("alternatives") or []]
    if q.get("area") not in topics: p.append("área inválida")
    elif q.get("subtopic") not in topics[q["area"]]: p.append(f"subtopic fora de areas.json: {q.get('subtopic')}")
    if len(keys) not in (4, 5) or len(set(keys)) != len(keys): p.append("alternativas inválidas")
    if q.get("correctKey") not in keys: p.append("correctKey ausente das alternativas")
    v = q.get("verification") or {}
    if not v.get("agree"): p.append("verificação sem concordância")
    if q.get("annulled"): p.append("anulada")
    if not q.get("stem") or not q.get("explanationSummary"): p.append("sem enunciado ou explicação")
    src = q.get("source") or {}
    if src.get("authored"):
        if not src.get("basis"): p.append("autoral sem basis")
    elif v.get("gabaritoAnswer") != q.get("correctKey"): p.append("correctKey difere do gabarito oficial")
    for img in q.get("images") or []:
        if not (R / "study" / img["src"]).exists(): p.append(f"figura inexistente {img['src']}")
    return p


seen = {q["id"] for q in kept}
accepted = []
for origin, q in incoming:
    p = problems(q)
    if q.get("id") in seen: p.append("id duplicado")
    if p:
        queue.append({"id": q.get("id"), "concurso": origin, "motivo": "; ".join(p), "questao": q})
        report["rejeitadas na fusão"] += 1
        continue
    q.setdefault("status", "confirmed"); q.setdefault("annulled", False)
    seen.add(q["id"]); accepted.append(q)

final = kept + accepted
by_area = collections.Counter(q["area"] for q in final)
by_kind = collections.Counter("autoral" if q["source"].get("authored") else "reaproveitada" if q["source"].get("reused") else "oficial" for q in final)
print("total", len(final), dict(by_kind))
print("por área", dict(sorted(by_area.items())))
print("fila", len(queue), "| fora do edital", len(fora), "|", dict(report))
for item in queue:
    if item.get("motivo", "").startswith(("subtopic", "área", "alternativas", "correctKey ausente", "figura", "id dup", "autoral")):
        print("  rejeitada:", item["id"], "-", item["motivo"][:120])
if not dry:
    json.dump({"version": 1, "questions": final}, open(D / "questions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump({"version": 1, "items": queue}, open(R / "study" / "_internal" / "review-queue.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump({"version": 1, "items": fora}, open(R / "study" / "_internal" / "fora-do-edital.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("gravado")
