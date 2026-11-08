# Simulado de Psicologia: Transpetro 2026

Estudo e simulado para o Edital nº 04/2026 da Transpetro (Cesgranrio), nível superior, Ênfase 31: Psicologia. A prova objetiva é em 06/12/2026, com 70 questões em 4h30.

## Como abrir

Não há etapa de build. Sirva a pasta `study/` e abra no navegador:

```sh
python3 -m http.server 8766 --directory study
```

- Simulado: <http://localhost:8766/simulado.html>
- Estudo: <http://localhost:8766/estudo.html>

Aberto com duplo-clique (`file://`) não funciona, porque o navegador bloqueia a leitura dos JSON. O progresso fica no `localStorage` do navegador, com chaves `transpetro2026-psi:*`, e a tela de estudo faz backup e restauração.

## O simulado

- **Prova sorteada:** 10 de Português, 10 de Inglês e 50 específicas, priorizando o que você respondeu menos. A divisão das específicas por área é uma estimativa pelo banco, não uma previsão: o edital não a informa.
- **Banco insuficiente:** a tela informa quantas questões faltam por bloco e o botão passa a dizer "prova parcial". Sem questões de um bloco, o critério de eliminação não é calculado.
- **Prova histórica:** uma prova de Psicologia do banco, na ordem original. Mostra os números que ficaram de fora.
- **Treino:** correção imediata, com filtros por área, assunto e origem.
- **Também há:** retomada de sessão, critério de eliminação (subitem 7.1.4.3), refazer erros e ampliação de figuras.
- **Links:** `simulado.html?q=id,id`, `?refazer=1&area=x&n=10`, `?area=x&sub=assunto&n=10` e `?area=x&n=10`.

### Questões autorais

Têm `source.authored: true` e `source.basis` (norma e artigo). Elas nunca entram em prova histórica nem na lista de provas de origem. No treino, aparecem com o selo "Questão autoral", que também é mostrado no resultado. Na prova sorteada, entram só como complemento:

1. Cada área com questão no banco recebe até 3 questões, oficiais primeiro. Só aqui uma área sem oficial suficiente usa autoral.
2. O restante vai para questões oficiais, na proporção do banco.
3. Se as oficiais acabarem, autorais completam o que faltar.

### Avisos de norma

`contentNotices` (`study/shared/planner.js`) mostra um aviso depois da resposta quando uma questão oficial é anterior à norma vigente. O gabarito continua o oficial. Só há aviso para o que foi conferido em 05/11/2026:

| Aviso | Fonte conferida |
|---|---|
| Res. CFP 07/2003 revogada pela 06/2019 | [Notícia do CFP](https://site.cfp.org.br/cfp-publica-nova-resolucao-sobre-elaboracao-de-documentos-escritos/) (via busca) |
| Res. CFP 02/2003 revogada pela 09/2018 | [CFP](https://site.cfp.org.br/nova-resolucao-sobre-avaliacao-psicologica/) |
| Res. CFP 09/2018 revogada pela 31/2022 | [CFP](https://site.cfp.org.br/nova-resolucao-do-cfp-destaca-diretrizes-para-a-avaliacao-psicologica/) |
| Res. CFP 11/2018 revogada pela 09/2024 (art. 9º) | [Texto no LegisWeb](https://www.legisweb.com.br/legislacao/?id=462577) |
| CIPA depois da Lei 14.457/2022 (arts. 23 e 32) | [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14457.htm) |
| NR-1 e fatores de risco psicossociais (Portaria MTE 1.419/2024, vigência em 26/05/2026 pela Portaria 765/2025) | [Ministério do Trabalho e Emprego](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/maio/mte-publica-guia-de-perguntas-e-respostas-para-orientar-empresas-sobre-mudancas-da-nr-1) (via busca) |
| CID-11 em vigor na OMS desde 2022 | [OMS](https://www.who.int/news/item/11-02-2022-icd-11-2022-release) |
| Adoção gradual da CID-11 no Brasil | Só fontes secundárias, que citam a Nota Técnica 91/2024; o aviso não dá data |
| DSM-5-TR como edição atual | [APA](https://www.psychiatry.org/psychiatrists/practice/dsm) |

## Estrutura

```
study/
  simulado.html, estudo.html   as duas telas
  shared/                      exam.js (prova e correção), planner.js (prioridade e avisos),
                               storage.js, figures.js, data-loader.js, styles.css
  data/                        questions.json, areas.json, flashcards.json, plan.json, content/, figures/
  _internal/                   check.py, build-standalone.py, review-queue.json, fontes.md
tests/                         testes de exam, planner e storage
docs/                          BRIEF.md e normas/
edital/                        edital em PDF e em texto
provas/                        provas e gabaritos baixados
tools/                         extração de texto e recorte de PDF
```

## Verificação

```sh
tests/run.sh                         # testes (Node 22); copia study/shared/*.js como .mjs para um temporário
python3 study/_internal/check.py     # invariantes do banco e relatório por área
python3 study/_internal/check.py --strict   # também falha com dados ainda pendentes
python3 study/_internal/build-standalone.py saida.html   # estudo.html em arquivo único
```

`check.py` separa PROBLEMAS (dado errado, sai com 1) de PENDÊNCIAS (dado que ainda falta).

## Origem dos dados

- **Programa e regras:** `edital/edital.txt`, Anexo IV, Ênfase 31.
- **Questões:** só entra questão com gabarito oficial e resposta derivada de forma independente que concorde com ele. Divergências, anuladas e gabaritos sem fonte oficial vão para `study/_internal/review-queue.json`, com o motivo.
- **Português e Inglês:** as questões com `source.reused` vêm de provas de outras áreas, porque o bloco de Conhecimentos Gerais é comum. Por isso ficam fora da prova histórica.
- **Normas:** conferidas no texto oficial vigente, em `docs/normas/`.

`.github/workflows/deploy-pages.yml` publica `study/` no GitHub Pages a cada push em `main`.

## Arquivos que não vão para o repositório
- `provas/downloads/`: os PDFs das provas e gabaritos ficam só na máquina local. `provas/MANIFEST.json` e `study/_internal/fontes.md` trazem as URLs de origem de cada um.
- `tools/pdftool`, `pdftext`, `pdflines` e `scan`: binários para macOS, gerados a partir do `.swift` de mesmo nome com `swiftc tools/<nome>.swift -o tools/<nome>`.
