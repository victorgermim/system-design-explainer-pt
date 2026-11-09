import type { SystemDesignInput } from "@/types/schema";

export const driverFleet: SystemDesignInput = {
  slug: "driver-fleet",
  name: "Reserva de motoristas e gestão de frotas",
  tagline: "Contrate um motorista para o seu carro e gerencie frotas de motoristas e veículos",
  description:
    "Os clientes reservam um motorista verificado por hora ou por viagem para dirigir seu próprio carro; operadores de frota gerenciam vários motoristas e veículos a partir de um painel. Um serviço de despacho combina reservas com motoristas disponíveis próximos, uma camada em tempo real acompanha turnos e viagens, a telemetria transmite a saúde dos veículos e um pipeline de folha de pagamento transforma viagens concluídas em repasses para os motoristas.",
  category: "mobility",
  difficulty: 2,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "sharding"],

  requirements: {
    functional: [
      "Reservar um motorista para agora ou agendar, por horas, viagem ou viagem intermunicipal",
      "Onboarding de motoristas com KYC e verificação de antecedentes",
      "Rastreamento em tempo real do motorista e do veículo",
      "Painéis de frota: turnos, utilização, saúde do veículo e conformidade",
      "Tarifas, faturas e repasses semanais aos motoristas",
    ],
    nonFunctional: [
      "Encontrar um motorista em menos de um minuto para reservas sob demanda",
      "Atualizações de localização em poucos segundos",
      "Documentos dos motoristas armazenados com segurança",
    ],
  },

  apis: [
    { method: "POST", path: "/bookings", purpose: "{ type, start, pickup, durationHours } → reserva" },
    { method: "WS", path: "/driver/socket", purpose: "Status do turno, GPS, ofertas de reserva" },
    { method: "GET", path: "/fleet/{fleetId}/drivers?status=", purpose: "Dados do painel da frota" },
    { method: "POST", path: "/drivers", purpose: "Cadastrar um motorista com documentos" },
    { method: "GET", path: "/drivers/{id}/earnings", purpose: "Viagens e repasses" },
  ],

  estimates: [
    { label: "Motoristas", value: "≈ 200 mil cadastrados, 50 mil online", derivation: "Estimativa" },
    { label: "Reservas", value: "≈ 100 mil/dia", derivation: "Estimativa" },
    { label: "Atualizações de GPS", value: "≈ 12 mil/s", derivation: "50 mil motoristas online ÷ a cada 4 s" },
    { label: "Telemetria", value: "≈ 5 mil msgs/s", derivation: "Veículos da frota reportando uma vez por minuto" },
  ],

  dataModel: [
    {
      entity: "Motorista",
      store: "Banco relacional",
      key: "driverId",
      fields: ["fleetId", "kycStatus", "licence", "rating", "skills (manual/automatic, outstation)"],
      why: "Perfis e status de conformidade",
    },
    {
      entity: "Reserva / viagem",
      store: "Banco relacional, com sharding por cidade",
      key: "bookingId",
      fields: ["customerId", "driverId", "start", "end", "fare", "status"],
      why: "Ciclo de vida e faturamento",
    },
    {
      entity: "Turno",
      store: "Banco relacional",
      key: "driverId + date",
      fields: ["onlineAt", "offlineAt", "trips", "hours"],
      why: "Folha de pagamento e utilização",
    },
    {
      entity: "Documentos do motorista",
      store: "Object storage (criptografado)",
      key: "driverId/doc",
      fields: ["licence", "ID", "background check"],
      why: "Arquivos sensíveis com acesso restrito",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "App do cliente", role: "Reservar um motorista e acompanhar a viagem" },
    { id: "driver", kind: "mobile-client", label: "App do motorista", role: "Ficar online, aceitar reservas, transmitir GPS" },
    { id: "fleet", kind: "web-client", label: "Painel da frota", role: "Operadores gerenciam motoristas e veículos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, perfis de acesso, roteamento" },
    { id: "booking-svc", kind: "service", label: "Serviço de reservas", role: "Reservas e ciclo de vida da viagem" },
    { id: "dispatch", kind: "service", label: "Despacho", role: "Combina reservas com motoristas disponíveis" },
    { id: "rt", kind: "realtime-gateway", label: "Gateway em tempo real", role: "GPS, ofertas, rastreamento ao vivo" },
    { id: "geo-index", kind: "cache", label: "Índice geográfico de motoristas", role: "Motoristas online por célula e habilidade" },
    { id: "driver-svc", kind: "service", label: "Gestão de motoristas", role: "Onboarding, KYC, turnos, conformidade" },
    { id: "documents", kind: "object-storage", label: "Documentos de motoristas", role: "Arquivos KYC criptografados" },
    { id: "main-db", kind: "relational-db", label: "Motoristas, reservas e turnos", role: "Fonte da verdade" },
    { id: "telematics", kind: "event-stream", label: "Eventos de viagem e telemetria", role: "Viagens, histórico de GPS, saúde do veículo" },
    { id: "payroll", kind: "batch-processing", label: "Folha de pagamento e repasses", role: "Cálculo semanal de ganhos" },
    { id: "warehouse", kind: "data-warehouse", label: "Analytics da frota", role: "Relatórios de utilização e desempenho" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Cobranças de clientes e repasses a motoristas" },
    { id: "notify", kind: "notifications", label: "Push e SMS", role: "Alertas de reserva e turno" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "fleet-gateway", from: "fleet", to: "gateway" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "gateway-driver", from: "gateway", to: "driver-svc", protocol: "grpc" },
    { id: "booking-db", from: "booking-svc", to: "main-db" },
    { id: "booking-dispatch", from: "booking-svc", to: "dispatch", protocol: "grpc" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Próximos + habilidades" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Oferta", protocol: "ws" },
    { id: "driver-rt", from: "driver", to: "rt", label: "GPS / status", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Rastrear", protocol: "ws" },
    { id: "driver-svc-db", from: "driver-svc", to: "main-db" },
    { id: "driver-svc-docs", from: "driver-svc", to: "documents" },
    { id: "booking-events", from: "booking-svc", to: "telematics", protocol: "stream" },
    { id: "rt-events", from: "rt", to: "telematics", label: "Histórico de GPS", protocol: "stream" },
    { id: "events-payroll", from: "telematics", to: "payroll", protocol: "stream" },
    { id: "events-warehouse", from: "telematics", to: "warehouse", protocol: "stream" },
    { id: "payroll-psp", from: "payroll", to: "psp", label: "Repasses" },
    { id: "booking-notify", from: "booking-svc", to: "notify" },
  ],

  flows: [
    {
      id: "book",
      name: "Reservar um motorista",
      steps: [
        { edge: "customer-gateway", text: "O cliente reserva um motorista por 4 horas, para agora." },
        { edge: "gateway-booking", text: "O serviço de reservas cria o pedido." },
        { edge: "booking-db", text: "Ele é salvo como SEARCHING." },
        { edge: "booking-dispatch", text: "O despacho procura um motorista." },
        { edge: "dispatch-geo", text: "Ele filtra motoristas online próximos que saibam dirigir esse tipo de carro." },
        { edge: "dispatch-rt", text: "A oferta vai para o melhor motorista, que aceita." },
        { edge: "customer-rt", text: "O cliente acompanha a chegada do motorista." },
        { edge: "booking-notify", text: "Os dados do motorista são enviados por SMS." },
      ],
    },
    {
      id: "payout",
      name: "Repasses semanais",
      steps: [
        { edge: "booking-events", text: "Cada viagem concluída é publicada." },
        { edge: "rt-events", text: "O histórico de GPS confirma as horas em serviço." },
        { edge: "events-payroll", text: "Um job semanal soma viagens, horas, incentivos e descontos." },
        { edge: "payroll-psp", text: "Os repasses são enviados para as contas bancárias dos motoristas." },
        { edge: "events-warehouse", text: "Os operadores de frota visualizam relatórios de utilização." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Combinar por habilidades além da distância",
      fix: "Indexar motoristas por célula e flags de habilidade; ampliar o raio se não houver correspondência.",
      nodes: ["dispatch", "geo-index"],
    },
    {
      problem: "Documentos sensíveis dos motoristas",
      fix: "Criptografar em repouso, restringir o acesso por perfil e auditar cada leitura.",
      nodes: ["documents", "driver-svc"],
    },
    {
      problem: "Exatidão da folha de pagamento",
      fix: "Calcular a partir de eventos de viagem imutáveis; tornar as execuções de repasse idempotentes.",
      nodes: ["payroll"],
    },
  ],

  scaling: [
    "Particione por cidade; frotas são tenants com seus próprios painéis.",
    "Transmita o histórico de GPS para armazenamento barato e mantenha apenas as posições ao vivo em memória.",
    "Execute analytics em um data warehouse, não no banco de dados operacional.",
  ],

  extensions: [
    "Contratos corporativos de motorista executivo.",
    "Treinamento de motoristas e incentivos baseados em avaliações.",
    "Manutenção preditiva a partir da telemetria.",
  ],
};
