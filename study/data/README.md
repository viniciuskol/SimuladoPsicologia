# study/data: invariantes do banco

Dados do simulado e da área de estudo do Edital nº 04/2026 da Transpetro, Ênfase 31: Psicologia.
`python3 study/_internal/check.py` confere tudo o que está abaixo; `--strict` também falha com pendências.

## Arquivos

| Arquivo | Conteúdo | Quem escreve |
|---|---|---|
| `areas.json` | Taxonomia: 6 áreas do Anexo IV (etica, resolucoes, psi-org, diag-org, psi-social, saude-trab) mais portugues e ingles. `topics[]` é o texto exato dos subitens | fonte única |
| `questions.json` | O banco: `{version, questions[]}` | só `tools/merge.py` |
| `content/<area>.json` | Resumo, cheatsheet, padrões da banca e palavras-armadilha por área | agente de estudo |
| `flashcards.json` | `{version, cards[]}` com `{id, area, front, back, sourceQuestionId?}` | agente de estudo |
| `plan.json` | Plano de 07/11 a 06/12/2026 | agente de estudo |
| `figures/` | Recortes de figuras das provas | extração |

## Os quatro tipos de questão

Todas têm `id`, `area`, `subtopic` (texto exato de um `topics[]` da área), `stem`, `alternatives` A a E,
`correctKey`, `explanationSummary`, `status: "confirmed"` e `annulled: false`.

1. **Oficial.** Vem de prova de Psicologia da Cesgranrio, por `study/_internal/staging/<concurso>.json`.
   `source = {file, year, originalNumber, exam, org}`. Só entra com gabarito **oficial** lido na coluna certa,
   resposta derivada de forma independente e as duas iguais: `verification.gabaritoAnswer`,
   `verification.independentlyDerivedAnswer` e `correctKey` coincidem e `verification.agree` é `true`.
   Id: `<concurso>-q<número original>`, por exemplo `bndes-2024-analista-psicologia-organizacional-q37`.
   O gabarito nunca é corrigido: se a norma mudou, o app mostra aviso depois da resposta (`contentNotices`).
2. **Reaproveitada.** Questões de Português e Inglês já auditadas no projeto-base (somente leitura), cujo bloco de Conhecimentos Gerais é o mesmo desta ênfase.
   `source.reused` diz de onde vieram. `merge.py` as preserva a cada fusão e substitui todo o resto.
   Ids herdados (`psjpn2018-q9`, `transp23e6-q7`).
3. **Autoral.** Escrita sobre norma conferida em `docs/normas/`, para cobrir assunto do edital que nenhuma
   prova antiga cobra. `source = {authored: true, basis: "<norma, artigo>", year: 2026, file: "autoral"}`;
   `verification.gabaritoAnswer` é `null` e `agree` é `true` depois da revisão. Vem só de
   `docs/normas/questoes-autorais-revisadas.json`. Id: `autoral-<norma>-NN` (`autoral-r6-01`, `autoral-n5-04`).
   Nunca entra em prova histórica nem na lista de provas de origem; na prova sorteada só completa área sem
   oficial suficiente; no app leva o selo "Questão autoral"; no cálculo de prioridade pesa metade.
4. **Staging.** `study/_internal/staging/<concurso>.json` tem `questions` (aprovadas), `queue` (fila) e `fora`
   (fora do edital). É a entrada de `merge.py`, não o banco: um id em staging só existe para o app depois da fusão.

## O que não entra no banco

- **Fila de revisão** (`study/_internal/review-queue.json`, `{version, items[]}` com `id`, `concurso`, `motivo`
  e a questão): gabarito divergente da derivação, derivação incerta, questão de memória de livro que não deu para
  conferir, anulada, gabarito sem fonte oficial, ou que cobra norma revogada (as 3 da Res. CFP 02/2022 da prova
  BNDES 2024). Também recebe o que `merge.py` rejeitar, com o motivo.
- **Fora do edital** (`study/_internal/fora-do-edital.json`, `{version, items[]}` com `id`, `tema`, `concurso`):
  conhecimentos gerais de outro concurso, psicologia clínica e hospitalar, saúde pública fora do programa,
  duplicatas. Fica registrado para não ser extraído de novo.

Nenhum id da fila ou de fora do edital pode aparecer em `content/`, `flashcards.json` ou `plan.json`.

## Regras dos dados de estudo

- `content/<area>.json`: `areaId`, `resumo`, `cheatsheet[{heading, items}]`, `patterns[{title, body, evidence}]` e,
  opcionalmente, `mentalModels`, `tactics`, `trapWords`, `resources`. HTML só com as tags de `ALLOW` em `check.py`
  (`p ul ol li strong em code table tr th td br`), sem atributo de evento nem script. `evidence` só tem ids
  do banco da **mesma área**; qualquer id citado no texto tem de existir no banco. Número de questões citado
  no resumo é contagem do banco, dita como indicador histórico, nunca como previsão da prova.
- `flashcards.json`: id `fc-<area>-NNN`, sem HTML (o app escapa o texto), `sourceQuestionId` só quando o card
  nasce de uma questão do banco da mesma área. Os 89 cards de Português e Inglês vêm do projeto-base.
- `plan.json`: chaves `version, examDate, sourceNote, crossPatterns, examDay, blocks`; `examDate` "2026-12-06";
  cada bloco com `weeks` no formato `(dd/mm a dd/mm)` e o último terminando no dia da prova; `crossPatterns` com
  evidência de pelo menos 2 áreas; sem HTML. A primeira prova completa fica no bloco que contém 14/11, porque
  `fullExamAdvice` (`shared/planner.js`) a libera 22 dias antes da prova, e a segunda pelo menos 4 dias depois.
- Normas: só o que está verificado em `docs/normas/`, com artigo ou item. O que foi lido em reprodução de terceiro
  ou não foi verificado é dito como tal no texto.

## Figuras

`images: [{src, alt, minWidth?}]` com `src` relativo a `study/` (`data/figures/<id>-N.png`) e o marcador
`[[fig:N]]` no `stem`, na ordem da prova. Cada marcador tem a sua imagem e vice-versa.
