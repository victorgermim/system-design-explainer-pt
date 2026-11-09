import type { SystemDesignInput } from "@/types/schema";

export const urbanCompany: SystemDesignInput = {
  slug: "urban-company",
  name: "Urban Company",
  tagline: "Contrate profissionais verificados para serviços domésticos",
  description:
    "Os clientes agendam um serviço para um horário, não uma pessoa. A disponibilidade de horários é calculada a partir das agendas de profissionais próximos com a habilidade certa. Escolher um horário cria uma reserva temporária, o pagamento a confirma, e um serviço de atribuição escolhe então o melhor profissional por distância, avaliação e carga de trabalho. No dia, o profissional faz check-in e check-out pelo app, e o repasse vem após a conclusão.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "geospatial-indexing", "idempotency", "event-driven"],

  requirements: {
    functional: [
      "Navegar pelos serviços (limpeza, salão, reparos) com preços",
      "Ver os horários disponíveis para o seu endereço e agendar um",
      "Atribuir um profissional qualificado nas proximidades",
      "Acompanhar o status do serviço; pagar online ou após o serviço",
      "Avaliações, pedidos de retrabalho, repasses aos profissionais",
    ],
    nonFunctional: [
      "Nunca prometer um horário que ninguém pode atender",
      "Atribuição em minutos após o agendamento",
      "As agendas dos profissionais permanecem consistentes",
    ],
  },

  apis: [
    { method: "GET", path: "/services?city=", purpose: "Catálogo com preços" },
    { method: "GET", path: "/slots?serviceId=&lat=&lng=&date=", purpose: "Horários disponíveis para agendamento neste endereço" },
    { method: "POST", path: "/slot-holds", purpose: "Reservar um horário por alguns minutos" },
    { method: "POST", path: "/bookings", purpose: "Confirmar um horário reservado (Idempotency-Key)" },
    { method: "POST", path: "/jobs/{id}/status", purpose: "Profissional: a caminho, iniciado, concluído" },
  ],

  estimates: [
    { label: "Agendamentos", value: "≈ 100 k/dia", derivation: "Premissa" },
    { label: "Profissionais", value: "≈ 50 k", derivation: "Premissa considerando todas as cidades" },
    { label: "Consultas de horários", value: "≈ 20× os agendamentos", derivation: "Clientes comparam dias e horários" },
    { label: "Linhas de agenda", value: "≈ 50 k × 14 dias × ~16 horários", derivation: "≈ 11 M de células de horário mantidas duas semanas à frente" },
  ],

  dataModel: [
    {
      entity: "Professional schedule",
      store: "Relational DB",
      key: "proId + date + slot",
      fields: ["status (free/held/booked)", "bookingId"],
      why: "Atualizações condicionais evitam atribuição dupla",
    },
    {
      entity: "Slot capacity",
      store: "In-memory cache",
      key: "city zone + skill + date + slot",
      fields: ["available", "held"],
      why: "Respostas rápidas a 'conseguimos atender este horário?' para os clientes",
    },
    {
      entity: "Booking",
      store: "Relational DB",
      key: "bookingId",
      fields: ["customerId", "serviceId", "address", "slot", "proId", "status", "paymentId"],
      why: "Ciclo de vida e dinheiro",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "App do cliente", role: "Agendar e acompanhar serviços" },
    { id: "pro", kind: "mobile-client", label: "App do profissional", role: "Serviços, navegação, check-in/out, ganhos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação e roteamento" },
    { id: "catalog-svc", kind: "service", label: "Serviço de catálogo", role: "Serviços, preços, ofertas" },
    { id: "slot-svc", kind: "service", label: "Serviço de horários", role: "Calcula os horários disponíveis e cria reservas temporárias" },
    { id: "slot-cache", kind: "cache", label: "Capacidade de horários e reservas", role: "Capacidade por zona e reservas de curta duração" },
    { id: "booking-svc", kind: "service", label: "Serviço de agendamentos", role: "Confirma agendamentos e acompanha os serviços" },
    { id: "assignment", kind: "service", label: "Serviço de atribuição", role: "Escolhe o profissional" },
    { id: "pro-geo", kind: "cache", label: "Localização dos profissionais", role: "Bases residenciais e posições ao vivo por célula" },
    { id: "main-db", kind: "relational-db", label: "Agendamentos e agendas", role: "Fonte da verdade" },
    { id: "payment-svc", kind: "service", label: "Pagamentos e repasses", role: "Cobranças de clientes, repasses aos profissionais" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões" },
    { id: "events", kind: "event-stream", label: "Eventos de agendamento", role: "Confirmado, atribuído, concluído" },
    { id: "notify", kind: "notifications", label: "Push e SMS", role: "Confirmações e alertas de chegada" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "pro-gateway", from: "pro", to: "gateway" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "gateway-slots", from: "gateway", to: "slot-svc", protocol: "grpc" },
    { id: "slots-cache", from: "slot-svc", to: "slot-cache", label: "Capacidade / reserva" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db", from: "booking-svc", to: "main-db" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-assignment", from: "events", to: "assignment", protocol: "async" },
    { id: "assignment-geo", from: "assignment", to: "pro-geo", label: "Próximos, habilitados, livres" },
    { id: "assignment-db", from: "assignment", to: "main-db", label: "Reservar horário do profissional" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "events-payout", from: "events", to: "payment-svc", label: "Concluído → repasse", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Agendar um serviço",
      steps: [
        { edge: "customer-gateway", text: "O cliente escolhe 'limpeza pesada' para sábado." },
        { edge: "gateway-slots", text: "O serviço de horários verifica a capacidade dessa zona e habilidade." },
        { edge: "slots-cache", text: "O horário das 10h tem capacidade; uma reserva temporária é criada por 10 minutos." },
        { edge: "gateway-booking", text: "O cliente confirma." },
        { edge: "booking-db", text: "O agendamento é salvo como PENDING no horário reservado." },
        { edge: "booking-payment", text: "O pagamento é efetuado (ou marcado como pagar após o serviço) e o agendamento é confirmado." },
        { edge: "booking-events", text: "'Agendamento confirmado' é publicado." },
        { edge: "events-assignment", text: "O serviço de atribuição o recebe." },
        { edge: "assignment-geo", text: "Ele seleciona profissionais próximos com a habilidade e as 10h livres." },
        { edge: "assignment-db", text: "Ele reserva o horário do melhor com uma atualização condicional." },
        { edge: "events-notify", text: "Cliente e profissional são notificados." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Mostrar horários que na prática não podem ser atendidos",
      fix: "Calcular a capacidade a partir das agendas reais por zona e habilidade; reservar capacidade durante o checkout.",
      nodes: ["slot-svc", "slot-cache"],
    },
    {
      problem: "Dois agendamentos atribuídos ao mesmo profissional",
      fix: "Atualização condicional na linha de horário do profissional; tentar novamente com o próximo candidato.",
      nodes: ["assignment", "main-db"],
    },
    {
      problem: "Faltas e atrasos",
      fix: "Localização ao vivo no dia do serviço e reatribuição automática quando um profissional está atrasado.",
      nodes: ["assignment", "pro-geo"],
    },
  ],

  scaling: [
    "Particionar por cidade; capacidade e atribuição são locais.",
    "Reconstruir a capacidade de horários de forma incremental conforme as agendas mudam.",
    "Atribuição assíncrona para que o checkout continue rápido.",
  ],

  extensions: [
    "Assinaturas para serviços recorrentes.",
    "Venda de produtos (purificadores de água, ferramentas).",
    "Treinamento e pontuação de qualidade dos profissionais.",
  ],
};
