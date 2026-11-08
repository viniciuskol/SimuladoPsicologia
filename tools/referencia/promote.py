#!/usr/bin/env python3
"""Promove questões da fila, corrige gabaritos conferidos nas colunas oficiais e atualiza citações."""
import json, os, re, subprocess, sys

SP = os.path.dirname(os.path.abspath(__file__))
R = "/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/"
S = R + "study/"
TOOL = SP + "/pdftool"
PDF = {
    "prova6": "prova_6_analista_de_sistemas_junior_processos_de_negocio.pdf",
    "prova07": "tarde_prova_07_analista_de_sistemas_junior_processos_de_negocio.pdf",
    "transp23e6": "cesgranrio-2023-transpetro-profissional-transpetro-de-nivel-superior-junior-enfase-6-processos-de-negocios-prova.pdf",
    "petro08": "petrobras0208_gabsup_gabarito.pdf",
}


def load(path):
    raw = open(S + path, encoding="utf-8").read()
    data = json.loads(raw)
    tail = next((t for t in ("\n", "") if json.dumps(data, ensure_ascii=False, indent=2) + t == raw), None)
    if tail is None:
        sys.exit(f"formatação de {path} não reproduzida; nada gravado")
    return data, tail


qdata, qtail = load("data/questions.json")
rdata, rtail = load("_internal/review-queue.json")
cdata, ctail = load("data/content/seg-info.json")
qs = qdata["questions"]
by = {q["id"]: q for q in qs}
queue = {e["id"]: e for e in rdata["entries"]}

AUDIT = "Gabarito conferido na imagem da coluna oficial do cargo em novembro de 2026."
EXTERNAL = "Gabarito de fonte externa, sem cópia oficial no repositório; a resposta foi confirmada pelo raciocínio."

# id: gabarito, confiança, nota, resumo, {alternativa: explicação}, enunciado, recortes, rótulo das alternativas
P = {
 "psjpn2018-q55": ("A", "high", AUDIT + " Divisão de práticas segundo Wiegers.",
   "Na divisão clássica do desenvolvimento de requisitos, criar protótipos é prática de análise: ajuda a entender e refinar o que foi levantado.",
   {"B": "Identificar casos de uso é prática de elicitação.", "C": "Inspecionar documentos de requisitos é prática de validação.",
    "D": "Definir critérios de aceitação é prática de validação.", "E": "Registrar regras de negócio é prática de especificação."}, None, [], None),
 "prova6-q48": ("C", "medium", AUDIT + " E também descreve um problema real; a banca escolheu C.",
   "Dados incompletos vindos de fontes diversas, como medições de temperatura com falhas, são um problema típico de qualidade e precisam de tratamento antes da carga.",
   {"A": "Atribui o problema a um suposto endereçamento de cálculos da ferramenta, explicação sem base.",
    "B": "Datas não precisam mencionar latitude e longitude da base.",
    "D": "Ferramentas OLAP trabalham com atributos categóricos, sem exigir conversão para número.",
    "E": "Problema real de integridade, mas a redação é confusa e o gabarito oficial é C."}, None, [], None),
 "prova6-q54": ("E", "high", AUDIT + " O sublinhado de w na figura indica atributo de classe.",
   "No diagrama, w está sublinhado: é atributo de classe, não de instância. Entre os de instância, -x é privado, ~z é de pacote e C2 está em outro pacote. Só #y, protegido, fica acessível à subclasse.",
   {"A": "w é atributo de classe, e z, de visibilidade de pacote, não é acessível de outro pacote.",
    "B": "x é privado de C1, e z tem visibilidade de pacote.",
    "C": "w está sublinhado: é atributo de classe, não de instância.",
    "D": "w é atributo de classe, e a pergunta trata de atributos de instância."},
   "[[fig:1]]\n\nO esboço de diagrama de classes ilustrado na figura, usando a notação proposta pela linguagem UML, apresenta duas classes C1 e C2 e dois pacotes p1 e p2.\n\nQuais atributos de instância podem ser manipulados por métodos definidos na classe C2?",
   [(14, 25, 510, 270, 120, "Pacote p1 com a classe C1, de atributos +w sublinhado, -x, #y e ~z; pacote p2 com a classe C2, subclasse de C1.")], None),
 "psjpn2018-q36": ("E", "medium", AUDIT + " Lista de memorização, sem padrão universal que permita derivar a resposta.",
   "A resposta oficial lista pertinência, comparabilidade, limitação de tempo, mensurabilidade e confiabilidade. É uma lista para memorizar, e outras fontes usam critérios diferentes.",
   {"A": "Traz precisão, eficiência e flexibilidade, fora da lista oficial desta questão.",
    "B": "Traz precisão, conversibilidade e eficiência, fora da lista oficial desta questão.",
    "C": "Traz precisão, maneabilidade e flexibilidade, fora da lista oficial desta questão.",
    "D": "Traz conversibilidade, eficiência e maneabilidade, fora da lista oficial desta questão."}, None, [], None),
 "prova07-q13": ("C", "high", AUDIT + " Rede relida do PDF e calculada de novo.",
   "A duração é de 14 dias, com caminho crítico 3-9-13-15. A atividade 14 termina no mais cedo no dia 9 e pode terminar até o dia 12, então sua folga total é de 3 dias.",
   {"A": "A atividade 7 termina no dia 5 e a 12 começa no dia 5: a folga livre é 0.",
    "B": "A atividade 9 termina no dia 8 e a 13 começa no dia 8: a folga livre é 0.",
    "D": "A atividade 13 está no caminho crítico: a folga total é 0.",
    "E": "A atividade 3 está no caminho crítico: a folga total é 0."},
   "[[fig:1]]\n\nAnalisando a rede acima, verifica-se que a folga",
   [(6, 110, 95, 370, 290, "Rede de 15 atividades. I leva a 1 (2 dias), 2 (3) e 3 (3). 1 vai a 4 (3) e 5 (2). 5 e 6 (1) vão a 11 (3). 2 vai a 6, 7 (2) e 8 (3). 7 vai a 12 (4). 8 e 9 (5) vão a 13 (4). 3 vai a 9 e 10 (3). 10 vai a 14 (3). 4, 12, 13 e 14 vão a 15 (2), que vai a F.")], None),
 "prova07-q24": ("A", "high", AUDIT + " O registro anterior da fila tinha lido outra coluna.",
   "W tem negação sobre uma disjunção, então não está em forma normal. X é disjunção de conjunções de literais, a forma normal disjuntiva. Y é conjunção de disjunções de literais, a forma normal conjuntiva.",
   {"B": "Z tem negação sobre uma conjunção, então não está na forma normal disjuntiva.",
    "C": "X está na forma normal disjuntiva, e W não está em nenhuma forma normal.",
    "D": "Y está na forma normal conjuntiva, e X não fica sem forma normal.",
    "E": "Z não está em forma normal conjuntiva nem X fica na conjuntiva."},
   "Associe as proposições da lógica sentencial na coluna da direita, onde P e Q são predicados atômicos, às explicações na coluna da esquerda.\n\n[[fig:1]]\n\nAs associações corretas são:",
   [(9, 308, 560, 262, 92, "I: não está em nenhuma forma normal. II: forma normal disjuntiva. III: forma normal conjuntiva. W: não (P ou não Q) e (P ou não Q). X: (P e não Q) ou (não P e Q). Y: (P ou Q) e (não P ou Q). Z: não (P e Q) ou (P e não Q).")], None),
 "prova07-q25": ("C", "high", AUDIT + " O registro anterior da fila tinha lido outra coluna.",
   "A proposição I é satisfatível, mas não tautologia: com P e Q falsos, R verdadeiro e S falso, ela é falsa; com todos verdadeiros, é verdadeira. A II é tautologia: se P→Q e P∧R valem, Q vale, e então Q∨S também.",
   {"A": "I não é tautologia, e II é tautologia.", "B": "I não é tautologia, e II não é contradição.",
    "D": "II é tautologia, não contradição.", "E": "I não é contradição, pois é verdadeira quando P, Q, R e S são verdadeiros."},
   "Dadas as proposições da lógica sentencial e as explicações, associe a coluna da direita com a coluna da esquerda.\n\n[[fig:1]]\n\nAs associações corretas são:",
   [(10, 25, 137, 265, 112, "I: (P implica Q) implica ((P ou R) implica (Q e S)). II: (P implica Q) implica ((P e R) implica (Q ou S)). X: tautologia. Y: satisfatível, mas não tautologia. Z: contradição.")], None),
 "prova07-q45": ("C", "high", AUDIT + " A primeira frase segue a definição de Elmasri e Navathe; acesso a bases disjuntas e heterogêneas descreve sistemas multibanco.",
   "Data warehouses virtuais oferecem visões de bancos operacionais materializadas para acesso eficiente. A segunda frase é falsa: acesso a bancos disjuntos e geralmente heterogêneos caracteriza sistemas multibanco, não o data warehouse.",
   {"A": "A segunda afirmação é falsa.", "B": "A segunda afirmação é falsa.", "D": "A primeira afirmação é verdadeira, e a segunda é falsa.", "E": "A primeira afirmação é verdadeira."}, None, [], None),
 "prova07-q47": ("A", "high", AUDIT + " O registro anterior da fila tinha lido outra coluna.",
   "Pela definição clássica de Inmon, o data warehouse é orientado a assuntos, integrado, não volátil e variável no tempo.",
   {"B": "O data warehouse guarda histórico de longo prazo; não é temporário.", "C": "Ele integra os dados, em vez de descentralizá-los.",
    "D": "Ele é voltado à análise e à decisão, não à operação.", "E": "A modelagem costuma ser dimensional, muitas vezes desnormalizada."}, None, [], None),
 "prova07-q54": ("D", "high", AUDIT + " O registro anterior da fila tinha lido outra coluna. As alternativas C e E têm o mesmo texto na prova.",
   "Fan-in, fan-out e acoplamento medem dependências entre componentes, e por isso valem tanto para módulos quanto para classes.",
   {"A": "Herança não existe no paradigma estruturado.", "B": "Encapsulamento e herança são próprios da orientação a objetos.",
    "C": "Polimorfismo não existe no paradigma estruturado.", "E": "Polimorfismo não existe no paradigma estruturado."}, None, [], None),
 "transp15-q26": ("E", "high", EXTERNAL + " Classificação dos custos de qualidade segundo Pressman.",
   "Custos de prevenção incluem as atividades de gerência para planejar e coordenar o controle e a garantia da qualidade, além de treinamento e planejamento de testes.",
   {"A": "Testes e depuração são custos de avaliação.", "B": "Coleta de dados e métricas de avaliação são custos de avaliação.",
    "C": "Retrabalho para corrigir erro é custo de falha.", "D": "Revisões técnicas são custos de avaliação nessa classificação."}, None, [], None),
 "transp23e6-q27": ("C", "high", EXTERNAL + " As chaves sublinhadas foram lidas na figura.",
   "Em relacionamento ternário, (1,1) junto de T indica que cada par de R e S se liga a exatamente uma ocorrência de T. Assim, o par RX e SX identifica cada linha de W, e essa é a chave primária.",
   {"A": "TX sozinha não identifica W: a mesma ocorrência de T pode aparecer com pares diferentes.",
    "B": "TX e W1 não identificam W pelo par de R e S.",
    "D": "Incluir TX na chave permitiria o mesmo par de R e S com vários T.",
    "E": "Incluir TX e W1 na chave permitiria o mesmo par de R e S com vários T."},
   "A Figura a seguir exibe um diagrama E-R, que representa o modelo conceitual de um banco de dados.\n\n[[fig:1]]\n\nEsse modelo conceitual deu origem a um esquema relacional cujas tabelas, que representam o mapeamento das entidades R, S e T, são mostradas a seguir. A notação usada para descrevê-las representa suas respectivas chaves primárias, por meio de nomes de colunas sublinhados.\n\nR (RX)\nS (SX)\nT (TX)\n\nQual tabela representa, adequadamente, a relação W, de modo a preservar as restrições existentes no diagrama E-R?\n\n[[fig:2]]",
   [(9, 308, 115, 262, 178, "Diagrama E-R: R com (0,n), S com (0,n) e T com (1,1) ligados ao relacionamento W, que tem o atributo w1."),
    (9, 308, 425, 262, 120, "Cinco esquemas para W(RX, SX, TX, W1), variando as colunas sublinhadas. A: TX. B: TX e W1. C: RX e SX. D: RX, SX e TX. E: RX, SX, TX e W1.")], "Esquema"),
 "petro08-q22": ("E", "high", AUDIT + " CPF é atributo primo em VENDA, pois (CPF, CODIGO_P) é chave candidata.",
   "Em VENDA, (CPF, CODIGO_P) também é chave candidata, porque CPF identifica o cliente. CPF é portanto atributo primo, e sua dependência de CODIGO_C não viola a 2FN nem a 3FN. DATA e QUANTIDADE dependem da chave inteira.",
   {"A": "Em CLIENTE, CIDADE depende diretamente da chave e não há dependência transitiva de atributo não primo.",
    "B": "Em PRODUTO, PRECO depende diretamente da chave e DESCRICAO é chave candidata.",
    "C": "VENDA satisfaz também a 3FN: DATA e QUANTIDADE dependem só da chave inteira.",
    "D": "CPF depende de parte da chave, mas é atributo primo; a 2FN restringe apenas atributos não primos."},
   "[[fig:1]]\n\nSobre as formas normais a que as tabelas satisfazem, assinale a afirmativa correta.",
   [(7, 25, 205, 545, 215, "Tabelas CLIENTE, PRODUTO e VENDA com seus campos e chaves, e as regras de chaves estrangeiras e candidatas.")], None),
 "petro08-q55": ("A", "high", AUDIT,
   "Na composição, a parte pertence a um único todo. O diagrama marca multiplicidade * no lado do todo, ClasseA, o que é um erro.",
   {"B": "A UML não proíbe dependências cíclicas entre classes.",
    "C": "A UML permite herança múltipla; a restrição depende da linguagem, e o enunciado diz que ela ainda não foi escolhida."},
   "[[fig:1]]\n\nA figura acima mostra um diagrama de classes UML desenvolvido para um projeto em que ainda não se sabe em que linguagem será realizada a implementação. Sobre o diagrama, assinale a afirmação correta.",
   [(14, 160, 82, 262, 112, "ClasseA ligada por composição a ClasseB, com * nos dois lados; ClasseB ligada a ClasseC por agregação, com * nos dois lados; ClasseD generaliza ClasseA e ClasseB; ClasseE generaliza ClasseB; ClasseC agrega ClasseE, com *.")], None),
}

# Gabaritos já no banco, corrigidos pela coluna oficial.
FIX = {
 "prova07-q29": ("A", "high", AUDIT + " A edição cobrada lista tendências de ameaças e vulnerabilidades entre as entradas; melhorias de controles e alocação de recursos são saídas.",
   "Entre as entradas da análise crítica pela direção, a norma lista as tendências relacionadas com ameaças e vulnerabilidades. Melhorias nos controles e decisões sobre recursos são saídas da análise.",
   {"B": "Não consta da lista de entradas para a análise crítica pela direção.",
    "C": "Não consta da lista de entradas para a análise crítica pela direção.",
    "D": "Melhorias nos controles são uma saída da análise crítica, não uma entrada.",
    "E": "Decisões sobre alocação de recursos são uma saída da análise crítica, não uma entrada."}),
 "prova07-q42": ("D", "high", AUDIT,
   "A abordagem bottom-up constrói o data warehouse a partir de data marts, e por isso também é conhecida como abordagem Data Mart.",
   {"A": "É a abordagem top-down que costuma exigir maior investimento inicial.",
    "B": "O custo é mais baixo, mas a entrega incremental reduz o risco no curto prazo.",
    "C": "O esquema estrela é comum nessa abordagem, mas não é obrigatório.",
    "E": "A abordagem não se restringe a servidores MOLAP e DOLAP."}),
 "petro08-q2": ("E", "high", AUDIT,
   "Schweitzer liga a grandeza ao que se renuncia. O 2º período do 4º parágrafo mostra exatamente isso: 'Você troca segurança por desafio, dinheiro por satisfação'.",
   {"A": "O 1º período do 1º parágrafo apenas apresenta os pedidos de opinião sobre carreira.",
    "B": "O 2º período do 1º parágrafo só descreve uma insatisfação; não trata de renunciar a algo.",
    "C": "O 1º período do 2º parágrafo fala da necessidade de escolher, sem tratar de renúncia.",
    "D": "O 1º período do 3º parágrafo trata do 'dilema da virada', não da renúncia."}),
 "petro08-q4": ("B", "medium", AUDIT,
   "No trecho, 'armadilhas' são os impasses criados por convites como trocar de empresa. O 'benefício desta dúvida' é a proteção de nunca arriscar, que o autor recusa.",
   {"A": "'Armadilhas' não são enganos, e 'benefício' não significa risco: o autor o recusa para assumir riscos.",
    "C": "'Benefício' não significa conhecimento no trecho.",
    "D": "'Certezas' contradiz o sentido de 'armadilhas'.",
    "E": "'Armadilhas' são as situações do mundo corporativo, não as dúvidas, e 'benefício' não significa prazer."}),
 "petro08-q6": ("A", "medium", AUDIT,
   "As armadilhas, como os convites para trocar de empresa, levam às escolhas. As consequências dessas escolhas dependem das ponderações feitas antes, como os riscos calculados que o autor menciona.",
   {"B": "O parágrafo não diz que as armadilhas traduzem ponderações exigidas pelas consequências.",
    "C": "O parágrafo não coloca as decisões como origem das ponderações.",
    "D": "As consequências não retratam ponderações impostas pelas armadilhas: as ponderações vêm antes da decisão.",
    "E": "As ponderações não geram as armadilhas, que já existem no mundo corporativo."}),
}

KEEP_NOTES = {
 "transp15-q39": "C é a única derivação sem erro: apaga o fornecedor 4444, sem vendas. E tem 3 valores para 5 colunas.",
 "transp15-q40": "O gabarito E exige NOT NULL, incompatível com as cardinalidades mínimas 0 do diagrama.",
 "transp15-q69": "A tradução direta de 'algum tópico' é A, com ∃y. O gabarito D traduz 'todos os tópicos'.",
 "transp15-q70": "A única contradição por tabela-verdade é C; B é tautologia.",
}

if any(i not in queue for i in P) or any(i not in by for i in FIX) or "petro08-q43" not in by:
    sys.exit("ids inesperados; nada gravado")
if "--write" not in sys.argv:
    sys.exit("use --write")

def apply_explanations(q, summary, explain):
    q["explanationSummary"] = summary
    for a in q["alternatives"]:
        a.pop("explanation", None)
        if a["key"] in explain:
            a["explanation"] = explain[a["key"]]

for qid, (key, conf, note, summary, explain) in FIX.items():
    q = by[qid]
    q["correctKey"] = key
    q["verification"] = {"gabaritoAnswer": key, "independentlyDerivedAnswer": key, "agree": True, "confidence": conf, "notes": note}
    apply_explanations(q, summary, explain)

for qid, (key, conf, note, summary, explain, stem, crops, label) in P.items():
    e = queue.pop(qid)
    prefix = qid.split("-")[0]
    images = []
    for n, (page, x, y, w, h, alt) in enumerate(crops, 1):
        src = f"data/figures/{qid}-{n}.png"
        subprocess.run([TOOL, "crop", R + "provas e gabaritos/" + PDF[prefix], str(page), str(x), str(y), str(w), str(h), "2.2", S + src],
                       check=True, stderr=subprocess.DEVNULL)
        images.append({"src": src, "alt": alt})
    q = {"id": qid, "source": e["source"], "area": e["area"], "subtopic": e["subtopic"],
         "stem": stem or e["stem"], "images": images or None,
         "alternatives": [{"key": a["key"], "text": f"{label} ({a['key']})" if label else a["text"]} for a in e["alternatives"]],
         "status": "confirmed", "annulled": False,
         "verification": {"gabaritoAnswer": key, "independentlyDerivedAnswer": key, "agree": True, "confidence": conf, "notes": note},
         "correctKey": key}
    apply_explanations(q, summary, explain)
    last = max(i for i, x in enumerate(qs) if x["id"].startswith(prefix + "-"))
    qs.insert(last + 1, q)

# petro08-q43: a coluna oficial diz C, e a norma aponta A. Sai do simulado até haver confirmação.
q43 = by["petro08-q43"]
qs.remove(q43)
queue["petro08-q43"] = {"id": q43["id"], "source": q43["source"], "area": q43["area"], "subtopic": q43["subtopic"], "stem": q43["stem"],
                        "images": None, "alternatives": q43["alternatives"], "gabaritoLetter": "C", "derivedLetter": "A",
                        "reviewRounds": [{"round": 1, "conclusion": "diverge do gabarito",
                                          "note": "A coluna oficial do cargo traz 43-C (direitos autorais e industriais), mas a norma trata esse conteúdo como acordos de confidencialidade e de não divulgação (A). O banco registrava A por engano de leitura."}],
                        "unresolved": True, "annulled": False}
for qid, note in KEEP_NOTES.items():
    rounds = queue[qid].setdefault("reviewRounds", [])
    rounds.append({"round": len(rounds) + 1, "conclusion": "mantida fora do simulado; gabarito externo contradiz o raciocínio",
                   "note": note + " Falta conferir no gabarito oficial da Cesgranrio."})
rdata["entries"] = list(queue.values())

# Citações no conteúdo de segurança.
for pattern in cdata["patterns"]:
    if "petro08-q43" in pattern.get("evidence", []):
        pattern["evidence"].remove("petro08-q43")
spot = cdata["patterns"][8]["howToSpot"]
for old, new in [
    ("Seis das 33 questões, todas nas provas de 2008, 2010 e 2012 (petro08-q43, petro08-q44,", "Cinco das 32 questões, todas nas provas de 2008, 2010 e 2012 (petro08-q44,"),
    ("Em petro08-q43 o instrumento que informa aos signatários suas responsabilidades sobre a informação são os 'acordos de confidencialidade e de não divulgação' (não 'normas e políticas de segurança', que é a resposta que soa mais nobre). ", ""),
    ("e o gabarito é 'ações relacionadas à melhoria dos controles' — os distratores são todos itens verdadeiros da norma, só que de outra lista: 'tendências de ameaças e vulnerabilidades' e 'estrutura existente para as atividades' são insumos de outro contexto, e 'declaração de comprometimento da direção' e 'decisões sobre alocação de recursos' são <em>saídas</em> da análise crítica, não entradas.",
     "e o gabarito é 'tendências relacionadas com as ameaças e vulnerabilidades'. Já 'ações relacionadas à melhoria dos controles' e 'decisões sobre alocação de recursos' são <em>saídas</em> da análise crítica, não entradas."),
]:
    if old not in spot:
        sys.exit(f"trecho não encontrado: {old[:50]}")
    spot = spot.replace(old, new)
cdata["patterns"][8]["howToSpot"] = spot
for old, new in [("São 33 questões desta área no banco.", "São 32 questões desta área no banco."),
                 ("responde por 17 delas", "responde por 16 delas"), ("(20 de 33)", "(19 de 32)")]:
    if old not in cdata["resumo"]:
        sys.exit(f"trecho não encontrado: {old}")
    cdata["resumo"] = cdata["resumo"].replace(old, new)

open(S + "data/questions.json", "w", encoding="utf-8").write(json.dumps(qdata, ensure_ascii=False, indent=2) + qtail)
open(S + "_internal/review-queue.json", "w", encoding="utf-8").write(json.dumps(rdata, ensure_ascii=False, indent=2) + rtail)
open(S + "data/content/seg-info.json", "w", encoding="utf-8").write(json.dumps(cdata, ensure_ascii=False, indent=2) + ctail)
print("banco", len(qs), "fila", len(rdata["entries"]), sorted(queue))
