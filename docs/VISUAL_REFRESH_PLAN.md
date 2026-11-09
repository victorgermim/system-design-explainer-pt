# Plano de Renovação Visual — "Mais vibrante"

O redesign de layout (REDESIGN_PLAN.md, v2) corrigiu a estrutura: navegação superior, espaço de trabalho dividido, página inicial.
O que falta é **atmosfera**: quase toda superfície é o mesmo card branco / quase preto com uma borda cinza
e um único destaque em índigo, de modo que todos os 36 sistemas, 27 conceitos e 36 componentes parecem iguais. Este plano
adiciona identidade de cores, profundidade, imagens e movimento — sem prejudicar a legibilidade ou a acessibilidade.

---

## 1. Objetivos e diretrizes

**Objetivos**
1. Cada área tem uma identidade de cor reconhecível (categoria, família de conceitos, camada do diagrama).
2. As páginas têm ritmo visual — não uma longa coluna de grades de cards idênticos.
3. O diagrama, núcleo do produto, é o elemento mais colorido e vivo na tela.
4. As interações oferecem um feedback satisfatório.

**Diretrizes (Guardrails)**
- A cor vive em **tons suaves (tints), bordas, ícones e planos de fundo**; o texto do corpo permanece neutro (WCAG AA ≥ 4,5:1 em
  ambos os temas, verificado com axe no CI).
- A cor nunca é o único sinal — sempre acompanhada de um rótulo ou ícone.
- Paleta máxima: cor de destaque da marca + 5 matizes de categoria + 5 matizes de família de conceitos (matizes compartilhados são permitidos).
- Todo movimento respeita `prefers-reduced-motion`.
- Sem novas dependências em tempo de execução para cores/gradientes; movimento via CSS primeiro, JS apenas onde necessário.

---

## 2. Sistema de cores

### 2.1 Marca
| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--accent` | `#4F46E5` | `#818CF8` | Links, foco, botões primários |
| `--accent-2` | `#7C3AED` | `#A78BFA` | Parceiro de gradiente |
| `--accent-3` | `#0891B2` | `#22D3EE` | Parceiro de gradiente |
| `--gradient-brand` | `linear-gradient(135deg, accent, accent-2 50%, accent-3)` | mesmo | Palavra do hero, botões primários, logo |

### 2.2 Identidade de categoria (sistemas)
Cada categoria recebe um matiz usado como **sólido** (ícones, bordas), **tom suave (tint)** (fundos de 8–12%) e
**brilho (glow)** (sombras em hover/ativo).

| Categoria | Matiz | Sólido (claro / escuro) | Tom suave (Tint) |
|---|---|---|---|
| Mídia e Social | Rosa (Rose) | `#E11D48` / `#FB7185` | rose 8% / 14% |
| Mobilidade e Logística | Âmbar (Amber) | `#D97706` / `#FBBF24` | amber 10% / 14% |
| Comércio e Fintech | Esmeralda (Emerald) | `#059669` / `#34D399` | emerald 8% / 14% |
| Reservas e Marketplaces | Violeta (Violet) | `#7C3AED` / `#A78BFA` | violet 8% / 14% |
| Blocos de Construção | Céu (Sky) | `#0284C7` / `#38BDF8` | sky 8% / 14% |

Expostos como `--cat-{id}`, `--cat-{id}-tint`, `--cat-{id}-glow`, definidos por página em um wrapper
(`data-category="mobility"`) para que os componentes usem apenas `--cat`, `--cat-tint`, `--cat-glow`.

### 2.3 Famílias de conceitos
| Família | Matiz | Conceitos |
|---|---|---|
| Dados e armazenamento | Azul | caching, sharding, read replicas, indexação de busca, CDC, livro-razão |
| Escala e distribuição | Laranja | escalabilidade horizontal, consistent hashing, multi-região, geoespacial, IDs, filtros de Bloom, tries |
| Mensageria e fluxo | Roxo | orientado a eventos, fan-out, back-pressure, websockets, saga, streaming ABR, uploads pré-assinados, WebRTC |
| Confiabilidade e correção | Verde | idempotência, locks distribuídos, eleição de líder, rate limiting, microsserviços |
| Segurança | Vermelho | autenticação (+ futuros conceitos de segurança) |

Um novo campo `family` em cada conceito (validado).

### 2.4 Camadas do diagrama
As raias de camada deixam de ser cinzas; cada uma recebe um tom suave de 6–8% e um rótulo de raia colorido:
Clientes — ardósia (slate) · Borda e segurança — azul · Serviços — verde · Assíncrono e streaming — roxo ·
Dados — rosa · Analytics e plataforma — azul-petróleo (teal) (alinhado com as cores de categoria dos nós existentes).

### 2.5 Melhoria do tema escuro
- A base passa do `#0B0D12` chapado para um azul-marinho profundo `#0A0F1E` com superfícies `#111830` / `#172040`.
- Dois brilhos radiais muito suaves (destaque + categoria) fixos atrás da página com ~6% de opacidade.
- Os cards ganham um brilho superior de 1 px (`rgb(255 255 255 / 0.06)`) para dar profundidade.

---

## 3. Profundidade e textura

| Elemento | Tratamento |
|---|---|
| Hero | Gradiente em malha (mesh) animado (3 manchas desfocadas flutuando ao longo de 20 s) + sobreposição de granulação de 3%; palavra "construídos?" do título em texto com `--gradient-brand` |
| Cabeçalho | Borda inferior de 1 px em gradiente; marca do logo preenchida com o gradiente da marca |
| Faixas de seção (início) | Alternar: simples → tom da categoria → simples → faixa escura ("Trilhas de aprendizado") → simples |
| Cards | Sombra suave + borda de 1 px; ao passar o mouse, eleva 2 px e aplica um brilho em `--cat-glow` |
| Visuais interativos | Borda em gradiente (1 px, gradiente da marca) para sinalizar "interaja comigo" |
| Títulos de seção | Chip de ícone colorido + sublinhado curto de 32 px em gradiente |

---

## 4. Imagens e ícones

1. **Miniaturas de diagrama** em cada card de sistema e lista "Usado em / Visto em" — renderizadas em SVG em tempo de
   build a partir do layout ELK existente (nós como retângulos arredondados coloridos, arestas como linhas; sem texto).
   Só isso já torna os 36 cards visualmente distintos.
2. **Ícones de sistema (glyphs)** — um ícone lucide neutro em relação à marca para cada sistema (Play para vídeo, Car para corridas,
   ShoppingCart, MessageCircle, CreditCard, Map, Ticket, Home, Plane …) dentro de um bloco com o tom da categoria.
3. **Ícones de família de conceitos** nos cards de conceitos e cabeçalhos de página.
4. **Marcas de provedores** — pequenos pontos/pílulas coloridos dos provedores ao lado dos nomes dos serviços (logos posteriormente, após
   verificação de licenças).
5. **Ilustrações pontuais** (SVG simples, duas cores) para a página 404, resultados de busca vazios e filtros sem resultados.

---

## 5. Mudanças página por página

### Início
- Hero: gradiente em malha, palavra do título em gradiente, card do diagrama no hero com uma borda sutil em gradiente
  animado; pílulas de estatísticas (`36 sistemas · 36 componentes · 27 conceitos`) como chips coloridos.
- "O que você pode fazer": cada card ganha seu próprio matiz e uma pequena microanimação em loop ao passar o mouse
  (rótulos de nuvem alternando, um ponto se movendo ao longo de uma aresta).
- Trilhas de aprendizado em uma **faixa escura**: cabeçalho em gradiente por trilha, passos numerados unidos por uma linha
  vertical, anel de progresso por trilha (sistemas visitados salvos no localStorage).
- Catálogo: chips de filtro de categoria coloridos por categoria; cards com miniatura, bloco de ícone,
  borda superior colorida, pílula de dificuldade (verde / âmbar / rosa).

### Espaço de trabalho do sistema
- Faixa de cabeçalho tingida com o gradiente da categoria (tom suave → transparente), chip da categoria e ícone.
- Diagrama: raias de camada tingidas, grade de pontos na cor de destaque, "flash" na troca de provedor (as caixas brilham brevemente na
  cor do provedor), passo a passo com um ponto de pacote animado ao longo da aresta ativa e um brilho em suas
  duas extremidades.
- Abas: sublinhado deslizante na cor da categoria.
- Aba Capacidade: números grandes coloridos + barra em escala logarítmica por estimativa.
- Aba Dados: selos de tipo de armazenamento (relacional azul, wide-column rosa, cache vermelho, objetos âmbar, busca
  violeta).
- Visão geral: requisitos como linhas com ícones (✓ funcional, ⚡ desempenho, 🛡 confiabilidade).

### Conceitos
- Índice: cards agrupados por família com borda e ícone na cor da família; uma pequena legenda de famílias no topo.
- Página de conceito: faixa de cabeçalho na cor da família; cards visuais "Veja em ação" com borda em gradiente;
  feedback de sucesso nos visuais (livro-razão "✓ equilibrado" pulsa em verde, anel pisca quando um servidor falha).

### Componentes
- Índice: seções de categoria com cabeçalhos coloridos; colunas de provedores com chips de cabeçalho coloridos.
- Página de componente: cards de opções de provedor com a cor do provedor na borda esquerda.

### Global
- Botões: primário = gradiente da marca, secundário = tingido; leve escala ao pressionar (0,98).
- Controles segmentados (provedor, modo, tema): indicador de pílula deslizante.
- Carregamento: esqueleto do diagrama com efeito shimmer em vez de "Organizando o diagrama…".
- Feedback em estilo toast para ações de copiar link / compartilhar (futuro).

---

## 6. Especificação de movimento

| Interação | Movimento | Duração |
|---|---|---|
| Hover no card | translateY(-2px) + fade-in do brilho | 180 ms ease-out |
| Mudança de segmento/aba | indicador desliza | 200 ms |
| Troca de provedor | pulso de brilho no nó na cor do provedor | 400 ms, uma vez |
| Etapa do passo a passo | pacote viaja pela aresta; extremidades brilham | 800 ms por etapa |
| Malha do hero | manchas flutuam | loop de 20 s |
| Revelação de seção | fade + subida de 8 px na primeira visualização | 300 ms, uma vez |

Movimento reduzido: todos os itens acima tornam-se mudanças de estado instantâneas; a malha do hero fica estática.

---

## 7. Abordagem de implementação (quando construirmos)

- Estender os tokens em `globals.css`: gradiente da marca, paletas de categoria e família, tons de camada, sombras
  de brilho, valores azul-marinho do tema escuro. Expor via `@theme` para que `bg-cat-tint`, `shadow-cat-glow` etc. funcionem.
- O atributo `data-category` / `data-family` nos wrappers de página define as variáveis `--cat` / `--family`.
- Schema: adicionar `family` aos conceitos e `icon` aos sistemas; o validador verifica ambos.
- Script de miniatura em tempo de build: reutilizar `layoutSystem` → gravar `public/thumbs/{slug}.svg`.
- Novos pequenos componentes: `CategoryChip`, `GlyphTile`, `DiagramThumb`, `SegmentedControl`
  (pílula deslizante), `MeshGradient`, `ProgressRing`, `Skeleton`.
- Diagrama: tom da camada a partir do id da camada; componente de aresta personalizado com um pacote animado (`<animateMotion>`
  do SVG ou `offset-path` do CSS) para a etapa ativa.
- Testes: snapshots visuais do Playwright da página inicial, uma página de sistema e uma página de conceito em ambos os temas;
  verificações de contraste com axe.

---

## 8. Fases

| Fase | Escopo | Esforço |
|---|---|---|
| 1. Fundações de cor | Gradiente da marca, paletas de categoria + família, tons de camada, tema escuro mais rico, cards/chips/menus coloridos | ~1 dia |
| 2. Profundidade e refinamento | Malha do hero + título em gradiente, linha em gradiente no cabeçalho, brilhos nos cards, botões em gradiente, controles segmentados deslizantes | ~1 dia |
| 3. Imagens | Miniaturas de diagramas, ícones de sistemas, ícones de famílias de conceitos, pílulas de dificuldade, ilustrações | 2–3 dias |
| 4. Diagramas vivos | Pacote no passo a passo + brilho nas extremidades, flash na troca de provedor, carregamento com esqueleto | 1–2 dias |
| 5. Ritmo de página | Faixas alternadas na página inicial, faixa escura de trilhas de aprendizado com anéis de progresso, abas visuais de capacidade/dados | 1–2 dias |
| 6. QA | Auditoria de contraste em ambos os temas, revisão de movimento reduzido, snapshots de regressão visual | ~1 dia |

Cada fase pode ser entregue de forma independente.

## 9. Critérios de aceitação

- Uma captura de tela de quaisquer duas páginas de sistemas de categorias diferentes é distinguível num piscar de olhos.
- A página inicial tem pelo menos quatro faixas visualmente distintas.
- Cada card de conceito e de sistema mostra uma imagem (miniatura ou ícone), não apenas texto.
- Acessibilidade 100 no Lighthouse e zero violações de contraste no axe nos modos claro e escuro.
- Com movimento reduzido ativado, nenhum elemento é animado.
