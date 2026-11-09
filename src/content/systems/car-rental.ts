import type { SystemDesignInput } from "@/types/schema";

export const carRental: SystemDesignInput = {
  slug: "car-rental",
  name: "Aluguel de carros",
  tagline: "Reserve um carro por categoria, retire, dirija e devolva",
  description:
    "Os clientes reservam uma categoria de carro em uma agência para um período de datas, e não um veículo específico. A disponibilidade é o tamanho da frota menos as reservas sobrepostas, armazenada em cache por agência e categoria. Uma reserva retém a capacidade com uma atualização condicional e aplica um bloqueio de caução no cartão. Na retirada, um veículo específico é atribuído; a telemetria informa quilometragem e combustível, e a cobrança final é capturada na devolução.",
  category: "mobility",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "caching", "event-driven"],

  requirements: {
    functional: [
      "Buscar carros por agência, datas e categoria com preços",
      "Reservar, modificar e cancelar",
      "Bloqueio de caução na reserva e cobrança final na devolução",
      "Atribuir um veículo na retirada; registrar avarias e quilometragem",
      "Gestão de frota: manutenção e transferências entre agências",
    ],
    nonFunctional: [
      "Sem overbooking de uma categoria em uma agência além da política permitida",
      "Pagamentos exatamente uma vez (exactly-once), cauções sempre liberadas",
      "Disponibilidade precisa durante temporadas de pico de viagens",
    ],
  },

  apis: [
    { method: "GET", path: "/availability?branch=&from=&to=", purpose: "Categorias de carros disponíveis com preços" },
    { method: "POST", path: "/reservations", purpose: "Reservar uma categoria (Idempotency-Key); aplica bloqueio de caução" },
    { method: "POST", path: "/reservations/{id}/pickup", purpose: "Atribuir um veículo, registrar hodômetro e combustível" },
    { method: "POST", path: "/reservations/{id}/return", purpose: "Registrar devolução e calcular cobrança final" },
  ],

  estimates: [
    { label: "Frota", value: "≈ 200 mil veículos", derivation: "Estimativa distribuída em ~2.000 agências" },
    { label: "Reservas", value: "≈ 100 mil/dia", derivation: "Estimativa; média de ~1/s" },
    { label: "Buscas de disponibilidade", value: "≈ 50× reservas", derivation: "Navegação e comparação de preços" },
    { label: "Telemetria", value: "≈ 2–3 mil msgs/s", derivation: "200 mil veículos × uma atualização por minuto em movimento" },
  ],

  dataModel: [
    {
      entity: "Inventário por categoria",
      store: "Banco relacional",
      key: "branchId + carClass + date",
      fields: ["fleetCount", "reserved", "version"],
      why: "Incrementos condicionais mantêm as reservas dentro do tamanho da frota",
    },
    {
      entity: "Reserva",
      store: "Banco relacional",
      key: "reservationId",
      fields: ["customerId", "branchId", "carClass", "from", "to", "status", "depositAuthId", "vehicleId"],
      why: "Ciclo de vida desde a reserva até a devolução",
    },
    {
      entity: "Veículo",
      store: "Banco relacional",
      key: "vehicleId",
      fields: ["branchId", "class", "status", "odometer", "nextService"],
      why: "Estado da frota para atribuição e manutenção",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Buscar e reservar" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Reservar, chave digital, recibos" },
    { id: "counter", kind: "web-client", label: "App de balcão da agência", role: "Retirada e devolução pela equipe" },
    { id: "vehicles", kind: "mobile-client", label: "Telemetria veicular", role: "Informa localização, quilometragem e combustível" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação e roteamento" },
    { id: "search-svc", kind: "service", label: "Busca de disponibilidade", role: "Categorias e preços por agência e datas" },
    { id: "availability-cache", kind: "cache", label: "Cache de disponibilidade", role: "Capacidade restante por agência, categoria e dia" },
    { id: "pricing", kind: "service", label: "Precificação", role: "Tarifas por temporada, demanda e duração" },
    { id: "reservation-svc", kind: "service", label: "Serviço de reservas", role: "Retém capacidade e gerencia o ciclo de vida da locação" },
    { id: "fleet-svc", kind: "service", label: "Serviço de frota", role: "Veículos, atribuição, manutenção" },
    { id: "main-db", kind: "relational-db", label: "Inventário, reservas e frota", role: "Fonte da verdade" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Bloqueios de caução e cobranças finais" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Autorização e captura no cartão" },
    { id: "telemetry", kind: "event-stream", label: "Stream de telemetria", role: "Atualizações dos veículos" },
    { id: "notify", kind: "notifications", label: "E-mail e SMS", role: "Confirmações e recibos" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "counter-gateway", from: "counter", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-cache", from: "search-svc", to: "availability-cache" },
    { id: "search-pricing", from: "search-svc", to: "pricing", protocol: "grpc" },
    { id: "gateway-reservation", from: "gateway", to: "reservation-svc", protocol: "grpc" },
    { id: "reservation-db", from: "reservation-svc", to: "main-db", label: "Bloqueio condicional" },
    { id: "reservation-cache", from: "reservation-svc", to: "availability-cache", label: "Atualizar restante" },
    { id: "reservation-payment", from: "reservation-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "reservation-fleet", from: "reservation-svc", to: "fleet-svc", label: "Atribuir veículo", protocol: "grpc" },
    { id: "fleet-db", from: "fleet-svc", to: "main-db" },
    { id: "vehicles-telemetry", from: "vehicles", to: "telemetry", protocol: "stream" },
    { id: "telemetry-fleet", from: "telemetry", to: "fleet-svc", protocol: "async" },
    { id: "reservation-notify", from: "reservation-svc", to: "notify" },
  ],

  flows: [
    {
      id: "reserve",
      name: "Reservar um carro",
      steps: [
        { edge: "web-gateway", text: "O cliente busca na agência do aeroporto por 5 dias." },
        { edge: "gateway-search", text: "A busca de disponibilidade processa a requisição." },
        { edge: "search-cache", text: "A capacidade restante por categoria vem do cache." },
        { edge: "search-pricing", text: "Os preços são calculados para as datas." },
        { edge: "gateway-reservation", text: "O cliente reserva um SUV." },
        { edge: "reservation-db", text: "O contador de cada dia para SUV naquela agência é incrementado — somente se permanecer dentro do tamanho da frota." },
        { edge: "reservation-payment", text: "Um bloqueio de caução é aplicado no cartão." },
        { edge: "payment-psp", text: "O emissor do cartão autoriza a operação." },
        { edge: "reservation-cache", text: "A disponibilidade em cache é atualizada." },
        { edge: "reservation-notify", text: "Uma confirmação é enviada." },
      ],
    },
    {
      id: "return",
      name: "Retirada e devolução",
      steps: [
        { edge: "counter-gateway", text: "Na retirada, a equipe abre a reserva." },
        { edge: "gateway-reservation", text: "O serviço de reservas carrega os dados e verifica a habilitação do cliente." },
        { edge: "reservation-fleet", text: "Um SUV específico, limpo e revisado, é atribuído." },
        { edge: "vehicles-telemetry", text: "Durante a locação, o carro informa quilometragem e combustível." },
        { edge: "telemetry-fleet", text: "O serviço de frota registra as leituras." },
        { edge: "reservation-payment", text: "Na devolução, o valor final (dias extras, combustível, avarias) é capturado e o restante da caução é liberado." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Overbooking de uma categoria em agências movimentadas",
      fix: "Contadores diários com atualizações condicionais; buffer opcional e pequeno de overbooking baseado nas taxas de não comparecimento (no-show).",
      nodes: ["reservation-svc", "main-db"],
    },
    {
      problem: "Disponibilidade desatualizada no cache",
      fix: "Atualizar o cache a cada reserva e verificar novamente o banco de dados no momento do fechamento.",
      nodes: ["availability-cache"],
    },
    {
      problem: "Cauções nunca liberadas",
      fix: "Um reconciliador que anula bloqueios de locações canceladas ou concluídas.",
      nodes: ["payment-svc"],
    },
  ],

  scaling: [
    "Particione o inventário e as reservas por região ou agência.",
    "Faça cache da disponibilidade e dos preços por agência.",
    "Processe a telemetria de forma assíncrona.",
  ],

  extensions: [
    "Chaves digitais e retirada sem contato.",
    "Locações só de ida (one-way) com rebalanceamento de frota.",
    "Detecção de avarias por meio de fotos.",
  ],
};
