import type { SystemDesignInput } from "@/types/schema";

export const linkedin: SystemDesignInput = {
  slug: "linkedin",
  name: "LinkedIn",
  tagline: "Perfis, conexões, feed, mensagens e vagas",
  description:
    "O grafo profissional é o núcleo: as conexões vivem em um banco de grafos que responde 'como estou conectado a esta pessoa?' e alimenta o recurso 'Pessoas que talvez você conheça'. Os posts passam por fan-out para os feeds das conexões e são classificados por um modelo. As vagas formam uma vertical de busca separada associada aos perfis, e as mensagens rodam em uma camada em tempo real.",
  category: "media-social",
  difficulty: 3,
  concepts: ["fan-out", "search-indexing", "sharding", "caching", "event-driven"],

  requirements: {
    functional: [
      "Perfis com experiência, competências e formação acadêmica",
      "Enviar e aceitar convites de conexão; seguir pessoas e empresas",
      "Publicar atualizações; ver um feed classificado por relevância",
      "Buscar pessoas e vagas; candidatar-se a vagas",
      "Mensagens diretas e notificações",
    ],
    nonFunctional: [
      "Consultas no grafo (grau de conexão) em milissegundos",
      "O feed carrega rapidamente para centenas de milhões de usuários",
      "Atualizações de perfil ficam visíveis na busca em poucos minutos",
    ],
  },

  apis: [
    { method: "GET", path: "/profiles/{id}", purpose: "Perfil com o seu grau de conexão" },
    { method: "POST", path: "/connections/requests", purpose: "Enviar um convite de conexão" },
    { method: "POST", path: "/connections/requests/{id}/accept", purpose: "Aceitar convite" },
    { method: "GET", path: "/feed?cursor=", purpose: "Feed classificado" },
    { method: "GET", path: "/jobs/search?q=&location=", purpose: "Busca de vagas" },
    { method: "WS", path: "/messaging", purpose: "Mensagens em tempo real" },
  ],

  estimates: [
    { label: "Membros", value: "≈ 1 B, 150 M diários", derivation: "Estimativa baseada em números públicos" },
    { label: "Conexões", value: "≈ 50–100 B de arestas", derivation: "Média de algumas centenas de conexões por membro" },
    { label: "Requisições de feed", value: "≈ 20 mil/s média", derivation: "150 M × ~10 carregamentos de feed ÷ 86.400 s" },
    { label: "Buscas de vagas", value: "≈ 5 mil/s", derivation: "Estimativa" },
  ],

  dataModel: [
    {
      entity: "Perfil",
      store: "Banco relacional / de documentos, com sharding por memberId",
      key: "memberId",
      fields: ["name", "headline", "positions", "skills", "education"],
      why: "Forte volume de leitura (read-heavy); também alimenta o índice de busca",
    },
    {
      entity: "Conexão",
      store: "Banco de grafos",
      key: "memberId → memberId",
      fields: ["since", "type (connection/follow)"],
      why: "Travessias para cálculo de grau de conexão e 'pessoas que talvez você conheça'",
    },
    {
      entity: "Post",
      store: "Banco de colunas largas",
      key: "postId (ordenável por tempo)",
      fields: ["authorId", "text", "media", "createdAt"],
      why: "Alto volume, lido por meio dos feeds",
    },
    {
      entity: "Vaga",
      store: "Índice de busca + banco relacional",
      key: "jobId",
      fields: ["companyId", "title", "location", "skills", "postedAt"],
      why: "Busca em texto completo e por facetas",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Perfis, feed, vagas" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Feed, mensagens, notificações" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Fotos de perfil e mídia" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação e roteamento" },
    { id: "profile-svc", kind: "service", label: "Serviço de perfil", role: "Perfis e configurações" },
    { id: "graph-svc", kind: "service", label: "Serviço de grafo", role: "Conexões e consultas de grau de distância" },
    { id: "graph-db", kind: "graph-db", label: "Grafo de membros", role: "Conexões e seguidores" },
    { id: "feed-svc", kind: "service", label: "Serviço de feed", role: "Coleta e classifica posts" },
    { id: "feed-cache", kind: "cache", label: "Cache do feed", role: "IDs de posts recentes por membro" },
    { id: "jobs-svc", kind: "service", label: "Serviço de vagas", role: "Busca de vagas e candidaturas" },
    { id: "search-index", kind: "search", label: "Índice de pessoas e vagas", role: "Membros e anúncios de vagas" },
    { id: "recommend", kind: "ml-platform", label: "Recomendações", role: "Pessoas que talvez você conheça, compatibilidade de vagas, ranking do feed" },
    { id: "messaging", kind: "realtime-gateway", label: "Mensagens", role: "Conversas em tempo real" },
    { id: "main-db", kind: "relational-db", label: "Perfis e vagas", role: "Com sharding por membro / empresa" },
    { id: "posts-db", kind: "wide-column-db", label: "Posts", role: "Posts e atividades dos membros" },
    { id: "events", kind: "event-stream", label: "Eventos de atividade", role: "Edições de perfil, posts, conexões" },
    { id: "notify", kind: "notifications", label: "Notificações", role: "Convites, mensagens, alertas de vagas" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-profile", from: "gateway", to: "profile-svc", protocol: "grpc" },
    { id: "gateway-graph", from: "gateway", to: "graph-svc", protocol: "grpc" },
    { id: "gateway-feed", from: "gateway", to: "feed-svc", protocol: "grpc" },
    { id: "gateway-jobs", from: "gateway", to: "jobs-svc", protocol: "grpc" },
    { id: "profile-db", from: "profile-svc", to: "main-db" },
    { id: "graph-store", from: "graph-svc", to: "graph-db" },
    { id: "graph-events", from: "graph-svc", to: "events", protocol: "stream" },
    { id: "profile-events", from: "profile-svc", to: "events", protocol: "stream" },
    { id: "feed-cache-read", from: "feed-svc", to: "feed-cache" },
    { id: "feed-posts", from: "feed-svc", to: "posts-db", label: "Hidratar" },
    { id: "feed-recommend", from: "feed-svc", to: "recommend", label: "Classificar" },
    { id: "events-feed", from: "events", to: "feed-cache", label: "Fan-out", protocol: "async" },
    { id: "events-index", from: "events", to: "search-index", protocol: "stream" },
    { id: "events-recommend", from: "events", to: "recommend", protocol: "stream" },
    { id: "jobs-index", from: "jobs-svc", to: "search-index" },
    { id: "jobs-recommend", from: "jobs-svc", to: "recommend", label: "Compatibilidade de vagas" },
    { id: "mobile-messaging", from: "mobile", to: "messaging", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "connect",
      name: "Aceitar uma conexão",
      steps: [
        { edge: "mobile-gateway", text: "O membro aceita um convite de conexão." },
        { edge: "gateway-graph", text: "O serviço de grafo processa a ação." },
        { edge: "graph-store", text: "Uma aresta de conexão é adicionada em ambas as direções." },
        { edge: "graph-events", text: "Um evento de 'conectado' é publicado." },
        { edge: "events-feed", text: "Os posts recentes de cada membro agora podem aparecer no feed do outro." },
        { edge: "events-recommend", text: "A seção 'Pessoas que talvez você conheça' é atualizada a partir das novas conexões de segundo grau." },
        { edge: "events-notify", text: "Quem enviou o convite é notificado." },
      ],
    },
    {
      id: "jobs",
      name: "Encontrar uma vaga",
      steps: [
        { edge: "web-gateway", text: "O membro pesquisa 'engenheiro backend, São Paulo'." },
        { edge: "gateway-jobs", text: "O serviço de vagas executa a busca." },
        { edge: "jobs-index", text: "O índice cruza cargo, localização e competências." },
        { edge: "jobs-recommend", text: "Os resultados são reclassificados pela afinidade com o perfil do membro." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Travessias de grafo em bilhões de arestas",
      fix: "Particionar o grafo por membro, fazer cache das listas de primeiro grau em memória e pré-computar candidatos de segundo grau offline.",
      nodes: ["graph-svc", "graph-db"],
    },
    {
      problem: "Influenciadores com milhões de seguidores",
      fix: "Feed híbrido: buscar seus posts no momento da leitura em vez de fazer fan-out na escrita.",
      nodes: ["feed-svc", "feed-cache"],
    },
    {
      problem: "Atualização da busca após edições no perfil",
      fix: "Transmitir alterações de perfil via stream para o índice em questão de minutos.",
      nodes: ["events", "search-index"],
    },
  ],

  scaling: [
    "Faça sharding de membros, posts e do grafo por memberId.",
    "Pré-compute recomendações offline e sirva a partir do cache.",
    "Separe o sistema de mensagens em sua própria camada em tempo real.",
  ],

  extensions: [
    "Páginas de empresas e ferramentas para recrutadores.",
    "Cursos de aprendizado.",
    "Avaliações e recomendações de competências.",
  ],
};
