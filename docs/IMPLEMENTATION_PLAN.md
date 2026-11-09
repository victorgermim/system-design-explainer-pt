# System Design Explainer — Plano de Implementação

Objetivo: um único site que explique como construir grandes sistemas (YouTube, Instagram, Uber, …), mostre um
diagrama de arquitetura interativo para cada um e permita que o leitor alterne o diagrama entre **AWS, Google
Cloud, Azure e Código aberto / auto-hospedado**, com alternativas listadas para cada componente.
O conteúdo vem dos PDFs (veja [NOTES.md](NOTES.md)); **não há leitor de PDF**.

## Status

| Marco | Estado |
|---|---|
| 0 Limpeza do repositório | Concluído |
| 1 Modelo de dados unificado | Concluído |
| 2 Motor de diagramas (layout ELK, estado na URL) | Concluído |
| 3 Página de sistema + fluxos passo a passo | Concluído |
| 4 Onda de conteúdo 1 (10 sistemas) | Concluído |
| 5 Catálogo, componentes, conceitos, busca | Concluído |
| 6 Onda de conteúdo 2 (25 sistemas) | Concluído — 35 de 36 sistemas detalhados (Redis tem apenas diagrama) |
| 7 Refinamento e deploy (mobile, a11y, imagens OG, exportação estática, e2e) | Concluído |
| Fase 2 / Fase 3 | Não iniciado |

Desvios em relação ao plano original: os conceitos são dados em TypeScript validados em vez de MDX; a busca é
um pequeno comparador embutido em vez de Pagefind/Fuse; os diagramas não têm minimapa; os ícones de provedores são
genéricos (lucide) até que as licenças dos ícones oficiais sejam verificadas.

---

## 1. Estado atual do repositório

| Caminho | O que é | Decisão |
|---|---|---|
| `archviz/` | Next.js 16 + React 19 + `@xyflow/react` + Tailwind 4. Possui diagrama, seletor de provedor, painel de detalhes do nó, 5–7 apps | **Manter como base** |
| `archviz/src/data/applications/*` + `cloudMappings.ts` + `types.ts` | Modelo de dados #1 (`serviceType`, provedores incl. "generic") | Mesclar em um único modelo |
| `archviz/src/data/architectures/*` + `cloud-providers.ts` | Modelo de dados #2 (`componentType`, 3 provedores) — uma duplicata paralela | Mesclar em um único modelo |
| `system-design-atlas/` | Biblioteca estática de cards em HTML + leitor de PDF embutido, `data/designs.js` (notas extraídas automaticamente) | **Excluir**; suas notas foram substituídas por `docs/NOTES.md` |
| `system-design-atlas/assets/pdfs/` | Cópias de todos os PDFs | **Excluir** |
| `tools/build_site.py` | Gerador para o atlas | **Excluir** |
| `*.pdf` na raiz do repositório (59 arquivos) | Material de origem | Mover para `source-pdfs/` (ignorado pelo git) ou para fora do repositório |
| `archviz/.next`, `tsconfig.tsbuildinfo` | Saída de build | Excluir, ignorar no git |

### Estrutura alvo (um único site na raiz do repositório)

```
system-design-explainer/
├─ docs/                    NOTES.md, IMPLEMENTATION_PLAN.md, CONTENT_GUIDE.md
├─ src/
│  ├─ app/                  routes (see §4)
│  ├─ components/           diagram/, layout/, content/, ui/
│  ├─ content/
│  │  ├─ systems/           youtube.ts, instagram.ts, uber.ts … (one file per system)
│  │  ├─ concepts/          caching.mdx, sharding.mdx, rate-limiting.mdx …
│  │  └─ components.ts      component catalogue + provider mappings + alternatives
│  ├─ lib/                  layout (ELK), schema (zod), search index, provider resolve
│  └─ types/
├─ public/icons/            provider + generic component icons (SVG)
└─ package.json
```

## 2. Modelo de dados (o coração do projeto)

Um único schema, validado com **Zod** em tempo de build para que um arquivo de conteúdo inválido falhe o build.

```ts
type Provider = "generic" | "aws" | "gcp" | "azure" | "oss";

// Catalogue entry — defined once, reused by every system
interface ComponentKind {
  id: "cdn" | "load-balancer" | "api-gateway" | "cache" | "event-stream" | ...;
  name: string;                 // "Event streaming"
  category: "edge" | "compute" | "data" | "messaging" | "analytics" | "ml" | "security" | "ops" | "client" | "external";
  what: string;                 // one-paragraph explainer
  whenToUse: string[];
  pitfalls: string[];
  providers: Record<Exclude<Provider,"generic">, ServiceOption[]>; // first = default
  concepts: string[];           // links to concept pages
}
interface ServiceOption { name: string; note?: string; managed: boolean; url?: string }

// A system (YouTube, Uber …)
interface SystemDesign {
  slug: string; name: string; tagline: string; category: Category;
  difficulty: 1 | 2 | 3; concepts: string[];
  requirements: { functional: string[]; nonFunctional: string[] };
  apis: { method: string; path: string; purpose: string }[];
  estimates: { label: string; value: string; derivation?: string }[];
  dataModel: { entity: string; store: string; key: string; fields: string[]; why: string }[];
  nodes: { id: string; kind: ComponentKind["id"]; label: string; role: string;
           overrides?: Partial<Record<Provider, string>>; group?: string }[];
  edges: { from: string; to: string; label?: string; protocol?: "https"|"grpc"|"ws"|"async"|"cdc" }[];
  flows: { id: string; name: string; steps: { edge: string; text: string }[] }[];   // animated walkthroughs
  bottlenecks: { problem: string; fix: string; nodes: string[] }[];
  scaling: string[]; extensions: string[];
  lld?: { classes: string[]; patterns: string[]; notes: string };                  // from the Go LLD PDFs
}
```

Ideias principais:
- Os diagramas armazenam **tipos de componentes**, nunca nomes de fornecedores. O seletor de provedor resolve o rótulo/ícone
  através de `components.ts`; `overrides` trata casos especiais (por exemplo, CDN da Netflix → "Open Connect").
- **Sem coordenadas x/y posicionadas manualmente.** Use `elkjs` (layout em camadas, esquerda→direita, agrupado por camada) para que novos
  sistemas precisem apenas de nós + arestas. Opcionalmente, fixe algumas posições.
- `flows` referenciam arestas para que o diagrama possa destacar o caminho de uma requisição passo a passo.

### Catálogo de componentes — mapeamento inicial

| Componente | AWS | Google Cloud | Azure | Código aberto / alternativas |
|---|---|---|---|---|
| DNS / geo-routing | Route 53 | Cloud DNS | Azure DNS / Traffic Manager | CoreDNS, PowerDNS; Cloudflare |
| CDN | CloudFront | Cloud CDN / Media CDN | Azure Front Door | Varnish, Apache Traffic Server; Cloudflare, Fastly, Akamai |
| WAF / DDoS | AWS WAF, Shield | Cloud Armor | Azure WAF, DDoS Protection | ModSecurity, Coraza |
| Balanceador de carga | ALB / NLB | Cloud Load Balancing | Load Balancer / Application Gateway | NGINX, HAProxy, Envoy, Traefik |
| API gateway | API Gateway | Apigee / API Gateway | API Management | Kong, Apache APISIX, Tyk, KrakenD |
| Autenticação / identidade | Cognito | Identity Platform | Entra ID / External ID | Keycloak, Ory, Authentik |
| Contêineres | EKS / ECS (Fargate) | GKE / Cloud Run | AKS / Container Apps | Kubernetes, Nomad |
| Funções serverless | Lambda | Cloud Run functions | Azure Functions | Knative, OpenFaaS |
| BD relacional | RDS / Aurora | Cloud SQL / AlloyDB / Spanner | Azure SQL / Azure DB for PostgreSQL | PostgreSQL, MySQL, Vitess, CockroachDB |
| Wide-column | Keyspaces / DynamoDB | Bigtable | Cosmos DB (Cassandra API) | Cassandra, ScyllaDB, HBase |
| Documentos / KV | DynamoDB / DocumentDB | Firestore | Cosmos DB | MongoDB, CouchDB |
| Cache | ElastiCache / MemoryDB | Memorystore | Azure Managed Redis | Redis, Valkey, Memcached, Dragonfly |
| Armazenamento de objetos | S3 | Cloud Storage | Blob Storage | MinIO, Ceph |
| Fila de mensagens | SQS / SNS | Pub/Sub / Cloud Tasks | Service Bus / Queue Storage | RabbitMQ, NATS |
| Event streaming | MSK / Kinesis | Pub/Sub / Managed Kafka | Event Hubs | Kafka, Redpanda, Pulsar |
| Processamento de streams | Managed Service for Apache Flink | Dataflow | Stream Analytics | Flink, Spark Structured Streaming |
| Batch / data lake | EMR / Glue | Dataproc | HDInsight / Fabric | Spark, Trino, Hadoop |
| Warehouse / OLAP | Redshift | BigQuery | Synapse / Fabric | ClickHouse, Apache Druid, Pinot |
| Busca | OpenSearch Service | Vertex AI Search / Elastic Cloud | Azure AI Search | Elasticsearch, OpenSearch, Solr, Meilisearch |
| Busca vetorial | OpenSearch k-NN / Aurora pgvector | Vertex AI Vector Search | Azure AI Search / Cosmos DB vector | pgvector, Milvus, Qdrant, Weaviate |
| BD de grafos | Neptune | Spanner Graph | Cosmos DB (Gremlin) | Neo4j, JanusGraph |
| Séries temporais | Timestream | Bigtable | Azure Data Explorer | TimescaleDB, InfluxDB, Prometheus |
| Transcodificação de vídeo | Elemental MediaConvert | Transcoder API | (Media Services descontinuado) → FFmpeg no AKS | FFmpeg, GStreamer |
| Tempo real / WebSocket | API Gateway WebSocket / AppSync | Firebase RTDB / auto-hospedado no GKE | Web PubSub / SignalR Service | Socket.IO, Centrifugo, NATS |
| WebRTC / TURN | Kinesis Video Streams WebRTC / Chime SDK | — (auto-hospedar no GKE) | Azure Communication Services | coturn, Pion, LiveKit, mediasoup, Janus |
| Notificações push | SNS mobile push | Firebase Cloud Messaging | Notification Hubs | ntfy, Gotify (+ APNs/FCM diretamente) |
| E-mail / SMS | SES / End User Messaging | — (parceiros) | Azure Communication Services | Postal; Twilio, SendGrid |
| Mapas / geo | Amazon Location Service | Google Maps Platform | Azure Maps | OpenStreetMap, OSRM, PostGIS, H3 |
| ML / recomendações | SageMaker / Personalize | Vertex AI | Azure Machine Learning | Kubeflow, MLflow, Feast |
| Workflow / orquestração | Step Functions / MWAA | Workflows / Cloud Composer | Logic Apps / Durable Functions | Temporal, Airflow |
| Coordenação / config | AppConfig / locks no DynamoDB | — | App Configuration | ZooKeeper, etcd, Consul |
| Segredos / chaves | Secrets Manager / KMS | Secret Manager / Cloud KMS | Key Vault | OpenBao, Vault, SOPS |
| Métricas e tracing | CloudWatch / X-Ray | Cloud Monitoring / Trace | Azure Monitor / App Insights | Prometheus, Grafana, Jaeger, OpenTelemetry |
| Logs | CloudWatch Logs | Cloud Logging | Log Analytics | ELK / OpenSearch, Loki |
| Infra como código | CloudFormation / CDK | Infrastructure Manager | Bicep / ARM | Terraform, OpenTofu, Pulumi |
| Pagamentos (externo) | — | — | — | Stripe, Razorpay, Adyen, PayPal |

> Verifique cada mapeamento na documentação atual do provedor ao escrever `components.ts` (serviços são
> renomeados/descontinuados — por exemplo, Azure Media Services e Amazon Pinpoint). Adicione uma data `lastVerified` por linha.

## 3. Funcionalidades do site

### MVP
1. **Catálogo de sistemas** – grade na página inicial com todos os sistemas, filtro por categoria / dificuldade / conceito usado, busca global (⌘K).
2. **Página de sistema** na estrutura de HLD de 9 passos dos PDFs: requisitos, APIs, estimativas, modelo de dados, arquitetura, fluxos, gargalos, escalabilidade, extensões — com navegação de seção fixa.
3. **Diagrama de arquitetura interativo** (React Flow): pan/zoom, minimapa, camadas agrupadas (borda / serviços / dados / assíncrono / analytics), rótulos de arestas com protocolo.
4. **Seletor de provedor de nuvem** – Genérico · AWS · GCP · Azure · Código aberto. Rótulos e ícones dos nós trocam ao vivo; a escolha persiste na URL (`?cloud=aws`) para que os links sejam compartilháveis.
5. **Painel de detalhes do componente** – clique em um nó: o que ele faz *neste* sistema, o serviço do provedor escolhido, todas as alternativas entre provedores/OSS, quando usar, armadilhas e links para páginas de conceitos.
6. **Fluxos de requisição passo a passo** – "Reproduzir: enviar um vídeo", "Reproduzir: solicitar uma corrida": destaca as arestas passo a passo com uma legenda explicativa.
7. **Página de catálogo de componentes** – a tabela de mapeamento completa acima, filtrável, mais "quais sistemas usam isto".
8. **Biblioteca de conceitos** – caching, sharding, rate limiting, fan-out, idempotência, sagas, indexação geográfica, streaming ABR, consistent hashing, etc., cada um apontando de volta para os sistemas.
9. **Widgets de estimativa de envelope** – estimativas mostradas como derivações (DAU × ações ÷ 86.400 = QPS).
10. Tema escuro/claro, responsivo (o diagrama vira uma lista vertical em celulares), exportação estática.

### Fase 2
11. **Visualização comparativa** – dois provedores (ou dois sistemas) lado a lado.
12. **Sobreposição de gargalos** – alternador que destaca nós críticos (hotspots) e mostra a solução.
13. **Exportação** – diagrama como PNG/SVG, e a stack como um checklist em Markdown/módulo Terraform.
14. **Modo "Construa o seu"** – comece a partir de um modelo, adicione/remova componentes, o provedor resolve automaticamente; salvo no localStorage / link compartilhável.
15. **Dicas aproximadas de custo** – faixa qualitativa de custo por componente e por provedor (sem preços em tempo real).

### Fase 3
16. **Aba LLD** para sistemas com um PDF de LLD em Go: diagrama de classes (Mermaid), padrões usados, notas de concorrência.
17. **Páginas exclusivas de LLD** (Caixa eletrônico, Elevador, Xadrez, Ludo, Blackjack, Quebra-cabeça, Máquina de vendas, Biblioteca, Estacionamento).
18. **Preparação para entrevistas** – cards de perguntas e respostas de *Technical Interview Questions*; checklist "explique este sistema em 45 min" por sistema.
19. Quizzes por sistema.

## 4. Rotas

```
/                         catalogue
/systems/[slug]           system page (?cloud=aws&flow=upload)
/components               component catalogue
/components/[id]          one component across providers
/concepts/[slug]          concept explainer
/compare                  compare providers / systems
/lld/[slug]               phase 3
/interview                phase 3
```

## 5. Stack tecnológica

- **Next.js (App Router) com `output: "export"`** – totalmente estático, hospede em qualquer lugar (Vercel, Netlify, GitHub Pages, S3+CloudFront).
- **@xyflow/react** (já presente) para diagramas + **elkjs** para layout automático.
- **Tailwind 4** (já presente) + primitivos **shadcn/ui**; ícones **lucide-react**.
- **Zod** para validação de conteúdo; **MDX** (`@next/mdx`) para páginas de conceitos.
- **Pagefind** ou **Fuse.js** para busca no lado do cliente.
- Ícones de provedores: conjuntos oficiais de ícones de arquitetura da AWS/Azure/GCP (verificar cada licença); SVGs genéricos simples caso contrário.
- **Vitest** para testes de schema/resolvedor, testes de fumaça com **Playwright** (troca de provedor, clique em nó, reprodução de fluxo).

## 6. Marcos

| # | Marco | Entrega |
|---|---|---|
| 0 | **Limpeza do repositório** | Excluir `system-design-atlas/`, `tools/`, `.next/`; mover conteúdo de `archviz/` para a raiz do repositório; mover PDFs para `source-pdfs/` ignorado no git; atualizar README; um único histórico `git` |
| 1 | **Unificar modelo de dados** | Único `types/`, `content/components.ts` (tabela na §2), schemas Zod, excluir os dois modelos antigos; portar os diagramas existentes de YouTube/Instagram/Uber/Amazon para o novo formato |
| 2 | **Motor de diagramas** | Auto-layout ELK, grupos de camadas, resolvedor de provedor, ícones, estado de provedor sincronizado na URL, painel de detalhes com alternativas |
| 3 | **Página de sistema** | Layout de 9 seções, widget de estimativas, tabela de modelo de dados, reprodutor de fluxo passo a passo |
| 4 | **Onda de conteúdo 1 (principais)** | YouTube, Netflix, Instagram, Twitter, Messenger, Uber, Amazon, Pagamentos, Encurtador de URL, Rate limiter |
| 5 | **Catálogo, páginas de componentes e conceitos, busca** | Grade inicial, `/components`, ~20 páginas MDX de conceitos |
| 6 | **Onda de conteúdo 2** | Sistemas HLD restantes (Maps, Dropbox, Airbnb, Zomato, BookMyShow, MakeMyTrip, Companhia aérea, Practo, Urban Company, Porter, Frota de motoristas, NoBroker, Quora, LinkedIn, Typeahead, Crawler, Pastebin, BNPL, Corretora, Gateway de pagamento, AstroTalk, Esportes, WebSocket, WebRTC, Aluguel de carros, Agendador de reuniões) |
| 7 | **Refinamento e deploy** | Layout mobile, a11y, imagens OG por sistema, deploy estático, testes de fumaça com Playwright |
| 8 | Funcionalidades da Fase 2 → Fase 3 | Comparar, exportar, construtor, LLD, preparação para entrevistas |

### Fluxo de trabalho de autoria de conteúdo (por sistema)
1. Ler o texto do PDF (e seu par duplicado/LLD) → preencher o arquivo `SystemDesign` seção por seção.
2. Modelar nós usando apenas tipos do catálogo; adicionar `overrides` apenas quando um sistema usa algo específico.
3. Escrever 1–3 `flows`.
4. `npm run validate` (Zod) → verificação visual com cada provedor → commit.

## 7. Riscos / decisões

- **Precisão do mapeamento** – nomes de produtos em nuvem mudam; manter um campo `lastVerified` e um único arquivo-fonte.
- **Legibilidade do diagrama** para sistemas com mais de 25 nós – confiar no agrupamento por camadas, grupos recolhíveis e destaque de fluxo em vez de mostrar tudo de uma vez.
- **Direitos autorais das fontes em PDF** – reescrever o conteúdo com nossas próprias palavras (os PDFs citam blogs e posts do DEV); manter apenas atribuições curtas.
- **Escopo** – 46 tópicos é muita coisa; entregar a onda 1 (10 sistemas) antes de qualquer coisa da Fase 2.
