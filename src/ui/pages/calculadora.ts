/**
 * calculadora.ts — Entry da página Calculadora (index.html) · Spec §1–6, §9–10.
 *
 * O que faz: por ora apenas carrega os tokens do design system.
 * Implementa a lógica de cálculo e interface da Calculadora de Fermento Natural:
 * - Entrada de ingredientes e ajustes (§1, §2);
 * - Recálculo automático em tempo real com precisão e arredondamento (§9);
 * - Estrutura do app 100% client-side, sem rede (§10).
 *
 * A UI completa (espelhando mockups/calculadora.html) chega na issue 014.
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
