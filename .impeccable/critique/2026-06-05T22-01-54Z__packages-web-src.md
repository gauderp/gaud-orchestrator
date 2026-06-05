---
target: packages/web/src
total_score: 16
p0_count: 0
p1_count: 3
timestamp: 2026-06-05T22-01-54Z
slug: packages-web-src
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading states são texto puro, sem skeletons. Sem feedback após ações. |
| 2 | Match System / Real World | 3 | Terminologia coerente. IDs truncados como labels são crípticos. |
| 3 | User Control and Freedom | 2 | Sem undo. Sem breadcrumbs consistentes. |
| 4 | Consistency and Standards | 2 | Tabs conflitantes (pill vs underline). |
| 5 | Error Prevention | 1 | Forms sem validação inline. Delete sem confirmação. |
| 6 | Recognition Rather Than Recall | 2 | IDs truncados. Sidebar collapsed sem tooltips. |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts. Sem command palette. |
| 8 | Aesthetic and Minimalist Design | 2 | Hero-metric template. Cards idênticos. Eyebrows everywhere. |
| 9 | Error Recovery | 1 | Mensagens genéricas. Sem retry. |
| 10 | Help and Documentation | 0 | Nenhuma ajuda contextual. |
| **Total** | | **16/40** | **Poor** |

## Anti-Patterns Verdict

Detector found 2 side-tab accent borders (ArtifactBlock.tsx:22, UserQuestionBanner.tsx:20).
LLM found: hero-metric template dashboard, uppercase eyebrows everywhere, uniform spacing, identical card grids, generic sidebar/header, side-stripe borders.

## Priority Issues

P1: Dashboard hero-metric template (10 identical StatCards)
P1: Uppercase eyebrows saturating every section
P1: Generic sidebar and header
P2: Uniform spacing without rhythm
P2: Side-stripe borders in conversation
P2: Zero keyboard shortcuts
P2: Inconsistent tab patterns

## Persona Red Flags

Alex (Power User): No keyboard shortcuts, no Cmd+K, no bulk actions
Jordan (First-Timer): Dashboard doesn't hierarchize info, cryptic IDs
Sam (Accessibility): No tooltips on collapsed sidebar, no keyboard kanban alternative
