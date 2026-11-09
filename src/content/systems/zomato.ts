import type { SystemDesignInput } from "@/types/schema";

export const zomato: SystemDesignInput = {
  slug: "zomato",
  name: "Zomato / delivery de comida",
  tagline: "Descoberta de restaurantes, pedidos e rastreamento de entrega ao vivo",
  description:
    "Três apps se encontram em um único pedido: o cliente pede, o restaurante aceita e prepara, e um entregador coleta e entrega. A descoberta é uma busca geográfica sobre os restaurantes que entregam para você. Assim que um pedido é pago e aceito, um serviço de despacho escolhe um entregador próximo usando um índice geográfico em tempo real, calculado para que o entregador chegue quando a comida estiver pronta, e todos acompanham o progresso em um mapa ao vivo.",
  category: "mobility",
  difficulty: 3,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "idempotency", "caching", "search-indexing"],

  requirements: {
    functional: [
      "Descobrir restaurantes que entregam na sua localização, com cardápios, avaliações e tempos estimados (ETAs)",
      "Montar um carrinho, aplicar cupons/ofertas, pagar",
      "Restaurantes aceitam pedidos e os marcam como prontos",
      "Atribuir um entregador parceiro e rastreá-lo ao vivo",
      "Avaliações e comentários para restaurantes e entregadores",
    ],
    nonFunctional: [
      "Picos na hora do jantar várias vezes maiores que a média diária",
      "Atribuição de entregador em poucos segundos após o restaurante aceitar",
      "Atualizações de localização refletidas em poucos segundos",
      "Um pedido nunca é cobrado duas vezes nem perdido",
    ],
  },

  apis: [
    { method: "GET", path: "/restaurants?lat=&lng=&cuisine=", purpose: "Restaurantes que entregam aqui, ranqueados" },
    { method: "GET", path: "/restaurants/{id}/menu", purpose: "Cardápio com disponibilidade em tempo real" },
    { method: "POST", path: "/orders", purpose: "Fazer um pedido (Idempotency-Key)" },
    { method: "POST", path: "/orders/{id}/status", purpose: "Restaurante ou entregador atualiza o status" },
    { method: "WS", path: "/orders/{id}/track", purpose: "Localização do entregador e ETA em tempo real" },
  ],

  estimates: [
    { label: "Pedidos", value: "≈ 2 M/dia", derivation: "Premissa; ~23/s em média, ~150/s no pico do jantar" },
    { label: "Entregadores ativos no pico", value: "≈ 200 k", derivation: "Premissa" },
    { label: "Atualizações de localização de entregadores", value: "≈ 50 k/s", derivation: "200 k entregadores ÷ um ping a cada 4 s" },
    { label: "Requisições de descoberta", value: "≈ 10–20 k/s no pico", derivation: "A navegação supera em muito o número de pedidos" },
  ],

  dataModel: [
    {
      entity: "Order",
      store: "DB relacional, com sharding por cidade",
      key: "orderId",
      fields: ["customerId", "restaurantId", "items", "total", "status", "riderId", "paymentId"],
      why: "Máquina de estados: feito → aceito → pronto → coletado → entregue",
    },
    {
      entity: "Restaurant",
      store: "DB relacional + índice de busca",
      key: "restaurantId",
      fields: ["location", "deliveryRadius", "cuisines", "rating", "isOpen", "prepTime"],
      why: "Busca geográfica mais filtros",
    },
    {
      entity: "Rider location",
      store: "Índice geográfico em memória",
      key: "célula geográfica → riderIds",
      fields: ["lat", "lng", "status", "updatedAt"],
      why: "Atualizações constantes; consultas de 'entregadores livres mais próximos'",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "App do cliente", role: "Navegar, pedir, rastrear" },
    { id: "restaurant", kind: "web-client", label: "App do restaurante", role: "Aceitar pedidos, marcar como pronto, gerenciar cardápio" },
    { id: "rider", kind: "mobile-client", label: "App do entregador", role: "Aceitar entregas, transmitir GPS" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Fotos de cardápios e pratos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits, roteamento" },
    { id: "discovery-svc", kind: "service", label: "Serviço de descoberta", role: "Busca geográfica e ranqueamento de restaurantes" },
    { id: "restaurant-index", kind: "search", label: "Índice de restaurantes", role: "Restaurantes com localização, culinária, avaliação" },
    { id: "menu-cache", kind: "cache", label: "Cache de cardápios", role: "Cardápios e disponibilidade de itens" },
    { id: "order-svc", kind: "service", label: "Serviço de pedidos", role: "Ciclo de vida do pedido" },
    { id: "order-db", kind: "relational-db", label: "Pedidos", role: "Pedidos por cidade" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamento", role: "Cobranças, reembolsos, repasses para restaurantes e entregadores" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões, carteiras digitais" },
    { id: "dispatch", kind: "service", label: "Serviço de despacho", role: "Escolhe um entregador por distância, carga e tempo de preparo" },
    { id: "rt", kind: "realtime-gateway", label: "Gateway de tempo real", role: "Entrada de GPS do entregador; saída de rastreamento ao vivo e ofertas de pedido" },
    { id: "geo-index", kind: "cache", label: "Índice geográfico de entregadores", role: "Entregadores livres por célula do mapa" },
    { id: "eta", kind: "ml-platform", label: "Modelos de ETA e tempo de preparo", role: "Preveem o tempo de cozimento e de deslocamento" },
    { id: "events", kind: "event-stream", label: "Eventos de pedido", role: "Cada mudança de status" },
    { id: "notify", kind: "notifications", label: "Push e SMS", role: "Atualizações do pedido" },
  ],

  edges: [
    { id: "customer-cdn", from: "customer", to: "cdn" },
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "restaurant-gateway", from: "restaurant", to: "gateway" },
    { id: "gateway-discovery", from: "gateway", to: "discovery-svc", protocol: "grpc" },
    { id: "discovery-index", from: "discovery-svc", to: "restaurant-index" },
    { id: "discovery-menu", from: "discovery-svc", to: "menu-cache" },
    { id: "gateway-order", from: "gateway", to: "order-svc", protocol: "grpc" },
    { id: "order-db-write", from: "order-svc", to: "order-db" },
    { id: "order-payment", from: "order-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "order-events", from: "order-svc", to: "events", protocol: "stream" },
    { id: "events-dispatch", from: "events", to: "dispatch", label: "Pedidos aceitos", protocol: "async" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Entregadores livres próximos" },
    { id: "dispatch-eta", from: "dispatch", to: "eta" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Oferta", protocol: "ws" },
    { id: "rider-rt", from: "rider", to: "rt", label: "GPS", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index", label: "Atualizar posição" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Rastrear", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "order",
      name: "Pedir o jantar",
      steps: [
        { edge: "customer-gateway", text: "O cliente abre o app em casa." },
        { edge: "gateway-discovery", text: "A descoberta encontra restaurantes que entregam ali." },
        { edge: "discovery-index", text: "O índice filtra pelo raio de entrega e ranqueia por avaliação, ETA e ofertas." },
        { edge: "gateway-order", text: "O cliente finaliza a compra (checkout)." },
        { edge: "order-db-write", text: "O pedido é salvo como PENDING_PAYMENT antes de qualquer movimentação financeira." },
        { edge: "order-payment", text: "O pagamento é processado, vinculado ao ID do pedido para que novas tentativas não cobrem duas vezes." },
        { edge: "payment-psp", text: "O provedor de pagamento aprova e o pedido passa para PLACED." },
        { edge: "order-events", text: "O restaurante é notificado e aceita; o evento 'aceito' é publicado." },
        { edge: "events-dispatch", text: "O despacho começa a procurar um entregador, sincronizado com o tempo de preparo previsto." },
        { edge: "dispatch-geo", text: "Ele encontra entregadores livres perto do restaurante." },
        { edge: "dispatch-eta", text: "Os entregadores são ranqueados pelo tempo de deslocamento para chegarem exatamente quando a comida ficar pronta." },
        { edge: "dispatch-rt", text: "A oferta é enviada para o melhor entregador, que a aceita." },
      ],
    },
    {
      id: "track",
      name: "Rastreamento ao vivo",
      steps: [
        { edge: "rider-rt", text: "O app do entregador transmite o GPS a cada poucos segundos." },
        { edge: "rt-geo", text: "A posição dele é atualizada no índice geográfico." },
        { edge: "customer-rt", text: "O mapa do cliente recebe cada atualização e um novo ETA." },
        { edge: "events-notify", text: "Notificações push avisam sobre a coleta e a chegada." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Picos na hora do jantar",
      fix: "Fazer autoscaling dos serviços stateless, fazer cache de cardápios e resultados de descoberta por área, e desativar recursos não essenciais sob alta carga (load shedding).",
      nodes: ["discovery-svc", "menu-cache", "order-svc"],
    },
    {
      problem: "Entregadores chegam cedo demais ou tarde demais",
      fix: "Despachar com base no tempo de preparo previsto e no ETA de deslocamento em vez do 'entregador mais próximo agora'; agrupar pedidos próximos.",
      nodes: ["dispatch", "eta"],
    },
    {
      problem: "Atualizações constantes de GPS",
      fix: "Índice geográfico em memória com sharding por célula; reduzir a amostragem (downsample) do histórico para analytics.",
      nodes: ["rt", "geo-index"],
    },
  ],

  scaling: [
    "Particionar pedidos, despacho e dados geográficos por cidade.",
    "Pipeline de pedidos orientado a eventos para que pagamento, despacho e notificações escalem separadamente.",
    "CDN para todas as imagens.",
  ],

  extensions: [
    "Mercado e entregas rápidas (quick commerce) a partir de dark stores.",
    "Reservas de mesas.",
    "Assinatura para entrega grátis.",
  ],
};
