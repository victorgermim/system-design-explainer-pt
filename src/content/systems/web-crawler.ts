import type { SystemDesignInput } from "@/types/schema";

export const webCrawler: SystemDesignInput = {
  slug: "web-crawler",
  name: "Web crawler",
  tagline: "Baixe bilhões de páginas de forma educada e sem repetições",
  description:
    "Uma fronteira de URLs (URL frontier) distribui URLs para workers de coleta (fetchers), com uma fila por host para que nenhum site seja sobrecarregado. As páginas baixadas são armazenadas, analisadas em busca de links, e os novos links são verificados contra um filtro de Bloom (Bloom filter) de tudo o que já foi visto antes de voltarem para a fronteira. Impressões digitais de conteúdo (fingerprints) detectam a mesma página sob URLs diferentes, e um agendador recoloca páginas na fila quando chega a hora de recolecá-las.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["bloom-filter", "back-pressure", "consistent-hashing", "leader-election", "sharding"],

  requirements: {
    functional: [
      "Partir de URLs semente (seed URLs) e seguir links para descobrir novas páginas",
      "Respeitar o robots.txt e os limites de taxa por site (politeness)",
      "Ignorar URLs já coletadas e páginas cujo conteúdo seja duplicado",
      "Armazenar páginas brutas para indexação e análise",
      "Rastrear páginas novamente com base na frequência com que mudam",
    ],
    nonFunctional: [
      "Bilhões de páginas por mês em um cluster escalável horizontalmente",
      "Nunca sobrecarregar um único site",
      "Resiliente a sites lentos, quebrados ou maliciosos (timeouts, limites de tamanho, armadilhas)",
      "Workers podem falhar sem perder o estado da fronteira",
    ],
  },

  apis: [
    { method: "POST", path: "/seeds", purpose: "Adicionar URLs semente ou domínios para rastrear" },
    { method: "GET", path: "/urls/{urlHash}", purpose: "Status do rastreamento, horário da última coleta e resultado HTTP para uma URL" },
    { method: "PUT", path: "/hosts/{host}/policy", purpose: "Sobrescrever a taxa de coleta ou exclusão para um site" },
  ],

  estimates: [
    { label: "Páginas baixadas", value: "≈ 1 B/mês (~400/s)", derivation: "Premissa; escale os fetchers linearmente para mais" },
    { label: "Armazenamento bruto", value: "≈ 100 TB/mês", derivation: "1 B × ~100 KB por página; ~25 TB comprimido" },
    { label: "Links descobertos", value: "≈ 20 k/s antes da desduplicação", derivation: "400 páginas/s × ~50 links de saída" },
    { label: "Filtro de URLs vistas", value: "≈ 12 GB", derivation: "10 B de URLs × 10 bits cada para ~1% de falsos positivos" },
  ],

  dataModel: [
    {
      entity: "URL record",
      store: "DB orientado a colunas",
      key: "urlHash",
      fields: ["url", "host", "lastFetched", "status", "contentHash", "changeRate", "nextDue"],
      why: "Bilhões de linhas, atualizadas após cada coleta",
    },
    {
      entity: "Frontier entry",
      store: "Fila por host (com sharding por host)",
      key: "host",
      fields: ["url", "priority", "notBefore"],
      why: "Uma fila por host torna a boa conduta (politeness) uma regra simples: uma coleta por host por vez",
    },
    {
      entity: "Page",
      store: "Object storage",
      key: "urlHash/fetchTime",
      fields: ["headers", "compressed HTML"],
      why: "Blobs grandes e imutáveis para indexação posterior (downstream)",
    },
    {
      entity: "Content fingerprint",
      store: "DB chave-valor",
      key: "simhash / sha256",
      fields: ["firstUrl"],
      why: "Detecta espelhos (mirrors) e duplicatas sob URLs diferentes",
    },
  ],

  nodes: [
    { id: "scheduler", kind: "service", label: "Agendador de coleta", role: "Adiciona sementes e recoloca na fila páginas que precisam ser rastreadas novamente" },
    { id: "frontier", kind: "message-queue", label: "Fronteira de URLs", role: "Filas por host com prioridades e próximos horários permitidos" },
    { id: "fetchers", kind: "service", label: "Fetcher workers", role: "Baixam páginas com timeouts e limites de tamanho" },
    { id: "coordinator", kind: "coordination", label: "Coordenador", role: "Atribui hosts aos fetchers (consistent hashing) e elege um líder" },
    { id: "dns-cache", kind: "cache", label: "Cache de DNS e robots", role: "IPs resolvidos, regras de robots.txt e rate limits por host" },
    { id: "websites", kind: "partner-api", label: "Sites", role: "A web aberta" },
    { id: "page-store", kind: "object-storage", label: "Armazenamento de páginas", role: "Páginas brutas baixadas" },
    { id: "parser", kind: "service", label: "Parser e extrator de links", role: "Extrai texto, links e uma impressão digital de conteúdo" },
    { id: "seen-urls", kind: "cache", label: "Filtro de Bloom de URLs vistas", role: "Verificação rápida: 'já colocamos isso na fila antes?'" },
    { id: "fingerprints", kind: "nosql-db", label: "Impressões digitais de conteúdo", role: "Detecta conteúdo duplicado" },
    { id: "url-db", kind: "wide-column-db", label: "Metadados de URLs", role: "Status e agendamento para cada URL conhecida" },
    { id: "indexer", kind: "search", label: "Índice de busca", role: "Consumidor posterior do texto rastreado" },
  ],

  edges: [
    { id: "scheduler-frontier", from: "scheduler", to: "frontier", label: "Sementes / URLs vencidas", protocol: "async" },
    { id: "scheduler-db", from: "scheduler", to: "url-db", label: "Buscar páginas vencidas" },
    { id: "frontier-fetchers", from: "frontier", to: "fetchers", protocol: "async" },
    { id: "fetchers-coordinator", from: "fetchers", to: "coordinator", label: "Posse de host" },
    { id: "fetchers-dns", from: "fetchers", to: "dns-cache", label: "Resolver, robots, rate limit" },
    { id: "fetchers-web", from: "fetchers", to: "websites", label: "HTTP GET" },
    { id: "fetchers-store", from: "fetchers", to: "page-store", label: "HTML bruto" },
    { id: "fetchers-parser", from: "fetchers", to: "parser", label: "Página baixada", protocol: "async" },
    { id: "parser-fingerprints", from: "parser", to: "fingerprints", label: "Conteúdo duplicado?" },
    { id: "parser-seen", from: "parser", to: "seen-urls", label: "Já viu esta URL?" },
    { id: "parser-frontier", from: "parser", to: "frontier", label: "Novas URLs", protocol: "async" },
    { id: "parser-db", from: "parser", to: "url-db", label: "Atualizar status" },
    { id: "store-indexer", from: "page-store", to: "indexer", label: "Indexar texto", protocol: "stream" },
  ],

  flows: [
    {
      id: "crawl",
      name: "Rastrear uma página",
      steps: [
        { edge: "frontier-fetchers", text: "Um fetcher pega a próxima URL de uma fila de host que ele possui — no máximo uma requisição em andamento por host." },
        { edge: "fetchers-dns", text: "Ele verifica as regras do robots.txt em cache e o atraso de coleta (crawl delay) do host, e resolve o DNS a partir do cache." },
        { edge: "fetchers-web", text: "Ele baixa a página com um timeout e um limite máximo de tamanho." },
        { edge: "fetchers-store", text: "O HTML bruto é armazenado." },
        { edge: "fetchers-parser", text: "A página é entregue a um parser." },
        { edge: "parser-fingerprints", text: "Uma impressão digital de conteúdo sinaliza espelhos e duplicatas." },
        { edge: "parser-seen", text: "Cada link extraído é normalizado e verificado contra o filtro de Bloom." },
        { edge: "parser-frontier", text: "Apenas links ainda não vistos entram na fronteira, na fila de seu respectivo host." },
        { edge: "parser-db", text: "O status da URL, o hash e o horário da próxima coleta são salvos." },
        { edge: "store-indexer", text: "Adiante no pipeline, o texto é indexado para busca." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Sobrecarregar um único site",
      fix: "Filas por host pertencentes a um único fetcher, respeitando o robots.txt e atrasos adaptativos baseados nos tempos de resposta.",
      nodes: ["frontier", "fetchers", "coordinator"],
    },
    {
      problem: "Bilhões de verificações 'já vimos esta URL?'",
      fix: "Um filtro de Bloom em memória com sharding responde a quase todas as verificações; apenas 'talvez visto' consulta o banco de dados.",
      nodes: ["seen-urls", "url-db"],
    },
    {
      problem: "Armadilhas de crawler (crawler traps) e páginas gigantes",
      fix: "Limitar a profundidade da URL, o comprimento e o número de páginas por host; impor limites de bytes e timeouts.",
      nodes: ["fetchers", "parser"],
    },
    {
      problem: "A descoberta de links supera a velocidade de coleta",
      fix: "Priorizar a fronteira (importância da página, taxa de mudança) e descartar ou adiar URLs de baixo valor quando as filas crescerem.",
      nodes: ["frontier", "scheduler"],
    },
  ],

  scaling: [
    "Atribuir hosts aos fetchers com consistent hashing para que adicionar um worker mova poucos hosts.",
    "Fazer sharding da fronteira, do filtro de Bloom e do banco de URLs por hash do host ou da URL.",
    "Executar fetchers em várias regiões para reduzir a latência até sites distantes.",
    "Fazer checkpoint da fronteira para que os hosts de um worker que falhou sejam assumidos por outros.",
  ],

  extensions: [
    "Renderização de JavaScript para aplicações client-side (pool de navegadores headless).",
    "Rastreamento focado para um tópico ou conjunto de domínios específico.",
    "Ingestão de Sitemap e RSS para encontrar novas páginas mais rapidamente.",
  ],
};
