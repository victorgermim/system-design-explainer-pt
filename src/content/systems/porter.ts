import type { SystemDesignInput } from "@/types/schema";

export const porter: SystemDesignInput = {
  slug: "porter",
  name: "Porter / entrega de cargas",
  tagline: "Peça um caminhão ou moto para transportar cargas pela cidade",
  description:
    "Como um app de corridas, mas para cargas. O cliente escolhe o tipo de veículo (moto, mini caminhão, caminhão), os pontos de coleta e entrega, e recebe a tarifa antecipada. O dispatch busca motoristas disponíveis próximos desse tipo de veículo em um índice geográfico e oferece o serviço. As viagens incluem tempo de carga, várias paradas e comprovante de entrega, e clientes empresariais podem agendar pedidos em lote.",
  category: "mobility",
  difficulty: 2,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Escolher o tipo de veículo, a coleta e uma ou mais entregas; ver a tarifa",
      "Encontrar um motorista próximo com esse tipo de veículo",
      "Rastreamento ao vivo, comprovante de entrega (foto/OTP)",
      "Pedidos agendados e em lote para empresas",
      "Pagamentos, notas fiscais e repasses aos motoristas",
    ],
    nonFunctional: [
      "Match em até um minuto em cidades movimentadas",
      "Tarifas precisas, incluindo tempo de espera e de carga",
      "Nenhuma atribuição dupla de motorista",
    ],
  },

  apis: [
    { method: "POST", path: "/quotes", purpose: "{ vehicleType, stops[] } → tarifa e ETA" },
    { method: "POST", path: "/orders", purpose: "Cria um pedido (Idempotency-Key)" },
    { method: "WS", path: "/driver/socket", purpose: "Atualizações de GPS na entrada, ofertas de corrida na saída" },
    { method: "POST", path: "/orders/{id}/pod", purpose: "Comprovante de entrega (foto, OTP)" },
    { method: "WS", path: "/orders/{id}/track", purpose: "Rastreamento ao vivo para o cliente" },
  ],

  estimates: [
    { label: "Pedidos", value: "≈ 500 k/dia", derivation: "Premissa; ~6/s em média, ~30/s no pico" },
    { label: "Motoristas online", value: "≈ 100 k", derivation: "Premissa" },
    { label: "Atualizações de GPS", value: "≈ 25 k/s", derivation: "100 k motoristas ÷ um ping a cada 4 s" },
    { label: "Fotos de POD", value: "≈ 250 GB/dia", derivation: "500 k × ~500 KB" },
  ],

  dataModel: [
    {
      entity: "Pedido",
      store: "Relational DB, sharded by city",
      key: "orderId",
      fields: ["customerId", "vehicleType", "stops[]", "fare", "status", "driverId"],
      why: "Ciclo de vida com várias paradas envolvendo dinheiro",
    },
    {
      entity: "Localização do motorista",
      store: "In-memory geo index",
      key: "vehicleType + geo cell",
      fields: ["driverId", "lat", "lng", "status"],
      why: "Motorista livre mais próximo de um dado tipo de veículo",
    },
    {
      entity: "Comprovante de entrega",
      store: "Object storage",
      key: "orderId/stop",
      fields: ["photo", "signature", "otpVerifiedAt"],
      why: "Evidência para disputas",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "App do cliente", role: "Solicitar, rastrear, pagar" },
    { id: "business", kind: "web-client", label: "Portal empresarial", role: "Pedidos agendados e em lote" },
    { id: "driver", kind: "mobile-client", label: "App do motorista", role: "GPS, ofertas, navegação, comprovante de entrega" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, roteamento" },
    { id: "pricing", kind: "service", label: "Precificação", role: "Tarifa por veículo, distância, tempo e demanda" },
    { id: "maps", kind: "maps", label: "Mapas e rotas", role: "Distância, ETA, rotas com várias paradas" },
    { id: "order-svc", kind: "service", label: "Serviço de pedidos", role: "Ciclo de vida do pedido" },
    { id: "dispatch", kind: "service", label: "Dispatch", role: "Encontra e reserva um motorista, envia a oferta" },
    { id: "rt", kind: "realtime-gateway", label: "Gateway em tempo real", role: "GPS e ofertas do motorista, rastreamento do cliente" },
    { id: "geo-index", kind: "cache", label: "Índice geográfico de motoristas", role: "Motoristas livres por tipo de veículo e célula" },
    { id: "order-db", kind: "relational-db", label: "Pedidos", role: "Pedidos por cidade" },
    { id: "pod-store", kind: "object-storage", label: "Comprovante de entrega", role: "Fotos e assinaturas" },
    { id: "payment-svc", kind: "service", label: "Pagamentos e repasses", role: "Cobranças, notas fiscais, repasses aos motoristas" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "UPI, cartões, carteiras" },
    { id: "events", kind: "event-stream", label: "Eventos de pedidos", role: "Mudanças de status" },
    { id: "notify", kind: "notifications", label: "Push e SMS", role: "Dados do motorista, OTP de entrega" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "business-gateway", from: "business", to: "gateway" },
    { id: "gateway-pricing", from: "gateway", to: "pricing", label: "Cotação", protocol: "grpc" },
    { id: "pricing-maps", from: "pricing", to: "maps" },
    { id: "gateway-order", from: "gateway", to: "order-svc", protocol: "grpc" },
    { id: "order-db-write", from: "order-svc", to: "order-db" },
    { id: "order-dispatch", from: "order-svc", to: "dispatch", protocol: "grpc" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Próximos + reserva" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Oferta", protocol: "ws" },
    { id: "driver-rt", from: "driver", to: "rt", label: "GPS", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Rastrear", protocol: "ws" },
    { id: "driver-pod", from: "driver", to: "pod-store", label: "Foto de POD" },
    { id: "order-events", from: "order-svc", to: "events", protocol: "stream" },
    { id: "events-payment", from: "events", to: "payment-svc", label: "Entregue", protocol: "async" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Transportar cargas",
      steps: [
        { edge: "customer-gateway", text: "O cliente informa coleta e entrega e escolhe um mini caminhão." },
        { edge: "gateway-pricing", text: "A precificação cota uma tarifa." },
        { edge: "pricing-maps", text: "Usando a distância da rota, o tempo esperado e a demanda atual." },
        { edge: "gateway-order", text: "O cliente confirma." },
        { edge: "order-db-write", text: "O pedido é salvo." },
        { edge: "order-dispatch", text: "O dispatch procura um motorista." },
        { edge: "dispatch-geo", text: "Mini caminhões livres perto da coleta são encontrados e o melhor é reservado." },
        { edge: "dispatch-rt", text: "A oferta é enviada ao motorista, que aceita." },
        { edge: "customer-rt", text: "O cliente rastreia o caminhão ao vivo." },
        { edge: "driver-pod", text: "Em cada entrega o motorista registra uma foto ou OTP." },
        { edge: "order-events", text: "'Entregue' é publicado." },
        { edge: "events-payment", text: "O pagamento é liquidado e os ganhos do motorista são registrados." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Poucos motoristas de um tipo de veículo raro por perto",
      fix: "Expandir o raio de busca em anéis e permitir que pedidos agendados sejam combinados com antecedência.",
      nodes: ["dispatch", "geo-index"],
    },
    {
      problem: "Disputas de tarifa sobre tempo de espera e de carga",
      fix: "Registrar o timestamp de cada evento de parada e guardar o comprovante de entrega.",
      nodes: ["order-svc", "pod-store"],
    },
    {
      problem: "Pedidos empresariais em lote chegando de uma vez",
      fix: "Enfileirá-los e fazer dispatch em lote com otimização de rotas.",
      nodes: ["order-svc", "dispatch"],
    },
  ],

  scaling: [
    "Particionar por cidade.",
    "Índice geográfico in-memory por tipo de veículo, com sharding por célula.",
    "Processamento pós-entrega orientado a eventos.",
  ],

  extensions: [
    "Carretos e mudanças com listas de inventário.",
    "Seguro para cargas em trânsito.",
    "Otimização de rotas para entregas empresariais com várias paradas.",
  ],
};
