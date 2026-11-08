# Fontes de provas de Psicologia (Cesgranrio)

Levantamento feito em 05/11/2026 pelo agente de Provas. O inventário completo está em `provas/MANIFEST.json`, com 24 concursos, e os arquivos ficam em `provas/downloads/<id>/`.
Todo PDF aceito passou por estas checagens: `file`, que confirma PDF real; `tools/pdftext`, que confere texto, cargo, a menção à Cesgranrio e o número de questões; e a renderização da página do gabarito com a coluna de Psicologia, lida visualmente (`tools/pdftool page` e, nas páginas rotacionadas, `qlmanage -t`).

Observação sobre ferramenta: `tools/pdftext` exige dois argumentos (`pdftext <pdf> <saida.txt>`). Com um só, sai em silêncio sem gerar texto.

## 1. Transpetro: nenhuma prova de Psicologia encontrada (conclusão verificada)

A Transpetro **nunca aplicou prova de Psicologia pela Cesgranrio** nas edições localizadas. A Ênfase 31 do edital de 2026 é a primeira. Evidências:

| Edição | Evidência | Resultado |
|---|---|---|
| 2006 (`petro0106`, `transpetro0206`) | gabaritos oficiais de nível superior (Wayback) | sem cargo de psicologia; há Assistente Social |
| 2008 (`transpetro0208`) | gabarito superior oficial (Wayback) | sem psicologia |
| 2011 (`transpetro0311`) | gabarito e gabarito final oficiais | sem psicologia |
| 2012 (`transpetro0212`) | gabarito final oficial | sem psicologia |
| 2018 (`transpetro0118`) | edital e gabarito superior oficial, 12 páginas | sem psicologia |
| 2023 (PSP-RH-2023, Edital 2 nível superior) | edital (28 ênfases, só Pedagogia e Serviço Social na área humana); portal oficial `transpetro.cesgranrio.org.br`, evento 12: `api/PortalGruposProva/todos/12` não contém "psicolog", e a seção "Provas - TRANSPETRO/PSP/TERRA/NÍVELSUPERIOR-2023.2" lista 28 provas | sem psicologia |
| catálogo PCI `/provas/transpetro` (223 arquivos, 2006–2023) | nomes dos arquivos | nenhum "psic" |

Na Petrobras, o último concurso com Psicologia foi o de 2012 (PSP-RH-1/2012). Os gabaritos de nível superior de 2011, 2014, 2015, 2017 e 2018 não têm a coluna. Não houve Petrobras/Cesgranrio com Psicologia entre 2013 e 2024. O concurso Petrobras 2021 (Cebraspe) está fora do escopo.

## 2. Encontrado (24 concursos; ver MANIFEST)

| Organização | Concursos |
|---|---|
| Petrobras | 2005, 2008, 2010 (28/03), 2010 (16/05), 2012 |
| Petrobras Distribuidora (BR) | 2015 (PSP 1/2014; PCI e Estude Grátis rotulam como "Petrobras") |
| REFAP (Sistema Petrobras) | 2007 |
| BNDES | 2009, 2013, 2024 (Psicologia Organizacional) |
| Outros | UNIRIO 2016 e 2019; UNEMAT 2024; CEFET-RJ 2014; Casa da Moeda 2005; Prefeitura de Salvador/SEPLAG 2011; SEAD-AM 2005; SECAD-TO 2004 e 2009 (Psicólogo e Psico-oncologista); AL-TO 2005 (Consultor Legislativo, Psicologia); MPE-RO 2005; SEE-SP 2009 (PEB II Psicologia, professor, baixa aderência); TJ-RO 2008 (só gabarito) |

Todos têm gabarito no formato oficial da banca ou do órgão. A origem de cada um está no campo `origemGabarito`: arquivo oficial via Wayback, portal oficial ou cópia de terceiro com timbre oficial. Em BNDES 2024 e UNEMAT 2024, os arquivos de terceiros são **byte-idênticos** (mesmo MD5) aos do portal oficial.

### Correções pós-recurso que a extração precisa aplicar (não estão no gabarito.pdf)
- Petrobras 2008: questão 29 anulada (`recursos.pdf`, oficial).
- Petrobras 2010 (16/05): questão 6 anulada e questão 31 passa a ser E (`recursos.pdf`, oficial; o gabarito traz 31-B).
- Petrobras 2012: **divergência na questão 40**. O gabarito oficial (Wayback, 2018) traz E; a cópia do Estude Grátis, com marcas de anulação, traz D. Mandar para a fila de revisão.
- SEPLAG Salvador 2011: questão 42 passa a ser B e questão 45 passa a ser C.
- SECAD-TO 2009 (Psicólogo): questões 41 e 48 anuladas; o gabarito já marca as duas.
- Gabaritos já marcados como pós-recurso: BR 2015 ("ALTERADO EM 25/03/2015"), BNDES 2024 ("GABARITO FINAL – APÓS AVALIAÇÃO DOS RECURSOS"), UNIRIO 2016 (gabarito-definitivo), UNIRIO 2019, UNEMAT 2024, CEFET-RJ 2014.

## 3. Fontes usadas e como

1. **Cesgranrio, site atual** (`www.cesgranrio.org.br/concursos`, WordPress): só lista concursos recentes, e as páginas apontam para portais em SPA. `wp-json/wp/v2/media?search=` retornou 0.
2. **Portais Cesgranrio (SPA Angular), recuperados com navegador**, conforme autorização do usuário. O browser do app revelou as chamadas públicas que a página faz sem login: `api/PortalEventos`, `api/PortalEventoConteudos/publico/<id>` e `api/PortalGruposProva/todos/<id>`. Os PDFs vêm de links públicos com token SAS embutido na própria página. Os eventos públicos de `concursos.cesgranrio.org.br` são 16, e só três têm Psicologia:
   - evento 14, BNDES 01/2024: prova 13 (objetiva), prova 26 (discursiva), gabarito preliminar, gabarito final e respostas aos recursos, todos baixados.
   - evento 7, UNEMAT 01/2023: prova 7 (Psicólogo), gabarito preliminar e final, baixados.
   - evento 21, SEMA-MT 2026 (Perfil 7, Psicologia) e evento 22, Transpetro 2026: ainda sem provas.
   - Sem Psicologia: CMB 01/2023, IPEA, BASA, BNB, CEF 2024/2025, CPNU, Banese, Fundação Osório, PC-AP, SAEB/EPPGG, IBGE 03/2026.
   - `transpetro.cesgranrio.org.br`, evento 12 (PSP-RH-2023): sem Psicologia (ver seção 1).
3. **Wayback Machine (web.archive.org)**, com o índice CDX dos domínios `cesgranrio.org.br`. É a principal fonte dos arquivos oficiais antigos: `eventos/concursos/<código>/...` e `pdf/<código>/...`. Códigos usados: petrobras0105, petrobras0208 (prova55), petrobras0109 (PROVA 24), petrobras0110 (TARDE - PROVA 19), petrobras0112, refap0107, bndes0109 (PROVA 7 - PSICOLOGIA), seplag0111 (prova 54), mpro4904, unirio0116, seesp0109, tjro0108. A página `*_provas.html` de cada concurso deu o número da prova de Psicologia.
4. **Estude Grátis** (`estudegratis.com.br/images/provas/<id>-<slug>-{prova,gabarito}.pdf`): PDFs abertos, sem login.
5. **Qconcursos**: a página pública `/questoes-de-concursos/provas/<slug>` traz links abertos para `arquivos.qconcursos.com`. Funcionou para BNDES 2009, 2013 e 2024, UNIRIO 2016 e 2019 e UNEMAT 2024. O arquivo da Casa da Moeda 2005 (id 5033) devolve 403.
6. **Aprova Concursos** (`/questoes-de-concurso/prova/<slug>`, links abertos para `s3-improved-files-sec1.iesde.com.br/resolucaoq/prova/{prova,gabarito,alteracao_gabarito}/<n>.pdf`): recuperou a Casa da Moeda 2005 e as "alterações de gabarito" (respostas aos recursos) de SECAD-TO 2009, CEFET-RJ 2014 e Petrobras 2010 (igual ao oficial), além do gabarito completo da Petrobras 2005.
7. **PCI Concursos**: **bloqueado por Cloudflare Turnstile** na página de cada prova ("Complete a verificação abaixo para acessar os arquivos"). Não houve tentativa de contornar o bloqueio. Usado só como **catálogo**: as listagens `/provas/psicologo` (97 páginas, 4.274 arquivos), `/provas/cesgranrio` (55 páginas, 2.718 arquivos), `/provas/transpetro`, `/provas/petrobras` e órgãos do grupo dão os 29 itens Cesgranrio com "psic" no nome.
8. **WebSearch**, em três rodadas: (1) "prova Transpetro Psicólogo Cesgranrio", "Petrobras Psicólogo Júnior"; (2) "Profissional Júnior Psicologia", "Transpetro 2023 ênfases", "Petrobras 2023/2024 ênfases", "BNDES 2024 Psicologia Organizacional", "UNEMAT 2024", "UNIRIO 2019", "BNDES 2013"; (3) "Liquigás/Petroquisa/Termoaçu/EPE/Finep/Eletronuclear psicologia", "Psicólogo Júnior Petrobras 2008", "Eletronuclear/UNIRIO/Casa da Moeda/BB 2022-2025".

## 4. Rejeitado e apagado
- `tj-ro-2008-psicologo/prova.pdf` (Estude Grátis, id 8419; Qconcursos id 554 traz o mesmo arquivo): 60 questões, 3 horas, formato de outra banca e conteúdo de enfermagem/saúde. Não bate com o gabarito oficial de 50 questões da prova 18. A cópia da Qconcursos ficou só no scratchpad.
- Cópias do Estude Grátis substituídas pelo arquivo oficial (Wayback) quando ele existia: gabaritos da Petrobras 2010 (16/05), 2012 e REFAP, e prova e gabarito da MPE-RO.

## 5. Não encontrado (lacunas)
- **Transpetro, qualquer ano**: não existe prova de Psicologia (seção 1).
- **Petrobras/Cesgranrio 2013–2024**: não houve Psicologia.
- **Liquigás, BR Distribuidora (fora 2015), Petroquisa, Termoaçu, Termorio, Termoceará, EPE, Finep, IBGE, Eletronuclear/Eletrobras, Caixa, BB, ANP**: os gabaritos de nível superior arquivados e o catálogo PCI não têm cargo de Psicologia. Liquigás 2007 (Cetro), BR 2002 (Cespe) e Eletronuclear 2006 (NCE) são de outras bancas.
- **TJ-RO 2008, prova 18**: o caderno oficial não está no Wayback (só o gabarito); as cópias de terceiros estão erradas.
- **Petrobras 2010 (16/05)**: o caderno de Conhecimentos Básicos do turno da manhã não foi localizado. O de 28/03 foi baixado como `prova-basicos.pdf`.
- **Petrobras 2005**: o caderno oficial `prova118.pdf` não está arquivado (usada a cópia do Estude Grátis). Respostas aos recursos não localizadas.
- **Só no PCI, bloqueado por Turnstile**: Prefeitura de Manaus 2004, SEMSA Manaus 2005, SECAD-TO 2005, AL-TO 2005 "Psicólogo" (diferente do Consultor Legislativo). Slugs testados sem sucesso no Estude Grátis, na Qconcursos e na Aprova.
- **BNDES 2024, prova 26**: é a discursiva, logo sem gabarito objetivo (o caderno foi baixado mesmo assim).
- **Gabaritos definitivos não confirmados**: Petrobras 2005 e 2010 (28/03), REFAP 2007, BNDES 2009 e 2013, SEAD-AM 2005 (as respostas aos recursos não citam Psicólogo), SECAD-TO 2004, AL-TO 2005, MPE-RO 2005, SEE-SP 2009.
