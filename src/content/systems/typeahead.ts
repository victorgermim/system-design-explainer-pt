import type { SystemDesignInput } from "@/types/schema";

export const typeahead: SystemDesignInput = {
  slug: "typeahead",
  name: "Autocompletar de busca",
  tagline: "Sugestões a cada tecla digitada em menos de 100 ms",
  description:
    "As sugestões são pré-calculadas: um job offline transforma logs de consultas em tries que guardam as principais completações em cada prefixo, de modo que responder a uma tecla é uma única consulta. Os tries são divididos em shards por prefixo, prefixos quentes ficam em memória e até na borda da CDN, e um job de stream impulsiona consultas que estão em alta agora.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["prefix-trie", "caching", "sharding", "leader-election", "event-driven"],

  requirements: {
    functional: [
      "Retornar as 5–10 principais completações para o texto digitado até o momento",
      "Ranquear por popularidade, atualidade e (opcionalmente) histórico e idioma do usuário",
      "Refletir consultas em alta em poucos minutos",
      "Filtrar sugestões ofensivas ou bloqueadas",
    ],
    nonFunctional: [
      "p99 abaixo de ~100 ms de ponta a ponta para que as sugestões acompanhem a digitação",
      "Muito voltado a leitura: uma requisição por tecla",
      "Altamente disponível; sugestões desatualizadas são aceitáveis, a ausência delas não",
    ],
  },

  apis: [
    { method: "GET", path: "/suggest?q=&locale=&limit=", purpose: "Principais completações para um prefixo (cacheável)" },
    { method: "POST", path: "/search", purpose: "A consulta enviada, que também alimenta o log de consultas" },
  ],

  estimates: [
    { label: "Buscas", value: "≈ 100 M/dia", derivation: "Premissa" },
    { label: "Requisições de sugestão", value: "≈ 10 k/s em média, ~30 k/s no pico", derivation: "100 M de buscas × ~8 teclas ÷ 86.400 s; o debouncing reduz isso" },
    { label: "Tamanho do trie", value: "≈ 10–20 GB por idioma", derivation: "~100 M de consultas distintas × prefixos × listas top-k; dividido entre shards" },
    { label: "Orçamento de latência", value: "< 50 ms no servidor", derivation: "Deixa espaço para a rede dentro de uma meta de 100 ms" },
  ],

  dataModel: [
    {
      entity: "Trie node",
      store: "Key-value store (serialised trie shards)",
      key: "locale + prefix",
      fields: ["topK [{query, score}]", "children"],
      why: "O top-k pré-calculado por prefixo elimina o ranqueamento no momento da consulta",
    },
    {
      entity: "Query log",
      store: "Event stream → object storage",
      key: "time",
      fields: ["query", "locale", "userId?", "clicked"],
      why: "Matéria-prima para reconstruir os tries e identificar tendências",
    },
    {
      entity: "Shard map",
      store: "Coordination store",
      key: "prefix range",
      fields: ["shardId", "trieVersion"],
      why: "Permite que cada servidor roteie um prefixo ao shard certo e troque versões de forma atômica",
    },
  ],

  nodes: [
    { id: "client", kind: "web-client", label: "Caixa de busca", role: "Envia o prefixo após um curto debounce" },
    { id: "edge", kind: "cdn", label: "Cache de borda", role: "Guarda em cache sugestões de prefixos curtos muito comuns" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Roteamento e rate limiting" },
    { id: "suggest-svc", kind: "service", label: "Serviço de sugestões", role: "Encontra o shard de um prefixo e retorna seu top-k" },
    { id: "hot-cache", kind: "cache", label: "Cache de prefixos quentes", role: "Top-k em memória para os prefixos mais digitados" },
    { id: "trie-store", kind: "nosql-db", label: "Shards de trie", role: "Tries serializados, divididos por faixa de prefixo" },
    { id: "shard-map", kind: "coordination", label: "Mapa de shards", role: "Faixa de prefixo → shard e versão ativa do trie" },
    { id: "query-log", kind: "event-stream", label: "Log de consultas", role: "Cada busca enviada" },
    { id: "log-archive", kind: "object-storage", label: "Arquivo de logs", role: "Dias de histórico de consultas para reconstrução" },
    { id: "builder", kind: "batch-processing", label: "Construtor de tries", role: "Agrega logs e constrói novos tries offline" },
    { id: "trending", kind: "stream-processor", label: "Detector de tendências", role: "Conta consultas em janelas curtas e impulsiona picos" },
  ],

  edges: [
    { id: "client-edge", from: "client", to: "edge", label: "GET /suggest" },
    { id: "edge-gateway", from: "edge", to: "gateway", label: "Miss" },
    { id: "gateway-suggest", from: "gateway", to: "suggest-svc", protocol: "grpc" },
    { id: "suggest-shardmap", from: "suggest-svc", to: "shard-map", label: "Qual shard?" },
    { id: "suggest-cache", from: "suggest-svc", to: "hot-cache" },
    { id: "suggest-trie", from: "suggest-svc", to: "trie-store" },
    { id: "gateway-log", from: "gateway", to: "query-log", label: "Buscas enviadas", protocol: "stream" },
    { id: "log-archive-write", from: "query-log", to: "log-archive", protocol: "stream" },
    { id: "archive-builder", from: "log-archive", to: "builder", label: "Logs diários" },
    { id: "builder-trie", from: "builder", to: "trie-store", label: "Publicar novos tries" },
    { id: "builder-shardmap", from: "builder", to: "shard-map", label: "Trocar versão" },
    { id: "log-trending", from: "query-log", to: "trending", protocol: "stream" },
    { id: "trending-cache", from: "trending", to: "hot-cache", label: "Impulsionar tendências" },
  ],

  flows: [
    {
      id: "suggest",
      name: "Digitar uma letra",
      steps: [
        { edge: "client-edge", text: "Após ~100 ms sem digitar, a caixa envia o prefixo; prefixos muito comuns são respondidos na borda." },
        { edge: "edge-gateway", text: "Prefixos menos comuns chegam ao gateway." },
        { edge: "gateway-suggest", text: "O serviço de sugestões recebe a requisição." },
        { edge: "suggest-shardmap", text: "Seu mapa de shards em cache local informa qual shard é dono desse prefixo." },
        { edge: "suggest-cache", text: "Prefixos quentes vêm direto da memória…" },
        { edge: "suggest-trie", text: "…os demais são uma única consulta no shard do trie, que já guarda a lista top-k." },
      ],
    },
    {
      id: "rebuild",
      name: "Atualizar as sugestões",
      steps: [
        { edge: "gateway-log", text: "Cada busca enviada é registrada no log." },
        { edge: "log-archive-write", text: "Os logs são arquivados no object storage." },
        { edge: "archive-builder", text: "Um job diário conta as consultas com decaimento no tempo e filtra termos bloqueados." },
        { edge: "builder-trie", text: "Ele constrói novos tries com listas top-k em cada prefixo e os envia." },
        { edge: "builder-shardmap", text: "O mapa de shards muda para a nova versão de forma atômica." },
        { edge: "log-trending", text: "Enquanto isso, um job de stream observa picos repentinos…" },
        { edge: "trending-cache", text: "…e injeta consultas em alta no cache quente em poucos minutos." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Uma requisição a cada tecla",
      fix: "Fazer debounce no cliente, colocar prefixos curtos em cache na borda e em memória, e manter as consultas em O(tamanho do prefixo).",
      nodes: ["client", "edge", "hot-cache"],
    },
    {
      problem: "Shards desiguais (muito mais consultas começam com 's' do que com 'x')",
      fix: "Dividir pelo tráfego medido em vez do alfabeto, e replicar os shards quentes.",
      nodes: ["trie-store", "shard-map"],
    },
    {
      problem: "Os tries ficam desatualizados entre reconstruções",
      fix: "Combinar uma camada rápida de tendências por cima da construção diária.",
      nodes: ["trending", "hot-cache"],
    },
  ],

  scaling: [
    "Replicar cada shard de trie várias vezes e fazer load balancing das leituras.",
    "Construir tries por idioma e servi-los a partir da região mais próxima.",
    "Servidores de sugestão stateless escalam horizontalmente.",
    "Reconstruir offline para que o atendimento de consultas nunca concorra com o trabalho de agregação.",
  ],

  extensions: [
    "Sugestões personalizadas combinadas com o histórico do próprio usuário.",
    "Correção ortográfica para erros de digitação.",
    "Sugestões ricas (entidades com imagens) para pessoas, lugares e produtos.",
  ],
};
