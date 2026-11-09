import type { SystemDesignInput } from "@/types/schema";

export const bookmyshow: SystemDesignInput = {
  slug: "bookmyshow",
  name: "BookMyShow",
  tagline: "Ingressos de cinema e eventos com seleção de assentos em tempo real",
  description:
    "A navegação por sessões é um caminho de leitura orientado a busca e com cache. A parte difícil é o mapa de assentos: quando você escolhe os assentos, eles ficam reservados por alguns minutos com um lock de curta duração, para que ninguém mais possa pegá-los enquanto você paga. O pagamento confirma a reserva em uma única transação no banco de dados; se você desistir, a reserva temporária expira e os assentos voltam a ficar disponíveis. Em estreias de grande sucesso, uma sala de espera virtual controla a entrada de pessoas no fluxo de compra.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "caching", "back-pressure", "search-indexing"],

  requirements: {
    functional: [
      "Navegar por filmes e eventos por cidade, data, idioma e local",
      "Ver um mapa de assentos ao vivo e escolher assentos específicos",
      "Reservar assentos temporariamente durante o pagamento; liberá-los se o pagamento não for concluído",
      "Pagar e receber um e-ticket (QR code)",
      "Cancelar e reembolsar dentro da política do local",
    ],
    nonFunctional: [
      "Nunca vender o mesmo assento duas vezes",
      "Lidar com picos de estreia (centenas de milhares de usuários simultâneos)",
      "Mapas de assentos refletem bloqueios temporários em segundos",
      "Pagamentos são processados exatamente uma vez (exactly-once)",
    ],
  },

  apis: [
    { method: "GET", path: "/cities/{city}/shows?date=&movieId=", purpose: "Sessões por local e horário" },
    { method: "GET", path: "/shows/{showId}/seats", purpose: "Mapa de assentos com lugares disponíveis, bloqueados e reservados" },
    { method: "POST", path: "/shows/{showId}/holds", purpose: "Bloqueia assentos por ~8 minutos; falha se algum já estiver ocupado" },
    { method: "POST", path: "/bookings", purpose: "Confirma um bloqueio após o pagamento (idempotente)" },
    { method: "DELETE", path: "/bookings/{bookingId}", purpose: "Cancelar e reembolsar" },
  ],

  estimates: [
    { label: "Concorrência de pico", value: "≈ 250 mil usuários", derivation: "Relatado em grandes estreias" },
    { label: "Requisições de pico", value: "≈ 11 mil/s", derivation: "650 mil requisições por minuto ÷ 60" },
    { label: "Ingressos", value: "≈ 1 M/dia", derivation: "Estimativa; média de ~12/s, muito maior em dias de estreia" },
    { label: "Assentos monitorados", value: "≈ 50 M/dia", derivation: "~10 mil salas × 5 sessões × ~1.000 assentos (incl. eventos)" },
  ],

  dataModel: [
    {
      entity: "Assento da sessão",
      store: "Banco relacional",
      key: "showId + seatId",
      fields: ["status (free/booked)", "bookingId", "price"],
      why: "Restrição de unicidade (unique constraint) torna a venda dupla impossível no nível do banco de dados",
    },
    {
      entity: "Bloqueio de assento",
      store: "Cache em memória com TTL",
      key: "showId + seatId",
      fields: ["holdId", "userId", "expiresAt"],
      why: "Locks temporários rápidos que expiram sozinhos",
    },
    {
      entity: "Reserva",
      store: "Banco relacional",
      key: "bookingId",
      fields: ["userId", "showId", "seats", "amount", "status", "paymentId", "idempotencyKey"],
      why: "Registro transacional de valores e assentos",
    },
    {
      entity: "Filme / Sessão",
      store: "Banco relacional + índice de busca",
      key: "showId",
      fields: ["movieId", "venueId", "screen", "startsAt", "language", "format"],
      why: "Consultado constantemente; mantido em cache e indexado",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Navegar e reservar" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Navegar, reservar e exibir ingressos" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Pôsteres, trailers e páginas estáticas" },
    { id: "waiting-room", kind: "message-queue", label: "Sala de espera virtual", role: "Admite usuários no fluxo de reserva a uma taxa segura durante picos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limiting, roteamento" },
    { id: "catalog-svc", kind: "service", label: "Serviço de catálogo", role: "Filmes, locais e horários de sessões" },
    { id: "search-index", kind: "search", label: "Índice de busca", role: "Filmes, eventos e locais" },
    { id: "seat-svc", kind: "service", label: "Serviço de assentos", role: "Mapas e bloqueios de assentos" },
    { id: "holds", kind: "cache", label: "Bloqueios de assentos", role: "Locks de curta duração por assento (TTL)" },
    { id: "booking-svc", kind: "service", label: "Serviço de reservas", role: "Transforma um bloqueio pago em uma reserva confirmada" },
    { id: "booking-db", kind: "relational-db", label: "Reservas e assentos", role: "Fonte da verdade para assentos vendidos" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Cobra e reembolsa de forma idempotente" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Cartões, UPI, carteiras digitais" },
    { id: "venues", kind: "partner-api", label: "Bilheteria do local", role: "Alguns cinemas mantêm seu próprio sistema de bilheteria" },
    { id: "events", kind: "event-stream", label: "Eventos de reserva", role: "Confirmada, cancelada" },
    { id: "notify", kind: "notifications", label: "Ingressos e alertas", role: "E-tickets por SMS, e-mail e push" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "mobile-cdn", from: "mobile", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-waiting", from: "gateway", to: "waiting-room", label: "Modo de pico", protocol: "async" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "catalog-search", from: "catalog-svc", to: "search-index" },
    { id: "gateway-seats", from: "gateway", to: "seat-svc", protocol: "grpc" },
    { id: "seats-holds", from: "seat-svc", to: "holds", label: "SET NX + TTL" },
    { id: "seats-db", from: "seat-svc", to: "booking-db", label: "Assentos reservados" },
    { id: "seats-venue", from: "seat-svc", to: "venues", label: "Sincronizar status do assento" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db-write", from: "booking-svc", to: "booking-db", label: "Confirmar" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Reservar assentos",
      steps: [
        { edge: "mobile-gateway", text: "O usuário escolhe uma sessão." },
        { edge: "gateway-seats", text: "O serviço de assentos monta o mapa de assentos." },
        { edge: "seats-db", text: "Os assentos já reservados vêm do banco de dados…" },
        { edge: "seats-holds", text: "…e os assentos temporariamente bloqueados por outros vêm do cache. O usuário escolhe dois assentos e cada um é travado com SET NX por 8 minutos — tudo ou nada." },
        { edge: "gateway-booking", text: "O usuário realiza o pagamento." },
        { edge: "booking-payment", text: "O serviço de reservas faz a cobrança usando o ID do bloqueio como chave de idempotência." },
        { edge: "payment-psp", text: "O provedor de pagamento aprova." },
        { edge: "booking-db-write", text: "Os assentos são marcados como reservados em uma única transação; uma restrição de unicidade é a proteção final contra venda dupla." },
        { edge: "booking-events", text: "Um evento de 'reserva confirmada' é publicado." },
        { edge: "events-notify", text: "O e-ticket é enviado." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Milhares de pessoas querem os mesmos assentos no mesmo segundo",
      fix: "Bloqueios atômicos por assento em um armazenamento em memória com TTL, além de uma restrição de unicidade no banco de dados como última linha de defesa.",
      nodes: ["holds", "booking-db"],
    },
    {
      problem: "Picos de tráfego em estreias",
      fix: "Uma sala de espera virtual admite usuários a uma taxa sustentável; a navegação permanece no cache e na CDN.",
      nodes: ["waiting-room", "cdn", "catalog-svc"],
    },
    {
      problem: "O pagamento é aprovado, mas a confirmação falha",
      fix: "Confirmação idempotente indexada pelo ID do bloqueio; um reconciliador reembolsa ou conclui pagamentos órfãos.",
      nodes: ["booking-svc", "payment-svc"],
    },
  ],

  scaling: [
    "Faça sharding de assentos e reservas por cidade ou local; a maior parte do tráfego é local.",
    "Faça cache das listagens de sessões por cidade com TTLs curtos.",
    "Escale os serviços de assentos e reservas de forma independente da navegação.",
  ],

  extensions: [
    "Atualizações do mapa de assentos em tempo real via WebSockets.",
    "Preços dinâmicos para sessões de alta demanda.",
    "Adicionais de alimentos e bebidas no mesmo pedido.",
  ],
};
