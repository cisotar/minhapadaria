---
id: "017"
titulo: UI Tela de receitas — criar, abrir, renomear, duplicar, excluir + backup
tipo: ui
deps: ["011", "012", "014"]
status: todo
---

## Contexto
Gerenciamento de receitas (spec §2.F; mockup `mockups/receitas.html`). Também abriga os botões de backup/restauração (012, §10).

## O que fazer
- `receitas.html` + `src/ui/`: lista das receitas salvas (storage 011), fiel ao mockup/design system.
- Operações (§2.F): criar (em branco ou padrão), abrir (carrega na calculadora — navegação com id, ex `index.html?recipe=<id>`), renomear, duplicar (cópia integral), excluir (com confirmação; §14.7 órfãs preservadas — mensagem avisa que fornadas ficam).
- Botões "Exportar backup" / "Restaurar backup" usando 012 (download JSON / input file); falha de import → mensagem de erro pt-BR sem perder dados.
- **Escape XSS**: nome da receita via textContent — dado do usuário (regra de ouro 3).
- Estado vazio (nenhuma receita) com chamada para criar.
- Reusar componentes/classes já criados nas issues 014–016 (regra de ouro 2).

## Critérios de aceite
- [ ] 5 operações §2.F funcionais ponta a ponta com persistência.
- [ ] Duplicar gera cópia integral independente (editar cópia não afeta original).
- [ ] Excluir pede confirmação; fornadas da receita permanecem órfãs (§14.7).
- [ ] Backup: export → limpar storage → import → receitas de volta.
- [ ] Nome `<img onerror>` renderiza inerte.
- [ ] Strings pt-BR; layout fiel ao mockup.

## Referências
- spec §2.F, §10, §14.7 · mockups/receitas.html · brandbook · issues 011/012
