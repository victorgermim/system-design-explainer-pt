import type { SystemDesignInput } from "@/types/schema";

export const nobroker: SystemDesignInput = {
  slug: "nobroker",
  name: "NoBroker",
  tagline: "Aluguel e venda de imóveis sem corretor",
  description:
    "Proprietários anunciam imóveis com fotos; os anúncios são verificados (automaticamente e pela equipe) antes de entrarem no ar em um índice de busca geográfica. Inquilinos navegam de graça, mas desbloqueiam os dados de contato dos proprietários com um plano pago, e então conversam e agendam visitas. Pagamentos de aluguel e serviços adicionais passam pela mesma plataforma de pagamentos.",
  category: "bookings",
  difficulty: 2,
  concepts: ["search-indexing", "geospatial-indexing", "presigned-urls", "websockets", "event-driven"],

  requirements: {
    functional: [
      "Proprietários publicam imóveis com fotos, preço, localização e comodidades",
      "Os anúncios são verificados para eliminar corretores e fraudes",
      "Inquilinos e compradores buscam por região, orçamento, tipo e comodidades, em um mapa",
      "Planos pagos desbloqueiam contatos dos proprietários; chat e agendamento de visitas",
      "Pagar aluguel e contratar serviços (mudança, limpeza)",
    ],
    nonFunctional: [
      "Resultados de busca em menos de um segundo",
      "Os dados de contato ficam protegidos até serem desbloqueados",
      "Spam e fraude mantidos em nível baixo",
    ],
  },

  apis: [
    { method: "POST", path: "/listings", purpose: "Cria um anúncio; retorna URLs de upload das fotos" },
    { method: "GET", path: "/search?city=&bbox=&budget=&bhk=", purpose: "Anúncios verificados correspondentes" },
    { method: "POST", path: "/listings/{id}/contact", purpose: "Desbloqueia o contato do proprietário (consome créditos do plano)" },
    { method: "POST", path: "/visits", purpose: "Solicita um horário de visita" },
    { method: "WS", path: "/chat", purpose: "Chat proprietário–inquilino" },
  ],

  estimates: [
    { label: "Usuários", value: "≈ 5 M por mês, 500 k por dia", derivation: "Premissa do PDF" },
    { label: "Anúncios ativos", value: "≈ 1 M", derivation: "Premissa" },
    { label: "Buscas", value: "≈ 60 req/s em média", derivation: "500 k usuários × 10 buscas ÷ 86.400 s; pico noturno de 5×" },
    { label: "Fotos", value: "≈ 20 TB", derivation: "1 M de anúncios × 10 fotos × ~2 MB" },
  ],

  dataModel: [
    {
      entity: "Anúncio",
      store: "Relational DB + search index",
      key: "listingId",
      fields: ["ownerId", "location", "type", "rent/price", "bhk", "amenities", "status (pending/live)"],
      why: "Fonte da verdade mais uma cópia pesquisável por localização",
    },
    {
      entity: "Desbloqueio de contato",
      store: "Relational DB",
      key: "userId + listingId",
      fields: ["planId", "unlockedAt"],
      why: "Aplica os limites do plano e mantém uma trilha de auditoria",
    },
    {
      entity: "Mensagem de chat",
      store: "Wide-column DB",
      key: "threadId + time",
      fields: ["senderId", "text"],
      why: "Alto volume de escrita por conversa",
    },
  ],

  nodes: [
    { id: "tenant", kind: "mobile-client", label: "App do inquilino / comprador", role: "Busca, desbloqueio, chat, visita" },
    { id: "owner", kind: "web-client", label: "App do proprietário", role: "Publica e gerencia anúncios" },
    { id: "cdn", kind: "cdn", label: "CDN de fotos", role: "Fotos dos anúncios" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits" },
    { id: "listing-svc", kind: "service", label: "Serviço de anúncios", role: "Cria e atualiza anúncios" },
    { id: "verification", kind: "ml-platform", label: "Verificação e fraude", role: "Sinaliza corretores, duplicatas e anúncios falsos" },
    { id: "search-svc", kind: "service", label: "Serviço de busca", role: "Busca geográfica e por filtros" },
    { id: "search-index", kind: "search", label: "Índice de anúncios", role: "Anúncios no ar com pontos geográficos" },
    { id: "lead-svc", kind: "service", label: "Contatos e visitas", role: "Verificação de plano, desbloqueio de contatos, agendamento de visitas" },
    { id: "chat", kind: "realtime-gateway", label: "Chat", role: "Mensagens proprietário–inquilino" },
    { id: "payment-svc", kind: "service", label: "Planos e pagamentos", role: "Assinaturas, pagamentos de aluguel, serviços" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões" },
    { id: "main-db", kind: "relational-db", label: "Anúncios, usuários e planos", role: "Dados transacionais" },
    { id: "photos", kind: "object-storage", label: "Fotos", role: "Imagens enviadas" },
    { id: "events", kind: "event-stream", label: "Eventos de anúncios", role: "Criado, verificado, atualizado" },
    { id: "notify", kind: "notifications", label: "Push e SMS", role: "Novas correspondências, lembretes de visita" },
  ],

  edges: [
    { id: "owner-gateway", from: "owner", to: "gateway" },
    { id: "tenant-gateway", from: "tenant", to: "gateway" },
    { id: "owner-photos", from: "owner", to: "photos", label: "Upload (pré-assinado)" },
    { id: "tenant-cdn", from: "tenant", to: "cdn", label: "Fotos" },
    { id: "cdn-photos", from: "cdn", to: "photos" },
    { id: "gateway-listing", from: "gateway", to: "listing-svc", protocol: "grpc" },
    { id: "listing-db", from: "listing-svc", to: "main-db" },
    { id: "listing-events", from: "listing-svc", to: "events", protocol: "stream" },
    { id: "events-verify", from: "events", to: "verification", protocol: "async" },
    { id: "verify-db", from: "verification", to: "main-db", label: "Aprovar / rejeitar" },
    { id: "events-index", from: "events", to: "search-index", label: "Indexar anúncios no ar", protocol: "stream" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-read", from: "search-svc", to: "search-index" },
    { id: "gateway-lead", from: "gateway", to: "lead-svc", protocol: "grpc" },
    { id: "lead-db", from: "lead-svc", to: "main-db", label: "Créditos do plano" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "tenant-chat", from: "tenant", to: "chat", protocol: "ws" },
    { id: "owner-chat", from: "owner", to: "chat", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", label: "Alertas de correspondência", protocol: "async" },
  ],

  flows: [
    {
      id: "post",
      name: "Publicar um anúncio",
      steps: [
        { edge: "owner-gateway", text: "O proprietário preenche os detalhes." },
        { edge: "gateway-listing", text: "O serviço de anúncios valida os detalhes." },
        { edge: "listing-db", text: "O anúncio é salvo como PENDING e as URLs de upload das fotos são retornadas." },
        { edge: "owner-photos", text: "As fotos são enviadas direto para o armazenamento." },
        { edge: "listing-events", text: "Quando as fotos chegam, um evento 'anúncio criado' é publicado." },
        { edge: "events-verify", text: "Modelos verificam corretores, duplicatas e fotos falsas; os casos duvidosos vão para a equipe." },
        { edge: "verify-db", text: "O anúncio é aprovado." },
        { edge: "events-index", text: "Ele passa a poder ser encontrado na busca." },
        { edge: "events-notify", text: "Inquilinos com buscas salvas correspondentes são alertados." },
      ],
    },
    {
      id: "contact",
      name: "Contatar um proprietário",
      steps: [
        { edge: "tenant-gateway", text: "O inquilino busca uma região no mapa." },
        { edge: "gateway-search", text: "O serviço de busca filtra por orçamento e tipo." },
        { edge: "search-read", text: "Os anúncios no ar correspondentes são retornados." },
        { edge: "gateway-lead", text: "O inquilino toca em 'contatar proprietário'." },
        { edge: "lead-db", text: "Um crédito do plano é consumido e o desbloqueio é registrado." },
        { edge: "tenant-chat", text: "Eles conversam e agendam uma visita." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Corretores e anúncios falsos",
      fix: "Verificações automáticas de fotos, números de telefone e padrões de publicação, mais revisão manual antes de entrar no ar.",
      nodes: ["verification"],
    },
    {
      problem: "Scraping de contatos de proprietários",
      fix: "Esconder os contatos atrás de desbloqueios autenticados e com rate limit; mascarar números de telefone no chat.",
      nodes: ["lead-svc", "gateway"],
    },
    {
      problem: "Picos de busca à noite",
      fix: "Fazer cache das buscas populares por bairro e escalar as réplicas de busca.",
      nodes: ["search-svc", "search-index"],
    },
  ],

  scaling: [
    "Particionar anúncios e busca por cidade.",
    "CDN para todas as fotos; redimensionar no upload.",
    "Pipelines assíncronos para verificação e notificações.",
  ],

  extensions: [
    "Contratos de aluguel e assinatura eletrônica.",
    "Marketplace de serviços domésticos (mudança, pintura).",
    "Estimativas de preço de uma região a partir de anúncios passados.",
  ],
};
