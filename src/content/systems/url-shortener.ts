import type { SystemDesignInput } from "@/types/schema";

export const urlShortener: SystemDesignInput = {
  slug: "url-shortener",
  name: "Encurtador de URL",
  tagline: "Links curtos com bilhões de redirecionamentos",
  description:
    "Um serviço de geração de chaves entrega chaves Base62 únicas de 7 caracteres a partir de faixas pré-alocadas, de modo que criar um link nunca exige uma verificação de unicidade. Os redirecionamentos são uma única consulta por chave atendida em grande parte pelo cache (e até pela borda da CDN), e os eventos de clique fluem de forma assíncrona para a análise, mantendo o caminho do redirecionamento minúsculo.",
  category: "infrastructure",
  difficulty: 1,
  concepts: ["id-generation", "caching", "sharding", "leader-election", "rate-limiting"],

  requirements: {
    functional: [
      "Dada uma URL longa, retornar um link curto único",
      "Acessar o link curto redireciona para a URL original",
      "Alias personalizado e tempo de expiração opcionais",
      "Estatísticas de cliques por link",
    ],
    nonFunctional: [
      "Redirecionamentos em poucos milissegundos, altíssima disponibilidade",
      "Voltado a leitura: cerca de 100 redirecionamentos por link criado",
      "As chaves devem ser únicas e difíceis de adivinhar em sequência",
      "Os links nunca são perdidos antes de expirarem",
    ],
  },

  apis: [
    { method: "POST", path: "/shorten", purpose: "{ url, alias?, expiresIn? } → { shortUrl }" },
    { method: "GET", path: "/{key}", purpose: "Redirecionamento 301/302 para a URL original (404 se desconhecida ou expirada)" },
    { method: "GET", path: "/{key}/stats", purpose: "Contagem de cliques por dia, país e referrer" },
    { method: "DELETE", path: "/{key}", purpose: "Remover um link (somente o dono)" },
  ],

  estimates: [
    { label: "Novos links", value: "≈ 200/s", derivation: "500 M por mês ÷ (30 × 86.400 s)" },
    { label: "Redirecionamentos", value: "≈ 20 k/s", derivation: "Proporção de 100:1 entre leitura e escrita" },
    { label: "Armazenamento em 5 anos", value: "≈ 15 TB", derivation: "500 M × 12 × 5 = 30 B de links × ~500 bytes" },
    { label: "Tamanho do cache", value: "≈ 170 GB", derivation: "20% dos 1,7 B de redirecionamentos de um dia × 500 bytes (regra 80/20)" },
    { label: "Espaço de chaves", value: "62⁷ ≈ 3,5 trilhões", derivation: "7 caracteres Base62 — mais de 100× a necessidade de 5 anos" },
  ],

  dataModel: [
    {
      entity: "Link",
      store: "Key-value DB",
      key: "shortKey",
      fields: ["longUrl", "ownerId", "createdAt", "expiresAt"],
      why: "A única consulta quente é 'chave → URL'; bancos key-value escalam isso horizontalmente",
    },
    {
      entity: "Key range",
      store: "Coordination store",
      key: "rangeId",
      fields: ["start", "end", "assignedTo"],
      why: "Cada instância geradora reivindica um bloco de valores do contador, então duas nunca entregam a mesma chave",
    },
    {
      entity: "Click",
      store: "Data warehouse",
      key: "shortKey + time",
      fields: ["country", "referrer", "device"],
      why: "Análise append-only, agregada offline",
    },
  ],

  nodes: [
    { id: "creator", kind: "web-client", label: "Criador (app / API)", role: "Cria links curtos" },
    { id: "visitor", kind: "web-client", label: "Navegador do visitante", role: "Clica em um link curto" },
    { id: "edge", kind: "cdn", label: "Cache de borda", role: "Guarda em cache redirecionamentos populares perto dos visitantes" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Distribui o tráfego entre os servidores de aplicação" },
    { id: "app", kind: "service", label: "Serviço encurtador", role: "Cria links e atende redirecionamentos (stateless)" },
    { id: "kgs", kind: "service", label: "Serviço de geração de chaves", role: "Entrega chaves não usadas de uma faixa reivindicada" },
    { id: "ranges", kind: "coordination", label: "Alocador de faixas", role: "Dá a cada gerador um bloco único de valores do contador" },
    { id: "cache", kind: "cache", label: "Cache de links quentes", role: "chave → URL para links populares" },
    { id: "db", kind: "nosql-db", label: "Armazenamento de links", role: "Todos os mapeamentos de chaves curtas" },
    { id: "clicks", kind: "event-stream", label: "Eventos de clique", role: "Um evento por redirecionamento" },
    { id: "analytics", kind: "data-warehouse", label: "Análise de cliques", role: "Estatísticas agregadas por link" },
    { id: "cleanup", kind: "serverless", label: "Limpeza de expirados", role: "Exclui links expirados em segundo plano" },
  ],

  edges: [
    { id: "creator-lb", from: "creator", to: "lb", label: "POST /shorten" },
    { id: "visitor-edge", from: "visitor", to: "edge", label: "GET /{key}" },
    { id: "edge-lb", from: "edge", to: "lb", label: "Miss" },
    { id: "lb-app", from: "lb", to: "app" },
    { id: "app-kgs", from: "app", to: "kgs", label: "Próxima chave", protocol: "grpc" },
    { id: "kgs-ranges", from: "kgs", to: "ranges", label: "Reivindicar faixa" },
    { id: "app-cache", from: "app", to: "cache" },
    { id: "app-db", from: "app", to: "db" },
    { id: "app-clicks", from: "app", to: "clicks", protocol: "stream" },
    { id: "clicks-analytics", from: "clicks", to: "analytics", protocol: "stream" },
    { id: "cleanup-db", from: "cleanup", to: "db", label: "Excluir expirados" },
  ],

  flows: [
    {
      id: "shorten",
      name: "Criar um link curto",
      steps: [
        { edge: "creator-lb", text: "O criador envia uma URL longa." },
        { edge: "lb-app", text: "Qualquer servidor de aplicação pode atendê-la — eles são stateless." },
        { edge: "app-kgs", text: "A aplicação pede a próxima chave ao gerador. Ele codifica um valor do contador em Base62 (por exemplo, 'aZ3x9Qk')." },
        { edge: "kgs-ranges", text: "Só quando seu bloco acaba o gerador reivindica uma nova faixa, então essa chamada é rara." },
        { edge: "app-db", text: "O mapeamento é gravado. Como as chaves são únicas por construção, não há verificação de colisão." },
        { edge: "app-cache", text: "Ele também é gravado no cache, já que novos links costumam ser clicados logo em seguida." },
      ],
    },
    {
      id: "redirect",
      name: "Seguir um link curto",
      steps: [
        { edge: "visitor-edge", text: "O navegador solicita o link curto; os populares são respondidos na borda." },
        { edge: "edge-lb", text: "Em caso de miss, a requisição chega ao load balancer." },
        { edge: "lb-app", text: "Um servidor de aplicação a atende." },
        { edge: "app-cache", text: "A maioria das consultas acerta o cache…" },
        { edge: "app-db", text: "…caso contrário, uma leitura key-value encontra a URL. Chaves expiradas ou desconhecidas retornam 404." },
        { edge: "app-clicks", text: "Um evento de clique é disparado de forma assíncrona e o redirecionamento é retornado imediatamente." },
        { edge: "clicks-analytics", text: "A análise agrega os cliques por link em segundo plano." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Gerar chaves únicas sem um gargalo central nem colisões",
      fix: "Pré-alocar faixas do contador para cada gerador; codificar o contador em Base62 (embaralhar bits para que as chaves não sejam sequenciais).",
      nodes: ["kgs", "ranges"],
    },
    {
      problem: "Mais de 20 k redirecionamentos por segundo no banco de dados",
      fix: "Cache-aside com remoção LRU para os ~20% de links que recebem mais cliques; usar cache na borda também.",
      nodes: ["cache", "edge", "db"],
    },
    {
      problem: "Trade-off entre 301 e 302",
      fix: "O 301 permite que os navegadores guardem o redirecionamento em cache (menos carga, mas cliques não contabilizados); o 302 mantém cada clique visível para a análise.",
      nodes: ["app", "edge"],
    },
    {
      problem: "Abuso: spam e links maliciosos",
      fix: "Aplicar rate limiting na criação por usuário/IP e verificar as URLs em uma lista de bloqueio de malware antes de salvar.",
      nodes: ["app"],
    },
  ],

  scaling: [
    "Fazer sharding do armazenamento de links pelo hash da chave; as leituras se distribuem de forma uniforme.",
    "Replicar o armazenamento e o cache entre regiões; os redirecionamentos são atendidos pela mais próxima.",
    "Os servidores de aplicação são stateless e escalam atrás do load balancer.",
    "Gravar eventos de clique em um stream para que a análise nunca deixe os redirecionamentos lentos.",
  ],

  extensions: [
    "Domínios personalizados para links de marca.",
    "QR codes para cada link.",
    "Prévias de links e avisos de segurança.",
    "Dashboards por usuário com gráficos de cliques.",
  ],
};
