import type { SystemDesignInput } from "@/types/schema";

export const meetingScheduler: SystemDesignInput = {
  slug: "meeting-scheduler",
  name: "Agendador de reuniões",
  tagline: "Encontre um horário, reserve uma sala, convide a todos",
  description:
    "O agendamento gira principalmente em torno de livre/ocupado: o sistema mescla os calendários dos participantes (incluindo os externos) em uma visão em cache de intervalos ocupados e encontra horários livres em comum. A reserva garante a sala com uma inserção condicional para que duas reuniões não ocupem a mesma sala e horário, e depois envia os convites. Um agendador dispara lembretes antes de cada reunião.",
  category: "bookings",
  difficulty: 1,
  concepts: ["distributed-locks", "caching", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Criar reuniões com participantes, horário, duração e sala opcional",
      "Sugerir horários em que todos estejam livres",
      "Reservar salas sem conflito de horário (double-booking)",
      "Enviar convites; participantes aceitam ou recusam",
      "Reuniões recorrentes e lembretes",
      "Sincronizar com calendários externos",
    ],
    nonFunctional: [
      "Sem reservas sobrepostas para uma mesma sala",
      "Respostas de livre/ocupado em bem menos de um segundo",
      "Fusos horários tratados corretamente em todos os lugares",
    ],
  },

  apis: [
    { method: "POST", path: "/availability/query", purpose: "{ attendees, rangeStart, rangeEnd, duration } → horários livres" },
    { method: "POST", path: "/meetings", purpose: "Criar uma reunião e reservar uma sala (Idempotency-Key)" },
    { method: "PATCH", path: "/meetings/{id}", purpose: "Reagendar ou alterar participantes" },
    { method: "POST", path: "/meetings/{id}/rsvp", purpose: "Aceitar ou recusar" },
    { method: "GET", path: "/rooms?capacity=&from=&to=", purpose: "Salas livres em um intervalo" },
  ],

  estimates: [
    { label: "Usuários", value: "≈ 1 M em um grupo organizacional", derivation: "Premissa para uma grande base de tenants SaaS" },
    { label: "Reuniões criadas", value: "≈ 5 M/dia (~60/s)", derivation: "1 M usuários × 5 reuniões" },
    { label: "Consultas de livre/ocupado", value: "≈ 10× criações", derivation: "As pessoas exploram vários horários antes de reservar" },
    { label: "Eventos armazenados", value: "≈ 2 B/ano", derivation: "Incluindo instâncias recorrentes" },
  ],

  dataModel: [
    {
      entity: "Event",
      store: "DB relacional",
      key: "eventId",
      fields: ["organizerId", "start", "end", "timezone", "recurrenceRule", "roomId"],
      why: "Alterações transacionais e regras de recorrência",
    },
    {
      entity: "Attendee",
      store: "DB relacional",
      key: "eventId + userId",
      fields: ["response", "notifiedAt"],
      why: "Estado de confirmação (RSVP) por pessoa",
    },
    {
      entity: "Room booking",
      store: "DB relacional",
      key: "roomId + time slot",
      fields: ["eventId"],
      why: "Uma restrição de exclusão em (sala, intervalo de tempo) impede sobreposições",
    },
    {
      entity: "Free/busy",
      store: "Cache em memória",
      key: "userId + day",
      fields: ["busy intervals[]"],
      why: "Mesclagem rápida entre muitos participantes",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Calendário web", role: "Criar e gerenciar reuniões" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "RSVP e lembretes" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação e roteamento" },
    { id: "calendar-svc", kind: "service", label: "Serviço de calendário", role: "Criar, atualizar e expandir reuniões" },
    { id: "availability-svc", kind: "service", label: "Serviço de livre/ocupado", role: "Mescla intervalos ocupados e encontra horários comuns" },
    { id: "freebusy-cache", kind: "cache", label: "Cache de livre/ocupado", role: "Intervalos ocupados por usuário por dia" },
    { id: "room-svc", kind: "service", label: "Reserva de salas", role: "Reserva salas sem sobreposições" },
    { id: "calendar-db", kind: "relational-db", label: "Eventos e salas", role: "Reuniões, participantes e reservas de salas" },
    { id: "external", kind: "partner-api", label: "Calendários externos", role: "Calendários do Google / Outlook via sincronização" },
    { id: "reminders", kind: "workflow", label: "Agendador de lembretes", role: "Dispara lembretes no momento certo" },
    { id: "events", kind: "event-stream", label: "Eventos de calendário", role: "Criados, alterados, cancelados" },
    { id: "notify", kind: "notifications", label: "E-mail e push", role: "Convites, atualizações, lembretes" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-availability", from: "gateway", to: "availability-svc", protocol: "grpc" },
    { id: "availability-cache", from: "availability-svc", to: "freebusy-cache" },
    { id: "availability-external", from: "availability-svc", to: "external", label: "Horários ocupados externos" },
    { id: "gateway-calendar", from: "gateway", to: "calendar-svc", protocol: "grpc" },
    { id: "calendar-room", from: "calendar-svc", to: "room-svc", protocol: "grpc" },
    { id: "room-db", from: "room-svc", to: "calendar-db", label: "Inserção condicional" },
    { id: "calendar-db-write", from: "calendar-svc", to: "calendar-db" },
    { id: "calendar-events", from: "calendar-svc", to: "events", protocol: "stream" },
    { id: "events-cache", from: "events", to: "freebusy-cache", label: "Invalidar", protocol: "async" },
    { id: "events-notify", from: "events", to: "notify", label: "Convites", protocol: "async" },
    { id: "events-reminders", from: "events", to: "reminders", label: "Agendar", protocol: "async" },
    { id: "reminders-notify", from: "reminders", to: "notify", label: "Lembrar" },
  ],

  flows: [
    {
      id: "schedule",
      name: "Agendar uma reunião",
      steps: [
        { edge: "web-gateway", text: "O organizador escolhe os participantes e uma duração." },
        { edge: "gateway-availability", text: "O serviço de livre/ocupado é consultado sobre horários para esta semana." },
        { edge: "availability-cache", text: "Ele mescla os intervalos ocupados em cache de cada participante…" },
        { edge: "availability-external", text: "…mais os horários ocupados de seus calendários externos, e retorna os horários livres em comum." },
        { edge: "gateway-calendar", text: "O organizador escolhe um horário e uma sala." },
        { edge: "calendar-room", text: "O serviço de salas reserva a sala." },
        { edge: "room-db", text: "Uma restrição de exclusão rejeita a inserção se houver sobreposição — sem reserva duplicada." },
        { edge: "calendar-db-write", text: "A reunião e os participantes são salvos." },
        { edge: "calendar-events", text: "Um evento 'reunião criada' é publicado." },
        { edge: "events-cache", text: "As entradas de livre/ocupado dos participantes são atualizadas." },
        { edge: "events-notify", text: "Os convites são enviados." },
        { edge: "events-reminders", text: "Um lembrete é agendado para 10 minutos antes." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Mesclar calendários para grandes grupos",
      fix: "Fazer cache dos intervalos ocupados por usuário por dia e mesclar listas de intervalos ordenadas (O(n log n)).",
      nodes: ["availability-svc", "freebusy-cache"],
    },
    {
      problem: "Duas pessoas reservando a mesma sala ao mesmo tempo",
      fix: "Restrição de exclusão no banco de dados em (sala, intervalo de tempo) — a segunda inserção falha de forma limpa.",
      nodes: ["room-svc", "calendar-db"],
    },
    {
      problem: "Reuniões recorrentes com exceções",
      fix: "Armazenar a regra de recorrência mais as exceções (overrides); expandir as instâncias sob demanda (lazy) para o intervalo visível.",
      nodes: ["calendar-svc"],
    },
  ],

  scaling: [
    "Fazer sharding de eventos por organização (tenant).",
    "Armazenar horários em UTC com o fuso horário original para exibição e recorrência.",
    "Executar sincronização de calendários externos em background workers com webhooks.",
  ],

  extensions: [
    "Links de agendamento para pessoas externas (estilo Calendly).",
    "Links automáticos de videochamada.",
    "Sugestões inteligentes que respeitam o horário de trabalho e o tempo de foco.",
  ],
};
