# System Design Explainer

Um site interativo que explica como grandes sistemas — YouTube, Instagram, Uber, Amazon e mais 30 —
são construídos. Cada sistema percorre requisitos, APIs, estimativas de capacidade, o modelo de dados,
um diagrama de arquitetura que você pode alternar entre **AWS, Google Cloud, Azure e ferramentas de
código aberto**, fluxos de requisição passo a passo, gargalos, escalabilidade e extensões. As páginas
de componentes e conceitos explicam cada bloco de construção e padrão, e apontam de volta para onde
eles são usados.

Construído com Next.js (exportação estática), React Flow + ELK para diagramas com layout automático,
Tailwind CSS e Zod.

## Desenvolver

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Build e pré-visualização

```bash
npm run build     # valida o conteúdo e depois grava o site estático em ./out
npm run preview   # serve ./out em http://localhost:4173
```

## Testar

```bash
npm run validate  # verificações de schema e referências cruzadas para todo o conteúdo
npm run lint
npm run test:e2e  # faz o build e executa os testes de fumaça do Playwright (desktop + celular)
```

O Playwright precisa de um navegador: use `npx playwright install chromium`, ou utilize um já
instalado com `PLAYWRIGHT_CHANNEL=msedge` (ou `chrome`).

## Deploy

`./out` contém apenas arquivos estáticos — faça o upload para qualquer hospedagem estática (GitHub
Pages, Netlify, Vercel, Cloudflare Pages, S3 + CloudFront). Na Vercel, o domínio de produção é usado
automaticamente; em outros lugares, defina `NEXT_PUBLIC_SITE_URL` com a origem pública antes do build
para que as imagens de pré-visualização social recebam URLs absolutas:

```bash
NEXT_PUBLIC_SITE_URL=https://example.com npm run build
```

As imagens de pré-visualização são gravadas como arquivos `opengraph-image` sem extensão; se a sua
hospedagem não detectar o tipo delas, sirva `**/opengraph-image` com `Content-Type: image/png`.

## Adicionando conteúdo

- `src/content/systems/*.ts` — um arquivo por sistema (registre-o em `systems/index.ts`)
- `src/content/components.ts` — tipos de componentes e suas opções para AWS / GCP / Azure / código aberto
- `src/content/concepts.ts` — explicações de conceitos
- `src/types/schema.ts` — o schema que todo arquivo de conteúdo deve satisfazer

`npm run validate` (também executado antes de cada build) captura tipos de componentes desconhecidos,
arestas quebradas, fluxos ou links de conceitos inválidos.

## Estrutura do projeto

- `src/app/` – rotas: `/`, `/systems/[slug]`, `/components/[id]`, `/concepts/[slug]`
- `src/components/` – diagrama, página de sistema, navegação e interface de busca
- `src/lib/` – layout (ELK), resolução de provedores, busca, validação, imagens OG
- `e2e/` – testes de fumaça do Playwright
- `docs/NOTES.md` – notas de conteúdo destiladas dos PDFs de origem
- `docs/IMPLEMENTATION_PLAN.md` – funcionalidades, modelo de dados e marcos
- `docs/REDESIGN_PLAN.md` – plano para um redesign visual mais moderno
- `docs/IMPROVEMENTS_PLAN.md` – plano para conteúdo mais profundo: calculadoras, simulador de falhas, segurança, custo, preparação para entrevistas, laboratórios
- `docs/VISUAL_REFRESH_PLAN.md` – plano para tornar a interface mais vibrante: identidade de cores, profundidade, imagens, movimento
