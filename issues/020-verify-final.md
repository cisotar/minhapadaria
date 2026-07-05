---
id: "020"
titulo: Verificação final — exemplo §12 ponta a ponta na UI, a11y, README
tipo: verify
deps: ["009", "010", "016", "017", "018", "019", "021", "022", "023", "024", "025", "026", "027"]
status: done
---

## Contexto
Fechamento da v1: validar o exemplo dourado na aplicação real (não só na suíte), acessibilidade (spec §10) e documentação de entrega.

## O que fazer
- Suíte completa (`npm test -- --run`) + `npm run build` verdes.
- Exemplo §12 ponta a ponta na UI real (vite preview + navegação): montar a receita do §12 e conferir na tela: fermento 200g, 100/100, hidratação fermento 100%, farinha real 1100g, nominal 70% / real 72,73%, custo R$8,86, 2 un + margem 40% → preço R$7,38, lucro R$2,95, receita R$14,76, lucro total R$5,90; escalonar 2000g → 1041,7g. Salvar receita, recarregar página, dados persistem; registrar fornada e ver no histórico; exportar XLSX e backup.
- A11y (§10): labels em todos os inputs, navegação por teclado nos fluxos principais, contraste dos tokens conferido, ARIA em toggles/banner/tabelas onde couber (consultar MDN/WAI-ARIA Authoring Practices).
- Smoke de segurança: nomes/observações com payload HTML inertes em todas as telas; nenhuma chamada de rede em runtime (aba Network limpa); nenhum secret no bundle.
- README: seção Status atualizada (o que a v1 entrega, como rodar, como testar); escriba fecha PROGRESS.md.

## Critérios de aceite
- [ ] Todos os números do §12 conferidos na UI real (lista acima completa).
- [ ] Persistência + backup + export verificados manualmente via preview.
- [ ] Teclado: dá para editar a receita inteira sem mouse.
- [ ] Zero requests de rede em runtime.
- [ ] README com instruções de uso/build/teste.

## Referências
- spec §9, §10, §12 · WAI-ARIA APG · README.md
