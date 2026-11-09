import type { SystemDesignInput } from "@/types/schema";

export const liveSports: SystemDesignInput = {
  slug: "live-sports",
  name: "Placares esportivos ao vivo",
  tagline: "Placares em tempo real, lance a lance e alertas para milhões de pessoas",
  description:
    "Marcadores oficiais e parceiros de dados enviam cada bola, gol ou ponto para um serviço de ingestão. Os eventos fluem por um stream onde um processador atualiza o estado da partida e as estatísticas. O novo placar vai para um cache, é enviado via WebSockets para todos que estão acompanhando e dispara notificações push nos grandes momentos — enquanto snapshots ficam em cache na CDN para os demais usuários.",
  category: "media-social",
  difficulty: 2,
  concepts: ["websockets", "event-driven", "caching", "back-pressure", "fan-out"],

  requirements: {
    functional: [
      "Placares ao vivo, lance a lance e comentários para várias partidas simultâneas",
      "Estatísticas de jogadores e equipes atualizadas em tempo real",
      "Alertas push para gols, pontos importantes e resultados finais",
      "Calendários, tabelas de jogos e classificação",
      "Ferramentas administrativas para marcadores oficiais corrigirem erros",
    ],
    nonFunctional: [
      "As atualizações chegam aos espectadores em 1–2 segundos",
      "Picos enormes durante grandes jogos (dezenas de milhões assistindo)",
      "Eventos aplicados em ordem; correções devem ser propagadas",
    ],
  },

  apis: [
    { method: "POST", path: "/ingest/matches/{id}/events", purpose: "Marcador ou parceiro envia um evento de lance/gol (com número de sequência)" },
    { method: "GET", path: "/matches/{id}", purpose: "Snapshot atual (em cache na CDN por um ou dois segundos)" },
    { method: "WS", path: "/matches/{id}/live", purpose: "Inscrever-se para receber atualizações ao vivo" },
    { method: "GET", path: "/matches/{id}/commentary?after=", purpose: "Histórico de lance a lance" },
  ],

  estimates: [
    { label: "Espectadores durante uma final", value: "≈ 20–50 M", derivation: "Estimativa para uma grande partida" },
    { label: "Eventos de placar", value: "≈ 1 a cada poucos segundos por partida", derivation: "Baixo volume de entrada" },
    { label: "Fan-out de push", value: "≈ 10–50 M de mensagens por evento", derivation: "Cada espectador recebe cada atualização" },
    { label: "Rajadas de alertas", value: "≈ 50 M de notificações em segundos", derivation: "Um alerta de gol para todos os seguidores" },
  ],

  dataModel: [
    {
      entity: "Evento da partida",
      store: "Banco de séries temporais (Time-series DB)",
      key: "matchId + sequence",
      fields: ["type", "payload", "time", "correctionOf?"],
      why: "Lance a lance ordenado; correções fazem referência a eventos anteriores",
    },
    {
      entity: "Estado da partida",
      store: "Cache em memória",
      key: "matchId",
      fields: ["score", "clock", "lastSequence", "keyStats"],
      why: "Lido por milhões; reconstruído a partir dos eventos caso seja perdido",
    },
    {
      entity: "Tabela de jogos / classificação",
      store: "Banco chave-valor",
      key: "competitionId",
      fields: ["matches", "table"],
      why: "Majoritariamente estático, fortemente mantido em cache",
    },
  ],

  nodes: [
    { id: "scorer", kind: "web-client", label: "App do marcador oficial", role: "Registra cada evento no estádio" },
    { id: "partners", kind: "partner-api", label: "Parceiros de dados", role: "Feeds de dados licenciados" },
    { id: "viewers", kind: "mobile-client", label: "Apps de torcedores", role: "Acompanham placares e comentários" },
    { id: "web", kind: "web-client", label: "Web", role: "Placares e estatísticas" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Snapshots com TTL curto para carregamento de páginas" },
    { id: "ingest", kind: "service", label: "Serviço de ingestão", role: "Valida, ordena e deduplica eventos" },
    { id: "stream", kind: "event-stream", label: "Stream de eventos da partida", role: "Eventos ordenados por partida" },
    { id: "processor", kind: "stream-processor", label: "Processador de estado da partida", role: "Aplica eventos e atualiza estatísticas" },
    { id: "state", kind: "cache", label: "Estado da partida", role: "Placar mais recente por partida" },
    { id: "history", kind: "time-series-db", label: "Lance a lance", role: "Todos os eventos para replay e estatísticas" },
    { id: "api", kind: "service", label: "API de placares", role: "Snapshots e histórico" },
    { id: "ws", kind: "realtime-gateway", label: "Gateway ao vivo", role: "Envia atualizações para os inscritos" },
    { id: "notify", kind: "notifications", label: "Alertas push", role: "Alertas de gols e resultados" },
  ],

  edges: [
    { id: "scorer-ingest", from: "scorer", to: "ingest", label: "Eventos" },
    { id: "partners-ingest", from: "partners", to: "ingest", label: "Feeds" },
    { id: "ingest-stream", from: "ingest", to: "stream", protocol: "stream" },
    { id: "stream-processor", from: "stream", to: "processor", protocol: "stream" },
    { id: "processor-state", from: "processor", to: "state" },
    { id: "processor-history", from: "processor", to: "history" },
    { id: "processor-ws", from: "processor", to: "ws", label: "Atualizações", protocol: "stream" },
    { id: "processor-notify", from: "processor", to: "notify", label: "Grandes momentos", protocol: "async" },
    { id: "viewers-ws", from: "viewers", to: "ws", protocol: "ws" },
    { id: "web-cdn", from: "web", to: "cdn", label: "Snapshot" },
    { id: "cdn-api", from: "cdn", to: "api" },
    { id: "api-state", from: "api", to: "state" },
    { id: "api-history", from: "api", to: "history" },
  ],

  flows: [
    {
      id: "goal",
      name: "Um gol é marcado",
      steps: [
        { edge: "scorer-ingest", text: "O marcador oficial registra um gol com o próximo número de sequência." },
        { edge: "ingest-stream", text: "A ingestão valida e publica o evento na partição da partida, mantendo a ordem." },
        { edge: "stream-processor", text: "O processador aplica o evento ao estado da partida." },
        { edge: "processor-state", text: "O novo placar é gravado no cache." },
        { edge: "processor-history", text: "O evento é adicionado ao histórico de lance a lance." },
        { edge: "processor-ws", text: "A atualização é enviada para todos os inscritos ao vivo…" },
        { edge: "viewers-ws", text: "…e os torcedores veem 1–0 em um ou dois segundos." },
        { edge: "processor-notify", text: "Seguidores de ambas as equipes recebem um alerta push." },
        { edge: "web-cdn", text: "Qualquer pessoa que abrir a página depois recebe um snapshot com no máximo dois segundos de idade." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Fan-out para dezenas de milhões de pessoas simultaneamente",
      fix: "Inscrições em tópicos por partida em um gateway escalado horizontalmente; envio de pequenos diffs.",
      nodes: ["ws"],
    },
    {
      problem: "Avalanches de carregamento de página no apito inicial",
      fix: "Servir snapshots a partir da CDN com TTLs de 1–2 segundos para que a origem receba apenas um fluxo mínimo.",
      nodes: ["cdn", "api"],
    },
    {
      problem: "Eventos fora de ordem ou duplicados vindos de múltiplas fontes",
      fix: "Números de sequência por partida, deduplicação na ingestão e eventos de correção que reescrevem o estado.",
      nodes: ["ingest", "processor"],
    },
  ],

  scaling: [
    "Particione o stream de eventos por matchId.",
    "Escale os gateways pelo número de inscritos; faça pré-aquecimento (pre-warm) antes de grandes jogos.",
    "Reconstrua o estado da partida a partir do log de eventos se o cache for perdido.",
  ],

  extensions: [
    "Pontuação de fantasy games a partir dos mesmos eventos.",
    "Modelos de probabilidade de vitória ao vivo.",
    "Clipes de vídeo com melhores momentos vinculados aos eventos.",
  ],
};
