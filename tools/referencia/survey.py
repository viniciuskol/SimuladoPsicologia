import json,re,collections
R="/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/study/data/questions.json"
qs=json.load(open(R))['questions']; by={q['id']:q for q in qs}
cite=re.compile(r'\b(?:l\.|ll\.|linhas?|lines?)\s*\(?\d',re.I)
groups=collections.defaultdict(list)
for q in qs:
    if q.get('passage'): groups[q['passage']].append(q)
print('textos',len(groups))
for p,l in groups.items():
    ids=[q['id'] for q in l]
    c=[q['id'] for q in l if cite.search(q['stem']+' '.join(a['text'] for a in q['alternatives']))]
    print(f"{ids[0].split('-')[0]:10} n={len(ids)} citam={len(c)} numerado={bool(re.search(r'<br>2 ',p))} len={len(p)} ini={re.sub('<[^>]+>',' ',p)[:70]!r} fim={re.sub('<[^>]+>',' ',p)[-70:]!r}")
print('---destaque')
H='prova6-q7 prova6-q9 psjpn2018-q5 psjpn2018-q6 psjpn2018-q8 psjpn2018-q9 psjpn2018-q10 transp15-q7 transp23e6-q9 petro2012-q6 petro2012-q8 petro08-q9 petro08-q10'.split()
for i in H:
    q=by[i]; print(i,'|',q['stem'][:200].replace('\n',' '))
    for a in q['alternatives']: print('   ',a['key'],a['text'][:110])
