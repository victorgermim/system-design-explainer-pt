import type { SystemDesignInput } from "@/types/schema";

export const practo: SystemDesignInput = {
  slug: "practo",
  name: "Practo / teleconsulta",
  tagline: "Encontre médicos, agende consultas e atenda por vídeo",
  description:
    "Pacientes buscam médicos por especialidade e localização e depois reservam um horário na agenda do médico, com uma retenção curta enquanto pagam. No horário da consulta, os dois entram em uma chamada de vídeo estabelecida por meio de signalling WebRTC, com relays TURN para redes difíceis. Receitas e exames são armazenados como prontuários criptografados, acessíveis apenas ao paciente e aos seus médicos.",
  category: "bookings",
  difficulty: 2,
  concepts: ["webrtc", "distributed-locks", "websockets", "idempotency", "search-indexing", "authentication"],

  requirements: {
    functional: [
      "Buscar médicos por especialidade, localização, idioma, valor e avaliação",
      "Agendar consultas presenciais ou por vídeo a partir dos horários disponíveis",
      "Consultas por vídeo, áudio e chat",
      "Receitas eletrônicas e prontuários compartilhados com o paciente",
      "Pagamentos, lembretes e retornos",
    ],
    nonFunctional: [
      "Dados de saúde criptografados e com controle de acesso (conformidade no estilo HIPAA)",
      "Nenhum horário agendado em duplicidade",
      "Chamadas funcionam em redes móveis com baixa latência",
      "Todo acesso aos prontuários é auditado",
    ],
  },

  apis: [
    { method: "GET", path: "/doctors?specialty=&city=&mode=video", purpose: "Médicos com os próximos horários disponíveis" },
    { method: "POST", path: "/appointments", purpose: "Reserva um horário (retém durante o pagamento)" },
    { method: "WS", path: "/consultations/{id}/signal", purpose: "Signalling WebRTC para a chamada" },
    { method: "POST", path: "/consultations/{id}/prescription", purpose: "O médico emite uma receita eletrônica" },
    { method: "GET", path: "/records", purpose: "Prontuários e receitas do próprio paciente" },
  ],

  estimates: [
    { label: "Consultas", value: "≈ 100 k/dia", derivation: "Premissa; vídeo e presencial combinados" },
    { label: "Chamadas simultâneas no pico", value: "≈ 5 k", derivation: "Pico da noite, ~15 minutos cada" },
    { label: "Médicos", value: "≈ 100 k cadastrados", derivation: "Premissa" },
    { label: "Prontuários", value: "≈ 50 GB/dia", derivation: "Receitas e exames enviados" },
  ],

  dataModel: [
    {
      entity: "Horário do médico",
      store: "Relational DB",
      key: "doctorId + start",
      fields: ["mode (clinic/video)", "status", "appointmentId"],
      why: "A reserva condicional evita agendamento duplicado",
    },
    {
      entity: "Consulta agendada",
      store: "Relational DB",
      key: "appointmentId",
      fields: ["patientId", "doctorId", "slot", "mode", "status", "paymentId"],
      why: "Ciclo de vida e pagamento",
    },
    {
      entity: "Prontuário de saúde",
      store: "Encrypted object storage + metadata DB",
      key: "patientId/recordId",
      fields: ["type", "doctorId", "encrypted file", "accessList"],
      why: "Dado sensível; chaves por registro e listas de acesso",
    },
  ],

  nodes: [
    { id: "patient", kind: "mobile-client", label: "App do paciente", role: "Buscar, agendar, consultar, ver prontuários" },
    { id: "doctor", kind: "web-client", label: "App do médico", role: "Agenda, consultas, receitas" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, papéis, logs de auditoria" },
    { id: "identity", kind: "identity", label: "Identidade", role: "Contas de pacientes e de médicos verificados" },
    { id: "search-svc", kind: "service", label: "Busca de médicos", role: "Especialidade, localização e disponibilidade" },
    { id: "doctor-index", kind: "search", label: "Índice de médicos", role: "Médicos, clínicas e próximo horário livre" },
    { id: "booking-svc", kind: "service", label: "Serviço de agendamento", role: "Horários, retenções e reservas" },
    { id: "slot-holds", kind: "cache", label: "Retenções de horário", role: "Retenções de curta duração durante o pagamento" },
    { id: "main-db", kind: "relational-db", label: "Consultas e horários", role: "Fonte da verdade" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Valores das consultas e reembolsos" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões" },
    { id: "signal", kind: "realtime-gateway", label: "Signalling da chamada e chat", role: "Signalling WebRTC e chat durante a chamada" },
    { id: "media", kind: "webrtc-media", label: "Servidores TURN / mídia", role: "Retransmite chamadas em redes restritivas" },
    { id: "records-svc", kind: "service", label: "Serviço de prontuários", role: "Receitas e exames com controle de acesso" },
    { id: "records", kind: "object-storage", label: "Prontuários criptografados", role: "Documentos de saúde" },
    { id: "kms", kind: "secrets", label: "Gerenciamento de chaves", role: "Chaves de criptografia dos prontuários" },
    { id: "notify", kind: "notifications", label: "Lembretes", role: "Lembretes por SMS e push" },
  ],

  edges: [
    { id: "patient-gateway", from: "patient", to: "gateway" },
    { id: "doctor-gateway", from: "doctor", to: "gateway" },
    { id: "gateway-identity", from: "gateway", to: "identity", label: "Verificar token" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index", from: "search-svc", to: "doctor-index" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-holds", from: "booking-svc", to: "slot-holds", label: "Reter horário" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db", from: "booking-svc", to: "main-db", label: "Confirmar" },
    { id: "booking-notify", from: "booking-svc", to: "notify" },
    { id: "patient-signal", from: "patient", to: "signal", protocol: "ws" },
    { id: "doctor-signal", from: "doctor", to: "signal", protocol: "ws" },
    { id: "patient-media", from: "patient", to: "media", label: "Vídeo" },
    { id: "doctor-media", from: "doctor", to: "media" },
    { id: "gateway-records", from: "gateway", to: "records-svc", protocol: "grpc" },
    { id: "records-store", from: "records-svc", to: "records" },
    { id: "records-kms", from: "records-svc", to: "kms", label: "Criptografar / descriptografar" },
  ],

  flows: [
    {
      id: "book",
      name: "Agendar uma consulta por vídeo",
      steps: [
        { edge: "patient-gateway", text: "O paciente busca um dermatologista disponível hoje por vídeo." },
        { edge: "gateway-search", text: "A busca filtra por especialidade, idioma e modalidade." },
        { edge: "search-index", text: "Os resultados incluem o próximo horário livre de cada médico." },
        { edge: "gateway-booking", text: "O paciente escolhe 18h30." },
        { edge: "booking-holds", text: "O horário fica retido por alguns minutos." },
        { edge: "booking-payment", text: "O valor da consulta é pago." },
        { edge: "payment-psp", text: "O provedor de pagamento aprova." },
        { edge: "booking-db", text: "O horário é reservado com uma atualização condicional." },
        { edge: "booking-notify", text: "Ambos recebem confirmações e lembretes." },
      ],
    },
    {
      id: "consult",
      name: "Consulta",
      steps: [
        { edge: "patient-signal", text: "Às 18h30 o paciente entra; o signalling troca as offers do WebRTC." },
        { edge: "doctor-signal", text: "O médico entra pelo painel." },
        { edge: "patient-media", text: "O vídeo flui peer-to-peer ou por um relay TURN." },
        { edge: "gateway-records", text: "Após a chamada, o médico emite uma receita." },
        { edge: "records-kms", text: "Ela é criptografada com uma chave do gerenciamento de chaves…" },
        { edge: "records-store", text: "…e armazenada; só o paciente e os médicos autorizados podem lê-la, e cada leitura é registrada em log." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Chamadas falhando em redes móveis ruins",
      fix: "Relays TURN na própria região, bitrate adaptativo e fallback somente com áudio.",
      nodes: ["media", "signal"],
    },
    {
      problem: "Proteção dos dados de saúde",
      fix: "Criptografia com chaves gerenciadas, controle de acesso rigoroso baseado em papéis e logs de auditoria em todo acesso.",
      nodes: ["records-svc", "kms", "gateway"],
    },
    {
      problem: "Horários agendados em duplicidade",
      fix: "Retenções durante o pagamento mais confirmação condicional no banco de dados.",
      nodes: ["slot-holds", "main-db"],
    },
  ],

  scaling: [
    "Manter os dados de saúde dentro do país para cumprir as regras de residência de dados.",
    "Escalar os relays de mídia pelo número de chamadas simultâneas.",
    "Particionar as consultas por região.",
  ],

  extensions: [
    "Agendamento de exames laboratoriais e coleta de amostras em domicílio.",
    "Entrega de medicamentos a partir das receitas.",
    "Verificador de sintomas com IA antes do agendamento.",
  ],
};
