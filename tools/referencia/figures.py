#!/usr/bin/env python3
"""Recorta as figuras dos PDFs, restaura enunciados originais e grava em questions.json."""
import json, os, re, subprocess, sys

SP = os.path.dirname(os.path.abspath(__file__))
R = "/Users/viniciusferreira/Concurso Transpetro/SimuladoConcurso/"
QF = R + "study/data/questions.json"
OUT = R + "study/data/figures/"
TOOL = SP + "/pdftool"
SCALE = "2.2"
PDF = {
    "prova6": "prova_6_analista_de_sistemas_junior_processos_de_negocio.pdf",
    "prova07": "tarde_prova_07_analista_de_sistemas_junior_processos_de_negocio.pdf",
    "transp15": "cesgranrio-2018-transpetro-analista-de-sistemas-junior-processos-de-negocio-prova.pdf",
    "transp23e6": "cesgranrio-2023-transpetro-profissional-transpetro-de-nivel-superior-junior-enfase-6-processos-de-negocios-prova.pdf",
    "psjpn2018": "analista_de_sistemas_junior_processos_de_negocio2018.pdf",
    "petro2012": "cesgranrio-2012-petrobras-analista-de-sistemas-junior-processos-de-negocios-2012-prova.pdf",
    "petro08": "petrobras0208_gabsup_gabarito.pdf",
}
F = "[[fig:{}]]"

# id: (recortes [(página, x, y, l, a, alt)], enunciado ou função sobre o enunciado atual, rótulo das alternativas)
S = {
 "prova6-q23": ([(7, 72, 445, 465, 127, "Rede do cronograma: Comunicação 20 dias, início no dia 1; Planejamento 20; Modelagem 30; depois Construção 60 e Documentação 45 em paralelo; Implantação 10, término no dia 200.")],
   "O planejamento inicial para um projeto de desenvolvimento de software gerou a rede do cronograma apenas com a data de início mais cedo da primeira atividade e término mais tarde da última atividade determinadas, conforme apresentado a seguir.\n\n[[fig:1]]\n\nConsiderando o uso do Método do Caminho Crítico, analise as afirmativas abaixo.\n\nI - A data mais cedo que o projeto pode terminar é no dia 141.\nII - Caso a previsão para a fase de construção mude para 90 dias, a data limite para a fase de modelagem começar, sem atrasar, é o dia 70.\nIII - A folga total na atividade de documentação é de 75 dias.\n\nÉ correto APENAS o que se afirma em", None),
 "prova6-q46": ([(12, 305, 553, 265, 106, "Tabela de utilização por recurso: Roldana 3, 11, 2 e 19,05%; Broca 15, 1, 10 e 30,95%; Cunha 9, 8, 0 e 50,00%, nas colunas Junho, Julho, Agosto e Percentual trimestral.")],
   "Em data warehouses, medidas servem para quantificar os dados dos fatos que compõem a sua base de dados.\n\nConsidere a tabela de dados abaixo.\n\n[[fig:1]]\n\nDas medidas apresentadas, quantas delas podem ser consideradas não aditivas?", None),
 "prova6-q52": ([(14, 25, 84, 270, 58, "Classes C1 e C2 ligadas por um diamante preenchido do lado de C1, com multiplicidade 0..* do lado de C2.")],
   "[[fig:1]]\n\nO esboço de diagrama de classes ilustrado na figura, usando a notação proposta pela linguagem UML, apresenta duas classes C1 e C2, relacionadas por", None),
 "psjpn2018-q21": ([(8, 50, 198, 212, 145, "Tabela de atividades: S sem predecessor, duração 4; T depois de S, 5; V depois de S, 2; W depois de T, 6; X depois de V, 7; Y depois de S, 10; Z depois de W, X, Y, 2.")],
   "Um projeto simples de desenvolvimento de software foi modelado em 8 atividades. Cada atividade foi identificada com uma letra. A seguir, foram determinados os predecessores de cada atividade e ainda a duração prevista de cada uma. O projeto pode ser descrito pela seguinte Tabela:\n\n[[fig:1]]\n\nQual é o caminho crítico do projeto?", None),
 "psjpn2018-q54": ([(13, 308, 282, 262, 140, "Tabela com 10 transações e a indicação de sim ou não para leite, café, pão e manteiga.")],
   lambda s: "Considere o conjunto de dados a seguir, obtido a partir de uma base de dados de transações ocorridas em uma padaria, em uma determinada faixa de tempo. Nesse conjunto, indica-se a ocorrência de um determinado produto em cada transação.\n\n[[fig:1]]\n\n" + s[s.index("Em mineração"):], None),
 "psjpn2018-q56": ([(14, 113, 143, 362, 205, "Modelo conceitual: Álbum contém Cromo, com cardinalidades (1,1) e (0,n); Cromo possui Fabricação, com (1,1) e (0,n).")],
   lambda s: "Uma empresa que comercializa álbuns de figurinhas (cromos) possui um banco de dados para controlar a fabricação de cromos. O modelo conceitual desse banco de dados é exibido na Figura a seguir.\n\n[[fig:1]]\n\nO modelo conceitual acima deu origem às seguintes Tabelas:\n\n" + s[s.index("CREATE TABLE ALBUM"):], None),
 "prova07-q1": ([(3, 215, 174, 145, 170, "Relação R1 com sno e pno: (1,1), (1,2), (1,3), (1,4), (2,1), (2,2), (3,2), (4,2), (4,4). Relação R2 com pno: 1 e 2.")],
   "Considere as instâncias de relações R1 e R2 apresentadas abaixo. O cabeçalho em cada uma dessas instâncias de relações apresenta os respectivos nomes das colunas.\n\n[[fig:1]]\n\nNo contexto da Álgebra Relacional, o resultado da divisão relacional de R1 por R2 é", None),
 "prova07-q2": ([(3, 215, 174, 145, 170, "Relação R1 com sno e pno: (1,1), (1,2), (1,3), (1,4), (2,1), (2,2), (3,2), (4,2), (4,4). Relação R2 com pno: 1 e 2.")],
   lambda s: "[[fig:1]]\n\n" + s, None),
 "prova07-q6": ([(4, 308, 216, 255, 118, "Diagrama de classes: Representante trabalha em Empresa (1..* e 1); Empresa usa Depósito (1 e 1); Depósito armazena Produto (0..* e 0..*).")],
   "Um modelador de banco de dados foi incumbido de criar um modelo conceitual para a situação a seguir.\n\"Representantes trabalham em empresas. Cada empresa usa o seu depósito particular, que armazena um conjunto de produtos. É preciso saber que representantes estão associados a que produtos\".\nDurante a modelagem inicial dessa situação, o modelador construiu o modelo conceitual abaixo, utilizando a notação do diagrama de classes da UML 2.0.\n\n[[fig:1]]\n\nNesse contexto, analise as afirmações a seguir.\n\nA consulta \"Que representantes estão associados a que produtos\" é respondida pelo modelo conceitual apresentado.\n\nPORQUE\n\nA determinação de quais depósitos armazenam quais produtos pode ser respondida pelo modelo conceitual apresentado.\n\nA esse respeito, conclui-se que", None),
 "prova07-q14": ([(6, 108, 487, 398, 118, "Tabela de atividades com responsável, duração e precedentes: 1, 10 dias; 2, 8; 3, 3, depois de 1; 4, 5, depois de 2 e 3; 5, 4, depois de 3; 6, 6, depois de 4; 7, 4, depois de 5; 8, 5, depois de 6 e 7.")],
   "[[fig:1]]\n\nA tabela acima apresenta um projeto com suas atividades, cada atividade com seu respectivo recurso alocado, duração e precedências. Para efeito de controle de projeto, algumas questões precisaram ser respondidas.\n\nI - Se o projeto começou dia 01/03/2010 (segunda-feira) e foi determinado que se trabalhou aos sábados e feriados em horário normal, mas não se trabalhou aos domingos, em qual dia ele terminou?\nII - Qual atividade pertenceu ao caminho crítico?\nIII - Caso as atividades 5 e 6 tivessem aumentado sua duração cada uma em mais 2 dias, de quantos dias seria acrescido o tempo total do projeto?\n\nA opção contendo as respectivas respostas corretas é", None),
 "prova07-q19": ([(8, 78, 124, 435, 192, "Planilha com 11 tarefas: esforço estimado, esforço atual, data estimada e data atual de término."), (8, 65, 402, 440, 172, "Tabela com 5 linhas de indicadores: dia, custo orçado do trabalho agendado e realizado, custo real, variação do cronograma e índice de performance.")],
   "[[fig:1]]\n\nDada a planilha acima, que reflete o trabalho do projeto X da Empresa J.J. Jameson, produziu-se a tabela abaixo com os indicadores de desempenho em relação aos dias especificados.\n\n[[fig:2]]\n\nAnalisando os dados da tabela em relação aos da planilha, conclui-se que as duas linhas que estão com todos os valores corretos são as linhas", None),
 "prova07-q50": ([(17, 304, 325, 262, 162, "Diagrama de classes com a interface V, as classes T, Y, Z e W, a interface X fornecida por Y, e a dependência create de Y para Z.")],
   "[[fig:1]]\n\nA análise do diagrama de classes em notação UML 2.0 apresentado acima indica que", None),
 "prova07-q52": ([(18, 88, 108, 422, 305, "Diagrama de sequência entre Actor0, C1, C2, C3 e C4, com msg00, msg01 e um fragmento alt: se val maior que 0, msg02 para C3 e autochamada msg03; se val menor que 0, msg04 para C4.")],
   "[[fig:1]]\n\nO diagrama de sequência em notação UML 2.0 acima apresenta uma interação entre objetos das classes C1, C2, C3 e C4. Ao fazer a leitura considerando apenas as informações desse diagrama, verifica-se que, para determinado cenário da interação em questão,", None),
 "transp15-q30": ([(7, 308, 122, 262, 98, "Contagem por complexidade baixa, média e alta: Entrada Externa 2, 1, 1; Saída Externa 1, 4, 1; Consulta Externa 0, 0, 0; Arquivo de Interface Externa 0, 0, 1; Arquivo Lógico Interno 2, 2, 2.")],
   "Um pequeno sistema passou por um processo de contagem de pontos de função, resultando na Tabela abaixo.\n\n[[fig:1]]\n\nQuantos pontos de função não ajustados tem tal sistema?", None),
 "transp15-q38": ([(9, 25, 82, 545, 495, "Comandos CREATE TABLE de FORNECEDOR, MATERIAL e VENDA. Um fornecedor pode vender muitos materiais, e um material pode ser vendido por vários fornecedores.")],
   "[[fig:1]]\n\nConsiderando as Tabelas e as informações dadas, qual consulta exibe o número de identificação e o nome dos fornecedores que realizaram pelo menos uma venda entre os dias 05/01/2018 (inclusive) e 10/01/2018 (inclusive)?", None),
 "transp15-q41": ([(15, 170, 112, 258, 55, "Modelo E-R: E1, com (0,1), ligada pela relação R a E2, com (1,N)."), (15, 25, 208, 510, 522, "Cinco diagramas de Venn, de A a E, com setas de a1 a a4 em E1 para b1 a b4 em E2.")],
   "A Figura a seguir exibe um modelo E-R composto por duas entidades e uma relação.\n\n[[fig:1]]\n\nQual diagrama de Venn contém uma relação que atende às regras de multiplicidade definidas no modelo E-R acima?\n\n[[fig:2]]", "Diagrama"),
 "transp15-q42": ([(16, 25, 265, 265, 492, "Esquemas A, B e C, com tabelas, chaves primárias sublinhadas e dependências funcionais."), (16, 308, 72, 258, 280, "Esquemas D e E, com tabelas, chaves primárias sublinhadas e dependências funcionais.")],
   "Considere a seguinte notação para especificar componentes de esquemas relacionais:\n\n• Tabelas são descritas por um nome e uma lista de colunas, separadas por vírgulas.\n• Colunas que participam da chave primária estão sublinhadas.\n• Dependências funcionais entre colunas são definidas pelo símbolo (→) e exibidas em seguida à definição das tabelas.\n\nTodos os esquemas atendem à 1FN.\n\nDos esquemas a seguir, o único que se encontra na 3FN é\n\n[[fig:1]]\n\n[[fig:2]]", "Esquema"),
 "transp23e6-q21": ([(6, 25, 250, 545, 522, "Cinco diagramas E-R, de A a E, com as entidades A, B e C e as relações R e S, variando as cardinalidades.")],
   "Os conjuntos a seguir representam o estado de um banco de dados relacional.\n\nA = { a1, a2, a3 }\nB = { b1, b2 }\nC = { c1, c2, c3 }\nR = { (a1, b1), (a1, b2), (a2, b1), (a2, b2), (a3, b1) }\nS = { (b1, c2), (b2, c3) }\n\nAdmita que os elementos dos conjuntos acima sejam instâncias das entidades ou das relações de mesmo nome presentes no diagrama E-R a partir do qual o esquema do banco de dados acima foi obtido, e que as regras definidas nesse diagrama E-R são preservadas pelo banco de dados em questão.\n\nNesse contexto, qual diagrama E-R tem suas regras preservadas pelo banco de dados acima?\n\n[[fig:1]]", "Diagrama"),
 "transp23e6-q22": ([(7, 25, 205, 265, 475, "Diagramas A e B: A é a cadeia B, A, D com especializações parciais e exclusivas; B é D com subtipos A e B, total e compartilhada."), (8, 25, 70, 265, 690, "Diagramas C, D e E: C é D com subtipos A e B, parcial e exclusiva; D é o mesmo, total e exclusiva; E é a cadeia D, A, B, parciais e exclusivas.")],
   "Sejam A, B e D conjuntos não vazios, diferentes entre si e que atendam às seguintes propriedades:\n\n1. A ⊂ D\n2. B ⊂ D\n3. B ∩ A ≠ ∅\n4. B ∪ A ≠ D\n\nAdmita, ainda, que esses conjuntos correspondam às entidades de mesmo nome de um diagrama Entidade-Relacionamento (E-R).\nQual diagrama E-R satisfaz todas as propriedades apresentadas?\n\n[[fig:1]]\n\n[[fig:2]]", "Diagrama"),
 "transp23e6-q49": ([(15, 25, 260, 145, 212, "Tabela Familia com Pai e Filho: Andre, Carlos; Andre, Claudio; Bruno, Diego; Bruno, Daniel; Carlos, Eriko; Carlos, Fabio; Daniel, Gustavo; Diego, Heleno; Eriko, Isidoro; Fabio, João.")],
   "Considere a tabela Familia, apresentada abaixo, que possui as colunas Pai e Filho e uma instância exemplo que permite ilustrar as informações contidas nessa tabela.\n\n[[fig:1]]\n\nUma consulta SQL feita para exibir os nomes dos netos de Carlos retorna os nomes Isidoro e João.\nA expressão, em linguagem SQL, dessa consulta é", None),
 "petro2012-q31": ([(8, 308, 90, 258, 176, "Gráfico de nível ao longo do tempo de projeto: a curva Q começa alta e cai; a curva P começa baixa e sobe.")],
   "[[fig:1]]\n\nConsiderando o ciclo de vida de um projeto, as curvas Q e P do gráfico apresentado podem representar, respectivamente, as tendências do(a)", None),
 "petro2012-q35": ([(9, 85, 250, 420, 148, "Gráfico de Gantt de 7 meses com as barras V, W, Y, X, Z, F, G, I, H e J e setas de dependência.")],
   "Um gráfico de Gantt é uma ferramenta que pode auxiliar a determinar o caminho crítico de um projeto e as folgas de suas atividades. Um gerente iniciante apresentou o gráfico de Gantt de seu projeto.\n\n[[fig:1]]\n\nQual é o erro que esse diagrama possui?", None),
 "petro2012-q36": ([(9, 95, 537, 405, 138, "Rede: Início leva a A (2 meses), B (2) e C (1); A vai a F (2); B vai a D (2); D vai a F e a E (5); C vai a E; F vai a G (1); G e E vão a Fim.")],
   "Seja o diagrama de redes de um projeto, no qual foi especificada a duração de cada tarefa.\n\n[[fig:1]]\n\nQual é a duração, em meses, do caminho crítico desse projeto?", None),
 "petro2012-q41": ([(10, 308, 333, 262, 72, "Mapeamento por tipo e ano: poço 35, 49, 64; fonte 7, 12, 32; reserva 21, 21, 45, em 2009, 2010 e 2011."), (10, 308, 447, 250, 64, "Resultado: Todos os tipos 63, 82 e 141, em 2009, 2010 e 2011.")],
   "[[fig:1]]\n\nPartindo-se da tabela de fato, realizou-se uma operação OLAP que obteve o seguinte resultado:\n\n[[fig:2]]\n\nAnalisando-se esse resultado, infere-se que a operação realizada foi", None),
 "petro2012-q50": ([(11, 308, 578, 262, 70, "Tabela de fato por tipo e ano: poço 35, 49, 64; fonte 7, 12, 32; reserva 21, 21, 45, nos anos A, A+1 e A+2.")],
   "No contexto de modelagem multidimensional, considere a seguinte tabela de fato (fact table):\n\n[[fig:1]]\n\nAcrescentando a dimensão localidade, com os membros Sudeste e Nordeste, o número de dados numéricos esperado da tabela de fatos resultante será", None),
 "petro2012-q62": ([(13, 308, 302, 258, 222, "Relação Cidade com nome e estado, em 9 linhas, seguida da operação de projeção de nome sobre a seleção de estado maior que R.")],
   "Considere a relação chamada Cidade a seguir:\n\n[[fig:1]]\n\nQuantas tuplas e atributos terá a relação resultante após a execução dessa operação?", None),
 "petro2012-q69": ([(14, 372, 230, 132, 82, "Tabela-verdade com as colunas p, q, não p e não p implica q; p e q preenchidas com VV, VF, FV e FF, e as demais vazias.")],
   "Seja a tabela verdade a seguir.\n\n[[fig:1]]\n\nQuantas vezes, sem considerar os valores já preenchidos, o valor F aparece ao se completar essa tabela?", None),
 "petro08-q23": ([(7, 25, 205, 545, 215, "Tabelas CLIENTE, PRODUTO e VENDA com seus campos e chaves, e as regras de chaves estrangeiras e candidatas.")],
   lambda s: "[[fig:1]]\n\n" + s, None),
 "petro08-q30": ([(9, 25, 85, 265, 340, "Dois modelos E-R. Antes: FUNCIONARIO com NOME e EMAIL; USUARIO com NOME, EMAIL e LOGIN. Depois: FUNCIONARIO com NOME e EMAIL; USUARIO com LOGIN e herdando de FUNCIONARIO.")],
   "[[fig:1]]\n\nUm modelo entidade-relacionamento foi reestruturado conforme mostrado na figura acima. Concluiu-se que todos os usuários eram funcionários, embora nem todos os funcionários fossem usuários. O modelo relacional derivado desse modelo conceitual possuía originalmente duas variáveis de relação básicas, com os mesmos nomes das entidades correspondentes, tendo ambas EMAIL como chave primária. Considerando que a variável de relação FUNCIONARIO não será modificada e que a independência de dados lógica será honrada, a variável de relação USUARIO", None),
}

raw = open(QF, encoding="utf-8").read()
data = json.loads(raw)
by = {q["id"]: q for q in data["questions"]}

missing = [i for i in S if i not in by]
if missing:
    sys.exit(f"questões fora do banco: {missing}")

# 1) Recortes
os.makedirs(OUT, exist_ok=True)
total = 0
for qid, (crops, _, _) in S.items():
    pdf = R + "provas e gabaritos/" + PDF[qid.split("-")[0]]
    for n, (page, x, y, w, h, _) in enumerate(crops, 1):
        path = f"{OUT}{qid}-{n}.png"
        subprocess.run([TOOL, "crop", pdf, str(page), str(x), str(y), str(w), str(h), SCALE, path],
                       check=True, stderr=subprocess.DEVNULL)
        total += os.path.getsize(path)
print(f"{sum(len(c[0]) for c in S.values())} recortes, {total // 1024} KB")

# 2) Enunciados e alternativas
for qid, (crops, stem, label) in S.items():
    q = by[qid]
    q["stem"] = stem(q["stem"]) if callable(stem) else stem
    q["images"] = [{"src": f"data/figures/{qid}-{n}.png", "alt": c[5]} for n, c in enumerate(crops, 1)]
    if label:
        for a in q["alternatives"]:
            a["text"] = f"{label} ({a['key']})"
    markers = {int(m) for m in re.findall(r"\[\[fig:(\d+)\]\]", q["stem"])}
    if markers != set(range(1, len(crops) + 1)):
        sys.exit(f"{qid}: marcadores {markers} x {len(crops)} figuras")

# prova07-q22 tem as alternativas repetidas no enunciado, sem figura.
s22 = by["prova07-q22"]["stem"]
if "(A)" in s22:
    by["prova07-q22"]["stem"] = s22[:s22.index("(A)")].rstrip()

json_text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
if "--write" in sys.argv:
    open(QF, "w", encoding="utf-8").write(json_text)
    print("gravado")
