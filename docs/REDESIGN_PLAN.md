# Plano de Redesign de UI (v2)

Esta versão redefine as alterações de UI para que o redesign tenha espaço para as funcionalidades de profundidade em
[IMPROVEMENTS_PLAN.md](IMPROVEMENTS_PLAN.md): calculadora de capacidade, simulador de falhas, sobreposição de
segurança, estimador de custos, observabilidade, modo de entrevista e laboratórios de código. A v1 apenas reestilizou as
páginas atuais; a v2 as reestrutura para que essas funcionalidades caibam sem tornar as páginas mais longas.

---

## 1. Princípios

1. **O diagrama é o produto.** Cada página de sistema é construída em torno de um diagrama grande e persistente;
   texto, números e ferramentas ficam ao lado dele, não acima.
2. **Uma página, muitas lentes.** Em vez de mais seções, o mesmo diagrama é visto através de *modos*:
   Arquitetura · Passo a passo · Falha · Segurança · Custo · Trace.
3. **Mostrar e depois explicar.** Cada número e afirmação pode ser expandido em sua fórmula, regra ou motivo.
4. **Profundidade progressiva.** Visão geral primeiro; profundidade (índices, SLOs, configurações, código) a um clique de distância.
5. **Calmo e rápido.** Modo claro primeiro (light-first), poucas bordas, tipografia forte, movimento curto e intencional, funciona em celulares.

---

## 2. Linguagem visual

### Tokens (substituindo o truque atual de inversão do slate)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#FAFAF9` | `#0B0D12` | Página |
| `--surface` | `#FFFFFF` | `#12151C` | Cards, painéis |
| `--surface-raised` | `#FFFFFF` + sombra | `#181C25` | Popovers, gavetas (sheets) |
| `--border` | `#E7E5E4` | `#232836` | Divisores (usados com moderação) |
| `--text` | `#1C1917` | `#ECEDEE` | Corpo do texto |
| `--text-muted` | `#57534E` | `#9BA1AE` | Secundário (≥ 4,5:1) |
| `--accent` | `#4F46E5` | `#818CF8` | Links, foco, ações primárias |
| `--accent-soft` | índigo 8% | índigo 14% | Estados selecionados |
| `--danger` / `--warn` / `--ok` | vermelho / âmbar / verde 600 | 400 | Simulador de falhas, status de SLO |

Definidos uma vez por tema, expostos ao Tailwind através de `@theme` (`bg-surface`, `text-muted`, …).
As cores de categoria e provedor tornam-se **tons suaves (tints)** (10–14%) com uma borda colorida de 3 px, e não preenchimentos sólidos.

### Tipografia
- Display: **Geist** 600–700 (já carregada), espaçamento (tracking) −2%; títulos de página 40/48, títulos de seção 24/32.
- Corpo 16/26, pequeno 14/22, rótulos 12/16 em maiúsculas apenas para sobretítulos (overlines).
- Mono (Geist Mono) para APIs, chaves, fórmulas e código.

### Forma, profundidade e movimento
- Raio de borda de 12 px (cards), 8 px (controles), completo para pílulas. Menos bordas; elevação por sombra suave
  (claro) ou brilho superior de 1 px (escuro).
- Movimento de 150–250 ms ease-out: painéis deslizam, rótulos de provedor fazem cross-fade, arestas do passo a passo "se desenham",
  falhas pulsam uma vez. Tudo respeita `prefers-reduced-motion`.

---

## 3. Layout global e navegação

- **Barra superior (56 px)** substitui a barra lateral: logo · *Sistemas* (mega-menu por categoria) · *Componentes* ·
  *Conceitos* · *Prática* (modo de entrevista) · busca (⌘K) · alternador de tema.
- **Paleta de comandos** torna-se a navegação mais rápida: sistemas, componentes, conceitos, serviços e
  ações ("Simular falha do Redis no Uber", "Mudar para Azure").
- **Caminho de navegação (breadcrumb) + seletor de contexto** nas páginas de sistema: `Sistemas / Mobilidade / Uber ▾` para pular entre
  sistemas relacionados.
- Largura máxima de conteúdo de 1280 px; o espaço de trabalho do sistema usa a largura total.

---

## 4. Página por página

### 4.1 Início — página de entrada + catálogo
1. **Hero:** título principal, proposta de valor em uma linha e um **mini-diagrama ao vivo** (encurtador de URL) que alterna
   os rótulos AWS → GCP → Azure → OSS e reproduz um fluxo passo a passo de 3 etapas. CTA: *Explorar um sistema* /
   *Iniciar uma trilha de aprendizado*.
2. **Faixa "Escolha sua lente"**: seis pequenos cards demonstrando os modos (arquitetura, passo a passo,
   falha, segurança, custo, entrevista).
3. **Trilhas de aprendizado:** sequências Iniciante → Intermediário → Avançado com anéis de progresso.
4. **Catálogo:** cards com uma **miniatura do diagrama** gerada automaticamente, tom da categoria, ponto de dificuldade,
   conceitos ao passar o mouse; os filtros viram uma barra de ferramentas compacta com um popover de filtros.

### 4.2 Espaço de trabalho do sistema (o núcleo do redesign)

**Desktop (≥ 1024 px): visualização dividida**

```
┌ Breadcrumb · Uber ▾ ─────────────────────────── Provider [Generic|AWS|GCP|Azure|OSS] ┐
│ ┌──────────── Diagram canvas (sticky, ~60%) ───────────┐ ┌──── Panel (~40%) ─────────┐ │
│ │ Mode bar: Architecture · Walkthrough · Failure ·     │ │ Tabs:                      │ │
│ │           Security · Cost · Trace                    │ │ Overview · Capacity · Data │ │
│ │                                                      │ │ Reliability · Security ·   │ │
│ │   swimlane tiers, larger nodes, provider logos       │ │ Cost · Observability ·     │ │
│ │                                                      │ │ Interview · Code           │ │
│ │ Bottom dock: mode controls (play/step, break/fix,    │ │                            │ │
│ │ cost range, legend chips)                            │ │  scrollable content        │ │
│ └──────────────────────────────────────────────────────┘ └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Sincronização diagrama ↔ painel:** passar o mouse sobre uma linha do modelo de dados destaca seu armazenamento; clicar em um nó abre uma
  gaveta do nó *dentro do painel* (não sobre o diagrama); um card de gargalo "foca" seus nós.
- **Abas do painel** absorvem as nove seções atuais e as novas funcionalidades:

| Aba | Conteúdo |
|---|---|
| Visão geral | Descrição, requisitos (funcionais / não funcionais), conceitos, cards de ADR, mini-linha do tempo de "evolução v1→v3" |
| Capacidade | Entradas da calculadora (sliders, predefinições), saídas ao vivo com fórmulas expansíveis, tabela de dimensionamento |
| Dados | Entidades como cards (chaves de partição/ordenação, índices, TTL), matriz consulta → índice, avisos de partição quente, alternador de DDL |
| Confiabilidade | Cards de SLO com barras de orçamento de erros, RTO/RPO, gargalos e soluções, notas de escalabilidade |
| Segurança | Fluxo de identidade, tabela RBAC/ABAC, classificação de dados, segredos, cards de ameaças |
| Custo | Barras de comparação de provedores (faixas), principais geradores de custo, dicas de economia, premissas |
| Observabilidade | Golden signals por nó, principais alertas, cascata de trace do fluxo selecionado |
| Entrevista | Perguntas → perguntas de acompanhamento → boa resposta / sinais de alerta, rubrica, botão "iniciar simulado" |
| Código | Trecho de código para o nó / passo do fluxo selecionado na linguagem escolhida, link para o laboratório |

- **Tablet (768–1023 px):** diagrama no topo (60 vh, fixo), painel abaixo com abas em rolagem
  horizontal.
- **Celular:** as abas viram uma barra segmentada inferior; a lista de camadas substitui o canvas (como hoje), com
  os modos aplicados à lista (itens com falha em vermelho, links criptografados com selo, custos por item).

### 4.3 Modos do diagrama

| Modo | O que muda no canvas | Controles na barra inferior (dock) |
|---|---|---|
| Arquitetura | Padrão; rótulos e logos de provedores; selos de dimensionamento ×N vindos de Capacidade | Chips de legenda, ajustar à tela, densidade do layout |
| Passo a passo | A aresta ativa se desenha com um pacote em movimento; caminho visitado sólido; restante esmaecido; legenda no dock | Seletor de fluxo, anterior / reproduzir / próximo, velocidade |
| Falha | Nó com falha em vermelho com ✕, caminhos síncronos impactados em âmbar, filas pulsam com contagem de backlog | Menu "Quebrar" (por nó ou cenário), alternadores "Aplicar correção", resumo de impacto |
| Segurança | Raias de fronteira de confiança (internet / borda / privada / PCI), cadeado em arestas criptografadas, selos de PII nos armazenamentos | Alternador de fronteiras, destacar fluxos de PII |
| Custo | Tamanho ou calor do nó mostra a fatia do custo mensal; rótulos mostram faixa em $ | Provedor, predefinição, mensal / anual |
| Trace | O fluxo selecionado é renderizado como uma cascata de spans ao lado do canvas; nós mostram orçamento de latência | Seletor de fluxo, alternador p50 / p99 |

### 4.4 Design dos nós (canvas)
- 240×96 px; **borda esquerda de 3 px na cor da categoria**, logo do provedor no canto superior direito, nome do serviço em 15 px
  semibold, rótulo genérico + papel ao passar o mouse/expandir.
- Estados: padrão · hover (elevado) · selecionado (anel de destaque) · no caminho (borda âmbar) · com falha (vermelho,
  hachurado) · esmaecido (40% de opacidade).
- **Nós expansíveis** (botão "+") revelam o funcionamento interno para serviços detalhados (por exemplo, pipeline de
  pareamento do Uber) como um sub-grafo aninhado.

### 4.5 Componentes e Conceitos
- **Página de componente:** hero com abas de provedores; tabela *Comparar* (configurações, limites, esforço gerenciado vs
  auto-hospedado, lock-in); "Usado em" como miniaturas de diagramas que abrem o sistema com aquele nó
  selecionado; modos de falha por tipo, controles de segurança, golden signals e unidades de preço.
- **Página de conceito:** um pequeno diagrama explicativo animado no topo, seguido de explicação, trade-offs,
  miniaturas "visto em", conceitos relacionados como um pequeno grafo.

### 4.6 Prática (modo de entrevista)
- Escolha um sistema → cronômetro de 45 minutos com passo a passo de fases (Esclarecer · Estimar · API · Dados · Design ·
  Aprofundamento · Conclusão); o espaço de trabalho abre com as abas ocultas até que cada fase seja alcançada; escada
  de dicas; rubrica de autoavaliação; histórico salvo localmente.

---

## 5. Biblioteca de componentes

Construída sobre primitivos **shadcn/ui (Radix)**, estilizada com os tokens:
Button, IconButton, Tabs, Sheet, Dialog, Popover, Tooltip, Command (⌘K), Slider, Segmented control,
Toggle group, Badge/Pill, Card, Table, Accordion, Progress ring, Toast.
Personalizados: `DiagramCanvas`, `ModeDock`, `NodeCard`, `SwimlaneTier`, `FormulaReveal`, `SloCard`,
`CostBar`, `TraceWaterfall`, `ThreatCard`, `CodeTabs`, `DiagramThumbnail`.

---

## 6. Acessibilidade e desempenho

- WCAG 2.2 AA em ambos os temas (verificado com axe no CI); cada modo possui um equivalente em texto no
  painel (o diagrama nunca é a única fonte de informação).
- Suporte completo a teclado no canvas: Tab entre nós, Enter para selecionar, setas para percorrer arestas.
- Orçamentos do Lighthouse: LCP < 2 s, CLS < 0,05; miniaturas de diagramas pré-renderizadas como SVG em tempo de build;
  layout ELK pré-computado no build e entregue como JSON (sem trabalho de layout no navegador).

---

## 7. Fases de entrega (alinhadas com IMPROVEMENTS_PLAN.md)

| Fase | Trabalho de UI | Desbloqueia |
|---|---|---|
| 1. Fundações | Tokens, escala tipográfica, barra superior, ações no ⌘K, primitivos shadcn, cards reestilizados | Tudo |
| 2. Shell do espaço de trabalho | Visualização dividida, abas do painel (Visão geral, Dados, Confiabilidade), barra de modos + dock, redesign dos nós, raias (swimlanes), layouts pré-computados | Conteúdo atual no novo layout |
| 3. Capacidade e Custo | Aba Capacidade + selos ×N, aba Custo + modo Custo | Calculadora, estimador de custos |
| 4. Falha e Segurança | Modo Falha + melhorias na aba Confiabilidade, modo + aba Segurança | Simulador, segurança |
| 5. Trace e Observabilidade | Modo Trace, cascata (waterfall), aba Observabilidade | Observabilidade |
| 6. Prática e Código | Página Prática, aba Entrevista, aba Código | Modo de entrevista, laboratórios |
| 7. Página inicial e refinamento | Mini-diagrama no hero, trilhas de aprendizado, miniaturas, movimento, testes de regressão visual | Descoberta |

Cada fase é entregue nas mesmas URLs; os parâmetros de consulta antigos (`?cloud=&node=&flow=&step=`) continuam
funcionando e ganham `mode=` e `tab=`.

---

## 8. O que muda em relação à v1 deste plano

| v1 | v2 |
|---|---|
| Reestilizar as seções existentes | Reestruturar em um espaço de trabalho centrado no diagrama com abas e modos |
| Visualização dividida com abas genéricas | Abas mapeadas um-para-um para as novas funcionalidades de profundidade |
| Apenas passo a passo animado | Seis modos de diagrama compartilhando o mesmo canvas e dock |
| Barra lateral → navegação superior | Navegação superior + ações no ⌘K + seção Prática |
| Fases de refinamento visual | Fases alinhadas com o roteiro de funcionalidades para que cada etapa de UI entregue uma capacidade |
