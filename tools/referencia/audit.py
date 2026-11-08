import json,re
R="/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/study/"
qs=json.load(open(R+'data/questions.json'))['questions']
rq=json.load(open(R+'_internal/review-queue.json'))['entries']
key={}
key['prova07']="1D 2E 3B 4A 5D 6D 7E 8C 9C 10D 11D 12C 13C 14A 15E 16B 17E 18D 19E 20E 21E 22A 23D 24A 25C 26A 27B 28C 29A 30E 31A 32B 33A 34C 35E 36C 37A 38E 39B 40D 41A 42D 43C 44B 45C 46D 47A 48A 49E 50D 51E 52D 53A 54D 55B 56E 57B 58A 59E 60E 61C 62B 63D 64C 65B 66E 67B 68D 69A 70E"
key['petro08']="1A 2E 3E 4B 5E 6A 7C 8A 9E 10C 11D 12E 13A 14B 15B 16E 17C 18D 19E 20C 21E 22E 23A 24B 25A 26C 27B 28A 29A 30C 31C 32D 33B 34C 35D 36C 37D 38C 39B 40C 41B 42E 43C 44E 45E 46D 47D 48B 49C 50C 51B 52D 53B 54A 55A 56C 57B 58E 59E 60E 61B 62D 63D 64E 65A 66B 67C 68C 69E 70A"
key['psjpn2018']="1D 2A 3A 4C 5E 6B 7D 8C 9B 10E 11B 12C 13E 14B 15E 16A 17C 18D 19A 20E 21A 22A 23D 24C 25C 26E 27A 28E 29D 30E 31D 32C 33D 34B 35C 36E 37C 38C 39B 40B 41A 42B 43D 44A 45E 46A 47B 48C 49B 50D 51B 52B 53B 54B 55A 56B 57D 58E 59A 60B 61B 62B 63B 64A 65E 66B 67C 68E 69A 70D"
for k,v in key.items():
    K={int(re.match(r'\d+',x).group()):x[-1] for x in v.split()}
    bq=[q for q in qs if q['id'].startswith(k+'-')]
    bad=[(q['id'],q['correctKey'],K.get(q['source']['originalNumber'])) for q in bq if K.get(q['source']['originalNumber'])!=q['correctKey']]
    rb=[(e['id'],e.get('gabaritoLetter'),K.get(e['source']['originalNumber'])) for e in rq if e['id'].startswith(k+'-')]
    print(k,'banco',len(bq),'divergentes',bad); print('  fila',rb)
key6="1C 2D 3B 4A 5A 6A 7E 8B 9C 10A 11C 12A 13A 14C 15E 16B 17D 18D 19E 20D 21A 22C 23C 24A 25B 26E 27C 28E 29D 30B 31A 32D 33B 34C 35C 36D 37C 38A 39B 40B 41C 42C 43C 44B 45E 46B 47E 48C 49B 50E 51D 52E 53A 54E 55C 56A 57C 58E 59C 60D 61B 62C 63C 64C 65C 66B 67E 68C 69B 70E"
K={int(re.match(r'\d+',x).group()):x[-1] for x in key6.split()}
bq=[q for q in qs if q['id'].startswith('prova6-')]
print('prova6 banco',len(bq),'divergentes',[(q['id'],q['correctKey'],K.get(q['source']['originalNumber'])) for q in bq if K.get(q['source']['originalNumber'])!=q['correctKey']])
print('  fila',[(e['id'],e.get('gabaritoLetter'),K.get(e['source']['originalNumber'])) for e in rq if e['id'].startswith('prova6-')])
by={q['id']:q for q in qs}
for i in ['prova07-q29','prova07-q42','petro08-q2','petro08-q4','petro08-q6','petro08-q43']:
    q=by[i]; print('==',i,'bank',q['correctKey'],'verif',{k:str(v)[:230] for k,v in q['verification'].items()})
    print(' STEM',q['stem'][:330].replace('\n',' '))
    for a in q['alternatives']: print('  ',a['key'],a['text'][:150])
    print(' EXP',q['explanationSummary'][:280])
