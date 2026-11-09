import type { SystemDesignInput } from "@/types/schema";

export const twitter: SystemDesignInput = {
  slug: "twitter",
  name: "Twitter / X",
  tagline: "Posts curtos, grafo de seguidores e timelines iniciais em tempo real",
  description:
    "Cada tweet recebe um ID ordenável por tempo e é armazenado uma única vez; depois, um serviço de fan-out copia o ID para a timeline inicial em cache de cada seguidor, de modo que ler uma timeline é uma única consulta. Contas com muitos seguidores são tratadas ao contrário: seus tweets são mesclados quando um seguidor lê. Um processador de streams conta hashtags para destacar os assuntos do momento.",
  category: "media-social",
  difficulty: 3,
  concepts: ["fan-out", "id-generation", "caching", "consistent-hashing", "event-driven", "search-indexing"],

  requirements: {
    functional: [
      "Publicar tweets curtos com imagens opcionais, respostas e retweets",
      "Seguir e deixar de seguir usuários",
      "Timeline inicial com tweets de quem você segue, os mais recentes (ou mais relevantes) primeiro",
      "Timeline do usuário mostrando os tweets de uma pessoa",
      "Curtir e retweetar; buscar tweets e hashtags; ver os assuntos do momento",
    ],
    nonFunctional: [
      "Extremamente voltado a leitura: as leituras de timeline superam os tweets em ~10×",
      "A timeline inicial carrega em algumas centenas de milissegundos",
      "Um novo tweet deve chegar aos seguidores em segundos (consistência eventual é aceitável)",
      "Altamente disponível; tweets nunca são perdidos após confirmados",
    ],
  },

  apis: [
    { method: "POST", path: "/tweets", purpose: "Publicar um tweet (texto, IDs de mídia, replyTo); retorna o tweetId" },
    { method: "GET", path: "/timeline/home?cursor=", purpose: "Timeline inicial, paginada por cursor de tweetId" },
    { method: "GET", path: "/users/{userId}/tweets?cursor=", purpose: "Os tweets de um usuário" },
    { method: "POST", path: "/users/{userId}/follow", purpose: "Seguir um usuário" },
    { method: "POST", path: "/tweets/{tweetId}/like", purpose: "Curtir (idempotente)" },
    { method: "POST", path: "/tweets/{tweetId}/retweet", purpose: "Retweetar" },
    { method: "GET", path: "/search?q=", purpose: "Buscar tweets e hashtags" },
    { method: "GET", path: "/trends?location=", purpose: "Assuntos do momento" },
  ],

  estimates: [
    { label: "Usuários ativos diários", value: "≈ 200 M", derivation: "Premissa" },
    { label: "Tweets por dia", value: "≈ 1 B (~12 k/s)", derivation: "200 M usuários × ~5 tweets ÷ 86.400 s" },
    { label: "Leituras de timeline", value: "≈ 115 k/s", derivation: "200 M usuários × 50 tweets vistos ÷ 86.400 s" },
    { label: "Armazenamento de tweets", value: "≈ 200 GB/dia", derivation: "1 B de tweets × ~200 bytes (texto + metadados)" },
    { label: "Armazenamento de mídia", value: "≈ 5 TB/dia", derivation: "10% dos tweets com mídia × ~50 KB" },
  ],

  dataModel: [
    {
      entity: "Tweet",
      store: "Wide-column DB",
      key: "tweetId (Snowflake: time + machine + sequence)",
      fields: ["authorId", "text", "mediaUrls", "replyTo", "retweetOf", "createdAt"],
      why: "Enorme volume de escrita; os IDs ordenam por tempo, então não é preciso um índice extra de timestamp",
    },
    {
      entity: "User tweets index",
      store: "Wide-column DB",
      key: "authorId + tweetId",
      fields: ["tweetId"],
      why: "Atende a timeline do usuário e a mesclagem de celebridades em uma única varredura de intervalo",
    },
    {
      entity: "User",
      store: "Relational DB",
      key: "userId",
      fields: ["handle", "name", "bio", "followerCount", "isCelebrity"],
      why: "Handles únicos, atualizações transacionais",
    },
    {
      entity: "Follow",
      store: "Relational or graph store",
      key: "followerId + followeeId",
      fields: ["createdAt"],
      why: "As duas direções são necessárias: o fan-out usa seguidores, as leituras usam seguidos",
    },
    {
      entity: "Home timeline",
      store: "In-memory cache (list per user)",
      key: "userId",
      fields: ["last ~800 tweetIds"],
      why: "Pré-calculada para que a leitura seja uma única consulta; reconstruída a partir do banco se for removida",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Publicar e rolar timelines" },
    { id: "web", kind: "web-client", label: "App web", role: "Publicar e rolar timelines" },
    { id: "cdn", kind: "cdn", label: "CDN de mídia", role: "Imagens, vídeos e avatares" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Distribui o tráfego da API" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limiting, roteamento" },
    { id: "tweet-svc", kind: "service", label: "Serviço de tweets", role: "Valida tweets e atribui IDs Snowflake" },
    { id: "timeline-svc", kind: "service", label: "Serviço de timeline", role: "Lê timelines em cache e mescla tweets de celebridades" },
    { id: "user-svc", kind: "service", label: "Serviço de usuários e grafo", role: "Perfis e relações de seguidores" },
    { id: "fanout", kind: "service", label: "Serviço de fan-out", role: "Copia IDs de novos tweets para as timelines dos seguidores" },
    { id: "search-svc", kind: "service", label: "Serviço de busca", role: "Busca de texto completo em tweets recentes" },
    { id: "events", kind: "event-stream", label: "Eventos de tweets", role: "Todo novo tweet, curtida e follow" },
    { id: "trends", kind: "stream-processor", label: "Assuntos do momento", role: "Conta hashtags em janelas deslizantes por região" },
    { id: "tweet-store", kind: "wide-column-db", label: "Armazenamento de tweets", role: "Todos os tweets, mais um índice por autor" },
    { id: "user-db", kind: "relational-db", label: "Usuários e follows", role: "Perfis e o grafo de seguidores" },
    { id: "timeline-cache", kind: "cache", label: "Timelines iniciais", role: "IDs de tweets recentes por usuário" },
    { id: "search-index", kind: "search", label: "Índice de busca", role: "Tweets recentes por termo e hashtag" },
    { id: "media-store", kind: "object-storage", label: "Armazenamento de mídia", role: "Imagens e vídeos enviados" },
  ],

  edges: [
    { id: "mobile-lb", from: "mobile", to: "lb", label: "API" },
    { id: "web-lb", from: "web", to: "lb" },
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Mídia" },
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "lb-gateway", from: "lb", to: "gateway" },
    { id: "gateway-tweet", from: "gateway", to: "tweet-svc", protocol: "grpc" },
    { id: "gateway-timeline", from: "gateway", to: "timeline-svc", protocol: "grpc" },
    { id: "gateway-user", from: "gateway", to: "user-svc", protocol: "grpc" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "tweet-store-write", from: "tweet-svc", to: "tweet-store" },
    { id: "tweet-media", from: "tweet-svc", to: "media-store", label: "Mídia" },
    { id: "tweet-events", from: "tweet-svc", to: "events", label: "Novo tweet", protocol: "stream" },
    { id: "events-fanout", from: "events", to: "fanout", protocol: "async" },
    { id: "fanout-followers", from: "fanout", to: "user-db", label: "Seguidores" },
    { id: "fanout-cache", from: "fanout", to: "timeline-cache", label: "Enviar IDs de tweets" },
    { id: "timeline-cache-read", from: "timeline-svc", to: "timeline-cache" },
    { id: "timeline-celebs", from: "timeline-svc", to: "tweet-store", label: "Tweets de celebridades + hidratação" },
    { id: "user-db-rw", from: "user-svc", to: "user-db" },
    { id: "events-search", from: "events", to: "search-index", label: "Indexar", protocol: "stream" },
    { id: "search-read", from: "search-svc", to: "search-index" },
    { id: "events-trends", from: "events", to: "trends", protocol: "stream" },
    { id: "cdn-origin", from: "cdn", to: "media-store", label: "Origem" },
  ],

  flows: [
    {
      id: "tweet",
      name: "Publicar um tweet",
      steps: [
        { edge: "mobile-lb", text: "O usuário publica um tweet." },
        { edge: "lb-gateway", text: "O gateway autentica e aplica rate limiting." },
        { edge: "gateway-tweet", text: "O serviço de tweets valida o texto e atribui um ID Snowflake." },
        { edge: "tweet-store-write", text: "O tweet é armazenado uma única vez no armazenamento de tweets." },
        { edge: "tweet-events", text: "Um evento de 'novo tweet' é publicado; o usuário recebe uma resposta de sucesso." },
        { edge: "events-fanout", text: "O serviço de fan-out o recebe." },
        { edge: "fanout-followers", text: "Ele consulta os seguidores do autor (ignorado para celebridades)." },
        { edge: "fanout-cache", text: "Ele insere o ID do tweet no início da timeline inicial em cache de cada seguidor." },
        { edge: "events-search", text: "Em paralelo, o tweet é indexado para busca…" },
        { edge: "events-trends", text: "…e suas hashtags são contadas para os assuntos do momento." },
      ],
    },
    {
      id: "home",
      name: "Ler a timeline inicial",
      steps: [
        { edge: "mobile-lb", text: "O app solicita a timeline inicial." },
        { edge: "lb-gateway", text: "A requisição é autenticada e roteada." },
        { edge: "gateway-timeline", text: "O serviço de timeline a processa." },
        { edge: "timeline-cache-read", text: "Ele lê a lista em cache de IDs de tweets do usuário." },
        { edge: "timeline-celebs", text: "Ele mescla tweets recentes de celebridades seguidas e hidrata os IDs em tweets completos." },
        { edge: "mobile-cdn", text: "As imagens são carregadas da CDN." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Um tweet de uma conta com 100 M de seguidores significa 100 M de escritas no cache",
      fix: "Pular o fan-out para celebridades; mesclar seus tweets recentes no momento da leitura (híbrido push/pull).",
      nodes: ["fanout", "timeline-svc", "timeline-cache"],
    },
    {
      problem: "Memória do cache de timeline para todos os usuários",
      fix: "Manter apenas os últimos poucos centenas de IDs, e só para usuários ativos recentemente; reconstruir sob demanda para os demais.",
      nodes: ["timeline-cache"],
    },
    {
      problem: "Tweets populares (posts virais) criam hotspots de leitura",
      fix: "Colocar em cache objetos de tweets hidratados e contadores; replicar chaves quentes entre os nós de cache.",
      nodes: ["tweet-store", "timeline-cache"],
    },
    {
      problem: "A geração central de IDs limitaria o throughput de escrita",
      fix: "Os IDs Snowflake são gerados de forma independente em cada máquina a partir de tempo + worker id + sequência.",
      nodes: ["tweet-svc"],
    },
  ],

  scaling: [
    "Fazer sharding dos tweets por tweetId e do índice por autor por authorId.",
    "Particionar o cache de timeline por userId com consistent hashing; replicar para disponibilidade.",
    "Executar o fan-out como muitos consumidores paralelos em um stream de eventos particionado; o atraso só posterga a entrega.",
    "Réplicas de leitura para dados de usuários; serviços stateless com autoscaling atrás de load balancers.",
    "Implantação multirregião com dados replicados de forma assíncrona entre as regiões.",
  ],

  extensions: [
    "Timelines ranqueadas ('Para você') pontuadas por um modelo de ML em vez de pura ordem cronológica.",
    "Notificações de menções, curtidas e novos seguidores.",
    "Mensagens diretas sobre conexões persistentes.",
    "Detecção de spam e abuso no stream de eventos.",
  ],
};
