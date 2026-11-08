# Confere se cada trecho de texto dos enunciados restaurados existe no PDF (ignora espaços e hifenização).
import json,re,subprocess,os,unicodedata
R="/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/"
qs=json.load(open(R+'study/data/questions.json'))['questions']
pdfs={"prova6":"prova_6_analista_de_sistemas_junior_processos_de_negocio.pdf","prova07":"tarde_prova_07_analista_de_sistemas_junior_processos_de_negocio.pdf","transp15":"cesgranrio-2018-transpetro-analista-de-sistemas-junior-processos-de-negocio-prova.pdf","transp23e6":"cesgranrio-2023-transpetro-profissional-transpetro-de-nivel-superior-junior-enfase-6-processos-de-negocios-prova.pdf","psjpn2018":"analista_de_sistemas_junior_processos_de_negocio2018.pdf","petro2012":"cesgranrio-2012-petrobras-analista-de-sistemas-junior-processos-de-negocios-2012-prova.pdf","petro08":"petrobras0208_gabsup_gabarito.pdf"}
cache={}
def sq(s):
    s=unicodedata.normalize('NFKC',s)
    return re.sub(r'[^0-9a-zà-ÿ]+','',s.lower())

def text(k):
    if k not in cache:
        out=f"/tmp/_x_{k}.txt"
        subprocess.run(['./pdftext',R+'provas e gabaritos/'+pdfs[k],out],capture_output=True)
        t=open(out,encoding='utf-8').read(); os.remove(out)
        cache[k]=sq(t)
    return cache[k]
bad=0;n=0
for q in qs:
    if not q.get('images'): continue
    for seg in re.split(r'\[\[fig:\d+\]\]|\n',q['stem']):
        seg=seg.strip(' •')
        if len(seg)<25: continue
        n+=1
        if sq(seg) not in text(q['id'].split('-')[0]):
            bad+=1; print('DIF',q['id'],seg[:110])
print('trechos',n,'divergentes',bad)
