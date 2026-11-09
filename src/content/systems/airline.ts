import type { SystemDesignInput } from "@/types/schema";

export const airline: SystemDesignInput = {
  slug: "airline",
  name: "Reservas de companhia aérea",
  tagline: "Voos, assentos, reservas e check-in para uma companhia aérea",
  description:
    "A companhia aérea é dona do seu inventário: cada voo tem um número fixo de assentos por classe tarifária. Uma reserva decrementa essa contagem com uma verificação de concorrência otimista, cria um registro do passageiro (PNR), cobra o pagamento e emite a passagem. Eventos de operação — atrasos, mudanças de portão, cancelamentos — passam por um stream de eventos para notificar os passageiros e reacomodá-los.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "event-driven", "websockets"],

  requirements: {
    functional: [
      "Buscar voos e tarifas; reservar viagens só de ida, ida e volta e com múltiplos trechos",
      "Escolher assentos, adicionar bagagens e refeições",
      "Gerenciar reservas: alterar, cancelar, reembolsar",
      "Check-in online e cartões de embarque",
      "Atualizações de status do voo e reacomodação automática em caso de cancelamento",
    ],
    nonFunctional: [
      "Sem overbooking além do limite escolhido pela companhia",
      "Reservas e pagamentos são exactly-once",
      "Alta disponibilidade — o check-in não pode cair no aeroporto",
      "Vender por agências de viagem e GDSs, além dos canais diretos",
    ],
  },

  apis: [
    { method: "GET", path: "/flights?from=&to=&date=", purpose: "Voos com tarifas por classe" },
    { method: "POST", path: "/bookings", purpose: "Cria um PNR para passageiros e trechos (Idempotency-Key)" },
    { method: "PUT", path: "/bookings/{pnr}/seats", purpose: "Atribui assentos" },
    { method: "POST", path: "/bookings/{pnr}/checkin", purpose: "Faz o check-in e obtém os cartões de embarque" },
    { method: "GET", path: "/flights/{flightId}/status", purpose: "Status ao vivo, portão e atraso" },
  ],

  estimates: [
    { label: "Passageiros", value: "≈ 500 mil/dia", derivation: "Escala divulgada para uma grande companhia" },
    { label: "Voos", value: "≈ 3–5 mil/dia", derivation: "Suposição" },
    { label: "Reservas", value: "≈ 6/s em média", derivation: "500 mil passageiros ÷ ~1 reserva por passageiro ÷ 86.400 s; picos de venda de 20×" },
    { label: "Buscas", value: "≈ 100× as reservas", derivation: "Alta razão look-to-book, principalmente de agências e GDSs" },
  ],

  dataModel: [
    {
      entity: "Inventário de tarifas",
      store: "Banco relacional",
      key: "flightId + fareClass",
      fields: ["capacity", "sold", "price", "version"],
      why: "UPDATE … SET sold = sold + n WHERE sold + n ≤ capacity AND version = v evita vender além da capacidade",
    },
    {
      entity: "PNR (reserva)",
      store: "Banco relacional",
      key: "pnr",
      fields: ["passengers", "segments", "status", "ticketNumbers", "paymentId"],
      why: "Registro padrão do setor, referenciado por todos os canais",
    },
    {
      entity: "Atribuição de assento",
      store: "Banco relacional",
      key: "flightId + seatNo",
      fields: ["pnr", "passengerId"],
      why: "Único por assento em cada voo",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Site", role: "Reservas diretas" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Reservas, check-in, cartão de embarque" },
    { id: "agents", kind: "web-client", label: "Apps de aeroporto e agentes", role: "Ferramentas da equipe nos balcões e portões" },
    { id: "gds", kind: "partner-api", label: "GDS / agências de viagem", role: "Canais de venda indiretos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits, roteamento" },
    { id: "inventory-svc", kind: "service", label: "Voos e inventário", role: "Horários e assentos por classe tarifária" },
    { id: "booking-svc", kind: "service", label: "Reservas (PNR)", role: "Cria e altera reservas" },
    { id: "checkin-svc", kind: "service", label: "Check-in e embarque", role: "Mapas de assentos, cartões de embarque, listas de portão" },
    { id: "ops-svc", kind: "service", label: "Operações de voo", role: "Status, atrasos, portões, troca de aeronave" },
    { id: "inventory-db", kind: "relational-db", label: "Inventário", role: "Assentos vendidos por voo e classe" },
    { id: "pnr-db", kind: "relational-db", label: "Reservas", role: "PNRs, passagens e assentos" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Cobranças e reembolsos" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Processamento de cartões" },
    { id: "events", kind: "event-stream", label: "Eventos de operação e reservas", role: "Atrasos, cancelamentos, reservas" },
    { id: "status", kind: "realtime-gateway", label: "Status ao vivo", role: "Envia o status do voo aos apps" },
    { id: "notify", kind: "notifications", label: "SMS, e-mail, push", role: "Confirmações e alertas de interrupção" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "agents-gateway", from: "agents", to: "gateway" },
    { id: "gds-gateway", from: "gds", to: "gateway", label: "Disponibilidade e venda" },
    { id: "gateway-inventory", from: "gateway", to: "inventory-svc", protocol: "grpc" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "gateway-checkin", from: "gateway", to: "checkin-svc", protocol: "grpc" },
    { id: "inventory-db-rw", from: "inventory-svc", to: "inventory-db" },
    { id: "booking-inventory", from: "booking-svc", to: "inventory-svc", label: "Decrementar assentos", protocol: "grpc" },
    { id: "booking-pnr", from: "booking-svc", to: "pnr-db" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "checkin-pnr", from: "checkin-svc", to: "pnr-db" },
    { id: "ops-events", from: "ops-svc", to: "events", label: "Atraso / cancelamento", protocol: "stream" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-status", from: "events", to: "status", protocol: "async" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "events-rebook", from: "events", to: "booking-svc", label: "Reacomodação automática", protocol: "async" },
    { id: "mobile-status", from: "mobile", to: "status", protocol: "ws" },
  ],

  flows: [
    {
      id: "book",
      name: "Reservar um voo",
      steps: [
        { edge: "web-gateway", text: "O passageiro escolhe um voo e uma tarifa." },
        { edge: "gateway-booking", text: "O serviço de reservas inicia uma reserva." },
        { edge: "booking-inventory", text: "Ele pede ao inventário para vender um assento nesta classe tarifária." },
        { edge: "inventory-db-rw", text: "Uma atualização condicional só tem sucesso se ainda houver assentos e ninguém tiver alterado a linha nesse meio-tempo; caso contrário, tenta de novo ou falha." },
        { edge: "booking-pnr", text: "Um PNR é criado com os passageiros e trechos." },
        { edge: "booking-payment", text: "O pagamento é cobrado, usando o PNR como chave. Se falhar, o assento é devolvido ao inventário." },
        { edge: "payment-psp", text: "O cartão é cobrado e um número de passagem é emitido." },
        { edge: "booking-events", text: "Um evento de reserva é publicado." },
        { edge: "events-notify", text: "A passagem eletrônica é enviada por e-mail." },
      ],
    },
    {
      id: "disruption",
      name: "Voo cancelado",
      steps: [
        { edge: "ops-events", text: "A operação cancela um voo." },
        { edge: "events-rebook", text: "O serviço de reservas reacomoda os passageiros afetados nos próximos voos disponíveis." },
        { edge: "events-status", text: "Atualizações de status ao vivo são enviadas…" },
        { edge: "mobile-status", text: "…a todos os apps conectados." },
        { edge: "events-notify", text: "Os passageiros recebem SMS e e-mail com o novo itinerário." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Vendas concorrentes dos últimos assentos",
      fix: "Atualizações condicionais com uma coluna de versão no inventário de tarifas; pequeno overbooking controlado, se a política permitir.",
      nodes: ["inventory-svc", "inventory-db"],
    },
    {
      problem: "O volume de buscas dos GDSs supera em muito as reservas",
      fix: "Servir a disponibilidade a partir de um cache atualizado a cada venda; aplicar rate limit aos canais.",
      nodes: ["gds", "inventory-svc"],
    },
    {
      problem: "Uma interrupção em massa gera milhares de reacomodações de uma vez",
      fix: "Processar as reacomodações a partir de uma fila, por prioridade (conexões, status), em vez de inline.",
      nodes: ["events", "booking-svc"],
    },
  ],

  scaling: [
    "Particionar o inventário por voo e data.",
    "Réplicas de leitura para busca e status; a primária cuida das vendas.",
    "Manter o check-in disponível com réplicas próprias na região do aeroporto.",
  ],

  extensions: [
    "Programa de fidelidade com milhas e upgrades.",
    "Precificação dinâmica por classe tarifária.",
    "Escalonamento de tripulação e aeronaves.",
  ],
};
