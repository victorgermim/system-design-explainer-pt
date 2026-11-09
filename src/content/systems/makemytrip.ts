import type { SystemDesignInput } from "@/types/schema";

export const makemytrip: SystemDesignInput = {
  slug: "makemytrip",
  name: "MakeMyTrip",
  tagline: "Voos e hotéis agregados de diversos fornecedores",
  description:
    "A plataforma possui pouco inventário próprio: voos e hotéis ficam nos sistemas das companhias aéreas, GDSs e gestores de canais hoteleiros (channel managers). As buscas fazem fan-out para esses fornecedores em paralelo, e os resultados ficam em cache por pouco tempo porque as chamadas aos fornecedores são lentas e caras. Reservar uma viagem é uma saga — bloquear com o fornecedor, cobrar o pagamento e então emitir o bilhete — com cancelamentos compensatórios se qualquer etapa falhar.",
  category: "bookings",
  difficulty: 3,
  concepts: ["saga", "caching", "idempotency", "back-pressure", "search-indexing"],

  requirements: {
    functional: [
      "Buscar voos por rota e data, e hotéis por cidade e datas",
      "Filtrar e ordenar por preço, horário, avaliação e comodidades",
      "Reservar voos e hotéis, separadamente ou como um pacote",
      "Pagar, receber itinerários, cancelar e obter reembolsos",
    ],
    nonFunctional: [
      "Resultados de busca em poucos segundos, apesar de fornecedores lentos",
      "Os preços exibidos devem ser revalidados antes do pagamento",
      "Nenhuma reserva sem pagamento, nenhum pagamento sem reserva",
      "Lidar com picos de alta temporada e feriados",
    ],
  },

  apis: [
    { method: "GET", path: "/flights/search?from=&to=&date=&pax=", purpose: "Opções de voos agregadas" },
    { method: "GET", path: "/hotels/search?city=&checkIn=&checkOut=", purpose: "Hotéis com tarifas" },
    { method: "POST", path: "/itineraries/{id}/reprice", purpose: "Revalidar preço e disponibilidade com o fornecedor" },
    { method: "POST", path: "/bookings", purpose: "Reservar um itinerário (Idempotency-Key)" },
    { method: "POST", path: "/bookings/{id}/cancel", purpose: "Cancelar e reembolsar conforme as regras tarifárias" },
  ],

  estimates: [
    { label: "Usuários mensais", value: "≈ 10 M", derivation: "Estimativa" },
    { label: "Buscas", value: "≈ 1–3 M/dia", derivation: "Cada sessão executa várias buscas; a proporção de buscas por reserva (look-to-book) é muito alta" },
    { label: "Chamadas a fornecedores", value: "10–20 por busca", derivation: "Fan-out entre companhias aéreas/GDSs antes do cache" },
    { label: "Reservas", value: "≈ 50–100 mil/dia", derivation: "Estimativa a partir de taxas de conversão (look-to-book) de ~1–3%" },
  ],

  dataModel: [
    {
      entity: "Reserva",
      store: "Banco relacional",
      key: "bookingId",
      fields: ["userId", "items[] (flight/hotel)", "status", "supplierRefs", "amount", "paymentId"],
      why: "Máquina de estados de múltiplas etapas envolvendo valores financeiros",
    },
    {
      entity: "Entrada de cache de tarifas",
      store: "Cache em memória",
      key: "route + date + pax",
      fields: ["offers[]", "fetchedAt"],
      why: "Reduz chamadas lentas e com limite de taxa aos fornecedores; TTL curto porque os preços mudam",
    },
    {
      entity: "Hotel",
      store: "Índice de busca",
      key: "hotelId",
      fields: ["name", "location", "rating", "amenities", "minPrice"],
      why: "Conteúdo estático pesquisado com geolocalização e facetas",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Buscar e reservar" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Buscar, reservar e gerenciar viagens" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits, roteamento" },
    { id: "search-svc", kind: "service", label: "Agregador de busca", role: "Faz fan-out para fornecedores e mescla os resultados" },
    { id: "fare-cache", kind: "cache", label: "Cache de tarifas e diárias", role: "Respostas recentes de fornecedores com TTLs curtos" },
    { id: "hotel-index", kind: "search", label: "Índice de hotéis", role: "Conteúdo de hotéis para filtragem e classificação" },
    { id: "suppliers", kind: "partner-api", label: "Companhias aéreas, GDS, hotéis", role: "O inventário e os preços reais" },
    { id: "booking-svc", kind: "service", label: "Serviço de reservas", role: "Cria reservas e acompanha o status" },
    { id: "saga", kind: "workflow", label: "Saga de reserva", role: "Bloquear → pagar → emitir, com compensação" },
    { id: "booking-db", kind: "relational-db", label: "Reservas", role: "Reservas e suas etapas" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Autorizar, capturar, reembolsar" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Cartões, UPI, carteiras digitais" },
    { id: "events", kind: "event-stream", label: "Eventos de reserva", role: "Confirmada, falha, cancelada" },
    { id: "notify", kind: "notifications", label: "Itinerário e alertas", role: "Passagens, vouchers, alterações de voo" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-cache", from: "search-svc", to: "fare-cache" },
    { id: "search-index", from: "search-svc", to: "hotel-index" },
    { id: "search-suppliers", from: "search-svc", to: "suppliers", label: "Consultas em paralelo" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-db-write", from: "booking-svc", to: "booking-db" },
    { id: "booking-saga", from: "booking-svc", to: "saga", protocol: "async" },
    { id: "saga-suppliers", from: "saga", to: "suppliers", label: "Bloquear / emitir / cancelar" },
    { id: "saga-payment", from: "saga", to: "payment-svc", label: "Pagar / reembolsar", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "saga-events", from: "saga", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "search",
      name: "Buscar voos",
      steps: [
        { edge: "web-gateway", text: "O usuário busca Deli → Mumbai para sexta-feira." },
        { edge: "gateway-search", text: "O agregador processa a busca." },
        { edge: "search-cache", text: "Uma busca idêntica recente já pode estar em cache por alguns minutos." },
        { edge: "search-suppliers", text: "Caso contrário, ele consulta companhias aéreas e GDSs em paralelo com um timeout estrito, usando o que retornar a tempo." },
      ],
    },
    {
      id: "book",
      name: "Reservar uma viagem",
      steps: [
        { edge: "gateway-booking", text: "O usuário faz a reserva; o preço é revalidado primeiro." },
        { edge: "booking-db-write", text: "Uma reserva é criada como PENDING." },
        { edge: "booking-saga", text: "A saga de reserva é iniciada." },
        { edge: "saga-suppliers", text: "Etapa 1: bloquear o assento ou quarto junto ao fornecedor." },
        { edge: "saga-payment", text: "Etapa 2: realizar a cobrança do pagamento." },
        { edge: "payment-psp", text: "O provedor de pagamento aprova." },
        { edge: "saga-suppliers", text: "Etapa 3: emitir a passagem ou voucher. Se isso falhar, a saga estorna o valor e libera o bloqueio." },
        { edge: "saga-events", text: "O resultado é publicado." },
        { edge: "events-notify", text: "O itinerário é enviado por e-mail." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "APIs de fornecedores lentas e com limite de taxa (rate-limited)",
      fix: "Cache com TTL curto, chamadas em paralelo com timeouts e circuit breakers por fornecedor.",
      nodes: ["search-svc", "fare-cache", "suppliers"],
    },
    {
      problem: "Mudanças de preço entre a busca e a reserva",
      fix: "Sempre revalidar o preço antes do pagamento e avisar o usuário caso tenha mudado.",
      nodes: ["booking-svc", "suppliers"],
    },
    {
      problem: "Falhas parciais entre fornecedor, pagamento e emissão",
      fix: "Uma saga com etapas idempotentes e compensações, além de reconciliação para reservas travadas.",
      nodes: ["saga", "payment-svc"],
    },
  ],

  scaling: [
    "Escale os agregadores de busca horizontalmente; eles são stateless.",
    "Faça sharding das reservas por bookingId e mantenha caches quentes por região.",
    "Enfileire tarefas pós-reserva (e-mails, fidelidade, analytics) fora do caminho crítico.",
  ],

  extensions: [
    "Pacotes combinando voo e hotel em um único pagamento.",
    "Alertas de preços e previsão de tarifas.",
    "Pontos de fidelidade e carteira digital.",
  ],
};
