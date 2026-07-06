---
name: padaria-loop
description: Uma iteração do ciclo autônomo de implementação da Calculadora de Pão (spec v5) — seleciona a próxima issue, delega aos agentes do projeto (arquiteto, dev-core, dev-ui, revisor-spec, guardiao-design, escriba), roda os gates de teste, commita e atualiza o progresso. Rodar via /loop para trabalhar a noite inteira.
---

# /padaria-loop — uma iteração do ciclo de implementação

Cada invocação processa **uma issue** do início ao fim. Fonte da verdade do produto: `spec/Calculadora_Pao_Fermento_Natural_v5.md`. Regras visuais: `brand/brandbook.md` + `references/design-system.css`. Convenções técnicas: `references/architecture.md`.

## 0. Bootstrap (só quando `issues/STATE.md` não existe)

1. Invoque a skill `padaria-issues` para gerar o backlog local e o STATE.
2. Prossiga direto para a seleção (a issue 001 de scaffold será a primeira).

## 1. Selecionar issue

- Leia `issues/STATE.md`. Escolha a primeira issue `todo` cujas `deps` estejam todas `done`.
- Se houver issue presa em `doing` (iteração anterior interrompida): retome-a — confira com `git status`/`git stash list` o que já existe antes de refazer.
- Todas `done` → pule para **Encerramento**.
- Só restam `blocked` → releia as notas de bloqueio; se conseguir destravar, tente UMA vez; senão encerre o loop reportando os bloqueios (não reagende).
- Marque a issue selecionada como `doing` no STATE.

## 2. Planejar — agente `arquiteto`

Delegue (Agent tool, `subagent_type: arquiteto`, síncrono): "Planeje a issue `issues/NNN-slug.md`". Ele grava `## Plano Técnico` na própria issue. Se a issue já tem plano (retomada), pule.

## 3. Implementar

| tipo da issue | agente | observação |
|---|---|---|
| core, storage, export | `dev-core` | **TDD obrigatório**: testes primeiro (vermelho), depois implementação (verde) |
| ui | `dev-ui` | consome o core testado; zero lógica de negócio na UI |
| mista | `dev-core` primeiro, depois `dev-ui` | |
| infra, verify | `dev-core` | |

Passe ao agente o caminho da issue (já com plano) e nada mais — as regras vivem no prompt de sistema dele.

## 4. Gates (bloqueantes)

Rode você mesmo:

- `npm test -- --run`
- `npm run build`

Falhou → devolva ao agente implementador com o erro exato. Máximo **2 rodadas de correção**. Persistindo: marque a issue `blocked` no STATE com o erro nas notas, preserve o trabalho com `git stash push -m "blocked NNN"` (nunca descarte nada) e encerre a iteração agendando a próxima.

## 5. Revisar — em paralelo

Lance juntos (um só bloco de tool calls):

- `revisor-spec` — sempre.
- `guardiao-design` — apenas se a issue tocou UI, HTML ou CSS.

Tratamento dos achados:

- `crítico`/`alto` → corrija nesta iteração (mesmo agente implementador), depois **re-rode os gates do passo 4**. Máximo 2 rodadas; persistindo, trate como bloqueio (passo 4).
- `médio`/`baixo` → crie issue nova tipo `fix` (próximo id livre) com os achados e registre no STATE como `todo`.

## 6. Documentar — agente `escriba`

Delegue: atualizar `PROGRESS.md` (entrada da iteração + "Decisões da noite"), `references/architecture.md` (mapa de módulos, decisões) e conferir cabeçalhos de referência à spec nos arquivos novos.

## 7. Commitar

- `git add` apenas dos arquivos da issue + documentação da iteração (nunca `git add -A` — o repositório tem alterações do usuário fora do escopo).
- Mensagem: `feat(escopo): resumo — issue NNN` (ou `fix:`/`test:`/`chore:` conforme o caso).
- Marque a issue `done` no STATE, com o hash do commit, e commite o STATE junto.
- **Nunca `git push`.**

## 8. Continuar ou encerrar

- Restam issues `todo`/`doing`? → agende a próxima iteração (ScheduleWakeup, `delaySeconds: 60`, repassando o mesmo prompt do /loop).
- Tudo `done` → **Encerramento**: rode a suíte completa + build; confirme o exemplo da Seção 12 de ponta a ponta; peça ao `escriba` o resumo final em PROGRESS.md e a atualização do Status no README; commite; **não reagende** — o loop termina aqui.

## Ferramentas opcionais

- Comandos `/design` (e ferramenta DesignSync, se disponível) **podem ser usados quando o orquestrador julgar necessário** em issues de UI — autorização dada pelo cliente em 2026-07-05. Pré-requisito: consentimento já concedido na máquina (`/design consent`); se indisponível/sem consentimento, siga sem ele (mockups + design system bastam) e registre em PROGRESS.md.

## Regras invioláveis (repasse a quem precisar)

- **Nunca** editar `spec/`, `brand/`, `mockups/` — são o contrato / fonte da verdade (humano-dono): o `revisor-spec` valida a implementação CONTRA eles, então editá-los anularia a validação. Regra de disciplina do loop, **não** trava técnica: o `settings.json` só bloqueia `.env`, não estes diretórios. Divergência deliberada (ex.: decisão do cliente que contraria a spec) NÃO é resolvida reescrevendo o contrato — registre em `PROGRESS.md` → "Decisões da noite" + `references/architecture.md` para revisão humana.
- **Tokens do design system são imutáveis**; classes novas em `references/design-system.css` são permitidas se usarem só tokens e forem documentadas em `references/design-system.html`.
- **Regras de ouro do cliente** (ver `references/architecture.md`): 1) libs consolidadas antes de implementação manual; 2) reusar tudo que já existe — nunca recriar código ou componente existente; 3) segurança e privacidade mandatórios (escape de dado do usuário, sem telemetria, dados 100% locais); 4) documentação oficial consultada na internet antes de implementar lib/API não-trivial.
- **Nenhum secret** em código ou commit; nenhuma chamada de rede em runtime do app (spec §11.1). v1 é 100% client-side.
- **Nunca** `git push`, `git reset --hard`, ou deletar trabalho. Preservar sempre (stash com mensagem).
- Arredondamento só na exibição; recálculo sempre do estado puro (spec §1.6, §9).
- Ambiguidade de spec: adote a leitura literal, registre a escolha em PROGRESS.md → "Decisões da noite" para revisão humana de manhã. Nunca pare o loop para perguntar.
- **Idioma**: código, comentários, commits, issues e docs podem ser integralmente em inglês (decisão do cliente 2026-07-05). Exceção inegociável: strings de UI visíveis ao usuário final sempre em pt-BR (spec §7.1).
