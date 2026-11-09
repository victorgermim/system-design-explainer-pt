import type { SystemDesignInput } from "@/types/schema";

export const astrotalk: SystemDesignInput = {
  slug: "astrotalk",
  name: "AstroTalk",
  tagline: "Chat e chamadas com astrólogos, cobrados por minuto",
  description:
    "Os usuários recarregam uma carteira pré-paga e iniciam sessões de chat, voz ou vídeo com astrólogos online, cobradas por minuto. Antes de uma sessão começar, o sistema reserva saldo suficiente para alguns minutos; um serviço de medição então debita cada minuto no ledger e encerra a sessão quando o saldo acaba. Os chats rodam sobre WebSockets, as chamadas sobre WebRTC ou um parceiro de telefonia, e os mapas astrais são calculados sob demanda.",
  category: "bookings",
  difficulty: 2,
  concepts: ["websockets", "ledger", "idempotency", "webrtc", "event-driven"],

  requirements: {
    functional: [
      "Navegar pelos astrólogos por idioma, especialidade, preço e avaliação; ver quem está online",
      "Carteira pré-paga com recargas",
      "Sessões instantâneas de chat, voz ou vídeo cobradas por minuto",
      "Sessões agendadas, mapas astrais (kundli) e horóscopos",
      "Ganhos e repasses dos astrólogos",
    ],
    nonFunctional: [
      "A cobrança é exata: nunca cobrar por tempo não entregue, nunca deixar o saldo ficar negativo",
      "Milhares de sessões simultâneas com mensagens em tempo real",
      "Status online do astrólogo preciso em questão de segundos",
    ],
  },

  apis: [
    { method: "GET", path: "/astrologers?online=true&lang=", purpose: "Astrólogos disponíveis com preço por minuto" },
    { method: "POST", path: "/wallet/topups", purpose: "Adiciona dinheiro à carteira" },
    { method: "POST", path: "/sessions", purpose: "Inicia um chat/chamada; reserva saldo para os primeiros minutos" },
    { method: "WS", path: "/sessions/{id}/chat", purpose: "Mensagens, indicador de digitação, cronômetro da sessão" },
    { method: "POST", path: "/sessions/{id}/end", purpose: "Encerra e liquida a sessão" },
  ],

  estimates: [
    { label: "Sessões", value: "≈ 100 mil/dia", derivation: "Suposição" },
    { label: "Sessões simultâneas", value: "≈ 5–10 mil no pico", derivation: "Média de ~10 minutos, pico à noite" },
    { label: "Ciclos de cobrança", value: "≈ 170/s no pico", derivation: "10 mil sessões ÷ uma cobrança por minuto" },
    { label: "Astrólogos online", value: "≈ 5 mil", derivation: "Suposição" },
  ],

  dataModel: [
    {
      entity: "Ledger da carteira",
      store: "Banco relacional (somente acréscimo)",
      key: "entryId",
      fields: ["userId", "amount", "type (topup/charge/refund)", "sessionId", "minute"],
      why: "Saldos derivados dos lançamentos; (sessionId, minute) é único, então um minuto não pode ser cobrado duas vezes",
    },
    {
      entity: "Sessão",
      store: "Banco relacional",
      key: "sessionId",
      fields: ["userId", "astrologerId", "mode", "ratePerMin", "startedAt", "endedAt", "status"],
      why: "Ciclo de vida e base da cobrança",
    },
    {
      entity: "Presença",
      store: "Cache em memória",
      key: "astrologerId",
      fields: ["status (online/busy/offline)", "lastSeen"],
      why: "Atualizado o tempo todo; lido a cada navegação",
    },
  ],

  nodes: [
    { id: "user", kind: "mobile-client", label: "App do usuário", role: "Navegar, recarregar, conversar e ligar" },
    { id: "astrologer", kind: "mobile-client", label: "App do astrólogo", role: "Ficar online, atender sessões, ver ganhos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação e roteamento" },
    { id: "discovery", kind: "service", label: "Descoberta", role: "Lista astrólogos com presença em tempo real" },
    { id: "presence", kind: "cache", label: "Presença", role: "Status online/ocupado" },
    { id: "session-svc", kind: "service", label: "Serviço de sessões", role: "Inicia, acompanha e encerra sessões" },
    { id: "wallet-svc", kind: "service", label: "Serviço de carteira", role: "Saldo, reservas e recargas" },
    { id: "meter", kind: "service", label: "Medidor de cobrança", role: "Cobra cada minuto; encerra sessões com saldo baixo" },
    { id: "ledger", kind: "relational-db", label: "Ledger da carteira", role: "Movimentações da carteira em partidas dobradas" },
    { id: "chat", kind: "realtime-gateway", label: "Gateway de chat", role: "Mensagens e cronômetros da sessão" },
    { id: "calls", kind: "webrtc-media", label: "Chamadas (WebRTC / telefonia)", role: "Sessões de voz e vídeo" },
    { id: "charts", kind: "serverless", label: "Cálculo de mapas", role: "Mapas astrais a partir de data, hora e local" },
    { id: "payment-svc", kind: "service", label: "Recargas e repasses", role: "Recargas da carteira, repasses aos astrólogos" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões" },
    { id: "events", kind: "event-stream", label: "Eventos de sessão", role: "Iniciada, minuto cobrado, encerrada" },
    { id: "notify", kind: "notifications", label: "Push", role: "Solicitações de sessão e ofertas" },
  ],

  edges: [
    { id: "user-gateway", from: "user", to: "gateway" },
    { id: "astrologer-gateway", from: "astrologer", to: "gateway" },
    { id: "gateway-discovery", from: "gateway", to: "discovery", protocol: "grpc" },
    { id: "discovery-presence", from: "discovery", to: "presence" },
    { id: "gateway-session", from: "gateway", to: "session-svc", protocol: "grpc" },
    { id: "session-wallet", from: "session-svc", to: "wallet-svc", label: "Reservar saldo", protocol: "grpc" },
    { id: "wallet-ledger", from: "wallet-svc", to: "ledger" },
    { id: "session-events", from: "session-svc", to: "events", protocol: "stream" },
    { id: "events-meter", from: "events", to: "meter", protocol: "async" },
    { id: "meter-wallet", from: "meter", to: "wallet-svc", label: "Cobrar minuto", protocol: "grpc" },
    { id: "meter-session", from: "meter", to: "session-svc", label: "Encerrar com saldo baixo" },
    { id: "user-chat", from: "user", to: "chat", protocol: "ws" },
    { id: "astrologer-chat", from: "astrologer", to: "chat", protocol: "ws" },
    { id: "user-calls", from: "user", to: "calls", label: "Voz / vídeo" },
    { id: "astrologer-calls", from: "astrologer", to: "calls" },
    { id: "gateway-charts", from: "gateway", to: "charts", label: "Kundli" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "payment-ledger", from: "payment-svc", to: "ledger", label: "Recargas" },
    { id: "session-notify", from: "session-svc", to: "notify" },
  ],

  flows: [
    {
      id: "session",
      name: "Sessão de chat paga",
      steps: [
        { edge: "user-gateway", text: "O usuário abre a lista de astrólogos online." },
        { edge: "gateway-discovery", text: "A descoberta retorna os astrólogos…" },
        { edge: "discovery-presence", text: "…filtrados entre os que estão online e não ocupados." },
        { edge: "gateway-session", text: "O usuário inicia um chat a ₹30/min." },
        { edge: "session-wallet", text: "A carteira reserva saldo para os primeiros 3 minutos; saldo insuficiente significa que a sessão não começa." },
        { edge: "wallet-ledger", text: "A reserva é registrada." },
        { edge: "session-notify", text: "O astrólogo recebe uma solicitação e aceita." },
        { edge: "user-chat", text: "Os dois são conectados pelo gateway de chat." },
        { edge: "session-events", text: "'Sessão iniciada' é publicado." },
        { edge: "events-meter", text: "O medidor de cobrança inicia seu relógio por minuto." },
        { edge: "meter-wallet", text: "Cada minuto é cobrado exatamente uma vez (único por sessão e minuto)." },
        { edge: "meter-session", text: "Quando o saldo não cobre o próximo minuto, a sessão é encerrada, antes com um aviso." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Divergência de cobrança e cobranças duplicadas",
      fix: "Ledger somente de acréscimo com uma chave única por (sessão, minuto); liquidar com base em timestamps do servidor, não do cliente.",
      nodes: ["meter", "ledger"],
    },
    {
      problem: "Saldo acabando no meio da sessão",
      fix: "Reservar alguns minutos antecipadamente, renovar a reserva conforme o tempo passa e avisar antes de encerrar.",
      nodes: ["wallet-svc", "meter"],
    },
    {
      problem: "Presença desatualizada mostrando astrólogos ocupados como online",
      fix: "Heartbeats com TTLs curtos; marcar como ocupado quando uma sessão começa.",
      nodes: ["presence", "session-svc"],
    },
  ],

  scaling: [
    "Escalar as camadas de chat e chamadas independentemente da API.",
    "Sharding do ledger por userId.",
    "Pré-calcular os horóscopos populares; calcular mapas pessoais sob demanda e colocá-los em cache.",
  ],

  extensions: [
    "Sessões ao vivo em grupo com presentes.",
    "Consultas agendadas com lembretes.",
    "Loja de produtos (pedras preciosas, serviços de puja).",
  ],
};
