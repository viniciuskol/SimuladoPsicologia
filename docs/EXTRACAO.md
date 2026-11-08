# Protocolo de extração e auditoria (complementa BRIEF.md)

Entrada: `provas/MANIFEST.json` e `provas/downloads/<id>/`. Leia o registro do concurso e `study/_internal/fontes.md`, que traz correções pós-recurso e anulações que NÃO aparecem no `gabarito.pdf`; essas correções prevalecem.

Saída, um arquivo por concurso (nunca edite `study/data/questions.json` diretamente; o agente principal faz a fusão):
- `study/_internal/staging/<id>.json` = `{"concurso": id, "questions": [...], "queue": [...], "fora": [...], "log": "..."}`.
  - `questions`: questões aprovadas, no schema do BRIEF. `id` = `<id do concurso>-q<número original>`. `source = {file: "<id>/prova.pdf", year, originalNumber, exam: "<rótulo humano, ex.: Petrobras 2012 – Psicólogo(a) Júnior>", org}`.
  - `queue`: `{id, motivo, gabaritoOficial, derivada, questao}` para divergência, anulada, gabarito não oficial/dúbio, figura ilegível ou transcrição incerta.
  - `fora`: questões que não se encaixam em nenhum subtópico do edital de 2026 (ex.: psicologia clínica, avaliação infantil, psicanálise pura, legislação de outro órgão). Registre `{id, tema}`; não entram no banco.
- Português e Inglês entram como áreas `portugues`/`ingles` usando os subtópicos existentes em `areas.json` (veja-os antes). Raciocínio lógico, informática, conhecimentos gerais e matérias locais vão para `fora`.

Para cada questão:
1. Transcreva fielmente o enunciado, o texto-base (`passage`, repetido em cada questão dependente) e as 5 alternativas. Corrija só hifenização e quebra de linha do PDF. Questão com 4 alternativas (provas antigas) é aceita com 4. PDF só imagem: renderize as páginas e leia.
2. Leia o gabarito na coluna/caderno de Psicologia do MANIFEST e aplique as alterações pós-recurso.
3. ANTES de olhar o gabarito, ou ignorando-o, derive a resposta pelo conteúdo. Concorda: entra com `confidence: "high"`, ou `"medium"` se o raciocínio depende de autor/teoria em que há margem. Discorda: vai para a `queue`, nunca para o banco.
4. Classifique a área e o `subtopic` com o texto EXATO de `areas.json`. Escolha pelo conteúdo cobrado, não pelo título da prova.
5. Escreva `explanationSummary` (2 a 4 frases, cite autor/norma quando houver) e `explanation` em cada alternativa errada, dizendo por que está errada; distrator que descreve um conceito vizinho deve nomear esse conceito.
6. Norma mudou desde a prova: mantenha a questão, com `verification.notes` dizendo o que mudou. Os resumos normativos estão em `docs/normas/`.
7. Figura ou tabela essencial: recorte com `tools/pdftool crop` para `study/data/figures/<id>-N.png` (escala 2.2) e use `images` + `[[fig:N]]`. Tabela simples pode virar `<table>` no enunciado.

Valide antes de terminar: JSON válido, ids únicos, `correctKey` entre as chaves, subtopic exato, contagem `questions + queue + fora` = total de questões do caderno (exceto as de blocos sem interesse que você contou em `fora`). Relate a contagem por área e o tamanho da fila.
