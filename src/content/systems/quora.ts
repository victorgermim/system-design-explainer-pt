import type { SystemDesignInput } from "@/types/schema";

export const quora: SystemDesignInput = {
  slug: "quora",
  name: "Quora",
  tagline: "Perguntas, respostas, votos e um feed personalizado",
  description:
    "Quando alguém faz uma pergunta, a busca primeiro sugere perguntas semelhantes já existentes para evitar duplicatas. Novas perguntas e respostas são armazenadas em tabelas relacionais com sharding, indexadas para busca e distribuídas (fan-out) aos seguidores do tópico. Os votos são contados em um cache rápido e incorporados a um modelo de ranking que ordena as respostas e monta o feed de cada leitor.",
  category: "media-social",
  difficulty: 2,
  concepts: ["fan-out", "search-indexing", "caching", "sharding", "event-driven"],

  requirements: {
    functional: [
      "Fazer perguntas com tópicos; receber sugestões de duplicatas enquanto digita",
      "Responder, comentar, votar positivo e negativo",
      "Seguir tópicos, perguntas e pessoas",
      "Feed inicial personalizado e ranking de respostas",
      "Buscar perguntas, notificações de respostas e menções",
    ],
    nonFunctional: [
      "Muito mais leitura que escrita: respostas são lidas muitas vezes mais do que escritas",
      "O feed carrega rápido; a contagem de votos pode atrasar um pouco",
      "Spam e conteúdo de baixa qualidade mantidos fora",
    ],
  },

  apis: [
    { method: "GET", path: "/questions/similar?q=", purpose: "Possíveis duplicatas enquanto digita" },
    { method: "POST", path: "/questions", purpose: "Fazer uma pergunta com tópicos" },
    { method: "POST", path: "/questions/{id}/answers", purpose: "Publicar uma resposta" },
    { method: "POST", path: "/answers/{id}/vote", purpose: "Voto positivo ou negativo (idempotente por usuário)" },
    { method: "GET", path: "/feed?cursor=", purpose: "Feed personalizado" },
  ],

  estimates: [
    { label: "Usuários diários", value: "≈ 100 M", derivation: "Premissa" },
    { label: "Novas respostas", value: "≈ 1 M/dia", derivation: "Premissa; ~12/s" },
    { label: "Leituras de respostas", value: "≈ 50 k/s", derivation: "100 M usuários × ~40 respostas vistas ÷ 86.400 s" },
    { label: "Votos", value: "≈ 2 k/s", derivation: "Premissa" },
  ],

  dataModel: [
    {
      entity: "Pergunta / Resposta",
      store: "Relational DB, sharded by questionId",
      key: "questionId (+ answerId)",
      fields: ["authorId", "text", "topics", "createdAt", "score"],
      why: "Uma pergunta e suas respostas ficam em um único shard",
    },
    {
      entity: "Voto",
      store: "Wide-column DB + cached counters",
      key: "answerId + userId",
      fields: ["value"],
      why: "Um voto por usuário; os totais são mantidos como contadores",
    },
    {
      entity: "Seguir",
      store: "Relational DB",
      key: "userId + topicId/questionId/userId",
      fields: ["createdAt"],
      why: "Alimenta o fan-out do feed e as notificações",
    },
    {
      entity: "Item do feed",
      store: "In-memory cache",
      key: "userId",
      fields: ["itemIds with scores"],
      why: "Candidatos pré-montados para leituras rápidas do feed",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Ler, perguntar, responder" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Ler, perguntar, responder" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Imagens e assets estáticos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits" },
    { id: "qa-svc", kind: "service", label: "Serviço de P&R", role: "Perguntas, respostas, comentários" },
    { id: "vote-svc", kind: "service", label: "Serviço de votos", role: "Registra votos e atualiza contadores" },
    { id: "feed-svc", kind: "service", label: "Serviço de feed", role: "Monta e ranqueia o feed de cada usuário" },
    { id: "search-svc", kind: "service", label: "Serviço de busca", role: "Busca e detecção de duplicatas" },
    { id: "search-index", kind: "search", label: "Índice de perguntas", role: "Perguntas e respostas por texto" },
    { id: "ranking", kind: "ml-platform", label: "Modelos de ranking", role: "Qualidade das respostas e relevância do feed" },
    { id: "main-db", kind: "relational-db", label: "Perguntas, respostas e follows", role: "Armazenamento relacional com sharding" },
    { id: "votes-db", kind: "wide-column-db", label: "Votos e atividade", role: "Atividade de alto volume" },
    { id: "counters", kind: "cache", label: "Contadores e feeds", role: "Contagem de votos e feeds pré-montados" },
    { id: "events", kind: "event-stream", label: "Eventos de conteúdo", role: "Novas perguntas, respostas, votos" },
    { id: "fanout", kind: "service", label: "Workers de fan-out", role: "Enviam novo conteúdo aos feeds dos seguidores do tópico" },
    { id: "notify", kind: "notifications", label: "Notificações", role: "Novas respostas e menções" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-qa", from: "gateway", to: "qa-svc", protocol: "grpc" },
    { id: "gateway-vote", from: "gateway", to: "vote-svc", protocol: "grpc" },
    { id: "gateway-feed", from: "gateway", to: "feed-svc", protocol: "grpc" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index-read", from: "search-svc", to: "search-index" },
    { id: "qa-db", from: "qa-svc", to: "main-db" },
    { id: "qa-events", from: "qa-svc", to: "events", protocol: "stream" },
    { id: "vote-db", from: "vote-svc", to: "votes-db" },
    { id: "vote-counters", from: "vote-svc", to: "counters", label: "Incrementar" },
    { id: "vote-events", from: "vote-svc", to: "events", protocol: "stream" },
    { id: "events-index", from: "events", to: "search-index", protocol: "stream" },
    { id: "events-fanout", from: "events", to: "fanout", protocol: "async" },
    { id: "fanout-counters", from: "fanout", to: "counters", label: "Candidatos do feed" },
    { id: "events-ranking", from: "events", to: "ranking", label: "Sinais", protocol: "stream" },
    { id: "feed-counters", from: "feed-svc", to: "counters" },
    { id: "feed-ranking", from: "feed-svc", to: "ranking", label: "Pontuar" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "ask",
      name: "Fazer uma pergunta",
      steps: [
        { edge: "web-gateway", text: "Enquanto o usuário digita, perguntas semelhantes são sugeridas." },
        { edge: "gateway-search", text: "O serviço de busca verifica duplicatas." },
        { edge: "search-index-read", text: "Os resultados próximos são exibidos; o usuário decide publicar mesmo assim." },
        { edge: "gateway-qa", text: "A pergunta é publicada com tópicos." },
        { edge: "qa-db", text: "Ela é armazenada no seu shard." },
        { edge: "qa-events", text: "Um evento de 'nova pergunta' é publicado." },
        { edge: "events-index", text: "Ela passa a ser pesquisável." },
        { edge: "events-fanout", text: "Os workers de fan-out a adicionam aos candidatos do feed dos seguidores do tópico." },
        { edge: "fanout-counters", text: "Os feeds são atualizados no cache." },
      ],
    },
    {
      id: "feed",
      name: "Ler o feed",
      steps: [
        { edge: "mobile-gateway", text: "O usuário abre o app." },
        { edge: "gateway-feed", text: "O serviço de feed reúne os candidatos." },
        { edge: "feed-counters", text: "Os candidatos pré-montados e a contagem de votos vêm do cache." },
        { edge: "feed-ranking", text: "O modelo de ranking os ordena para este usuário." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Respostas populares recebendo muitos votos",
      fix: "Contar no cache, persistir os votos de forma assíncrona e recalcular as pontuações em lotes.",
      nodes: ["vote-svc", "counters"],
    },
    {
      problem: "Perguntas duplicadas",
      fix: "Busca por similaridade durante a digitação e mesclagem das duplicatas depois.",
      nodes: ["search-svc", "search-index"],
    },
    {
      problem: "Tópicos populares com milhões de seguidores",
      fix: "Buscar o conteúdo do tópico no momento da leitura (pull) para tópicos muito grandes, em vez de fazer fan-out.",
      nodes: ["fanout", "feed-svc"],
    },
  ],

  scaling: [
    "Fazer sharding das perguntas por questionId; manter perguntas populares em cache.",
    "Separar a atividade com muita escrita (votos, visualizações) do armazenamento de conteúdo.",
    "Usar coordenação (ZooKeeper) para os mapas de shards e a eleição de líder em jobs em segundo plano.",
  ],

  extensions: [
    "Spaces (comunidades) com feeds próprios.",
    "Pedir respostas a especialistas.",
    "Tradução automática das respostas.",
  ],
};
