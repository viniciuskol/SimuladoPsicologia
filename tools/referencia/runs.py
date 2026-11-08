import json,re,html
H={'prova6':[7,9],'psjpn2018':[5,6,8,9,10],'transp15':[7],'petro2012':[6,8],'petro08':[9,10]}
for k,ns in H.items():
    L=json.load(open(f'lines-{k}.json'))
    for l in L: l['col']=1 if l['x']>=295 else 0
    L.sort(key=lambda l:(l['page'],l['col'],l['top']))
    for n in ns:
        idx=[i for i,l in enumerate(L) if l['text'].strip()==str(n)]
        # número da questão: precisa estar perto da margem e seguido de texto
        for i in idx:
            nxt=[i2 for i2 in range(i+1,len(L)) if L[i2]['text'].strip()==str(n+1)]
            end=nxt[0] if nxt else i+40
            if end-i>45 or end-i<6: continue
            segs=[]
            for l in L[i+1:end]:
                for r in l['runs']:
                    if (r['bold'] or r['italic'] or r['underline']) and r['text'].strip(): segs.append(('B' if r['bold'] else '')+('I' if r['italic'] else '')+('U' if r['underline'] else '')+':'+r['text'].strip())
            print(k,n,'p',L[i]['page'],segs[:24])
            break
