import type { SystemDesignInput } from "@/types/schema";

export const stockBrokerage: SystemDesignInput = {
  slug: "stock-brokerage",
  name: "Corretora de ações",
  tagline: "Cotações ao vivo, envio de ordens e carteiras",
  description:
    "Dois fluxos muito diferentes compartilham a mesma plataforma. Os dados de mercado vêm das bolsas, são normalizados e enviados a milhões de telas por WebSockets. As ordens seguem o caminho inverso: um sistema de gestão de ordens valida cada uma, um sistema de risco verifica margem e limites, e um gateway de bolsa a envia via FIX. As execuções voltam para atualizar posições e o livro-razão de saldos.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["websockets", "ledger", "idempotency", "event-driven", "back-pressure"],

  requirements: {
    functional: [
      "Preços, gráficos e profundidade de mercado ao vivo",
      "Enviar, modificar e cancelar ordens a mercado, limitadas e stop",
      "Verificações de margem e risco antes de a ordem sair",
      "Posições, custódia, P&L e saldo",
      "Notificações de ordens e negócios",
    ],
    nonFunctional: [
      "Latência do caminho da ordem em milissegundos",
      "Picos na abertura do mercado (muitas vezes a carga normal)",
      "Toda ordem e execução auditável; saldos sempre corretos",
      "Conformidade regulatória e alta disponibilidade durante o pregão",
    ],
  },

  apis: [
    { method: "WS", path: "/marketdata?symbols=", purpose: "Assinar cotações e profundidade ao vivo" },
    { method: "POST", path: "/orders", purpose: "Enviar uma ordem (id da ordem do cliente para idempotência)" },
    { method: "PATCH", path: "/orders/{id}", purpose: "Modificar preço ou quantidade" },
    { method: "DELETE", path: "/orders/{id}", purpose: "Cancelar" },
    { method: "GET", path: "/portfolio", purpose: "Custódia, posições, P&L e saldo" },
  ],

  estimates: [
    { label: "Investidores ativos", value: "≈ 5 M por dia", derivation: "Premissa" },
    { label: "Ordens", value: "≈ 10 M/dia, picos de 10–20 k/s", derivation: "Fortemente concentradas na abertura do mercado" },
    { label: "Atualizações de cotação recebidas", value: "≈ 100 k+ ticks/s", derivation: "Milhares de instrumentos atualizando várias vezes por segundo" },
    { label: "Fan-out por WebSocket", value: "Milhões de mensagens/s", derivation: "5 M de clientes × símbolos da watchlist; agrupadas por cliente" },
  ],

  dataModel: [
    {
      entity: "Order",
      store: "Relational DB",
      key: "orderId (+ clientOrderId unique)",
      fields: ["userId", "symbol", "side", "type", "qty", "price", "status", "exchangeOrderId"],
      why: "Máquina de estados auditável: nova → aberta → parcialmente executada → executada / cancelada",
    },
    {
      entity: "Trade (fill)",
      store: "Relational DB (append-only)",
      key: "tradeId",
      fields: ["orderId", "qty", "price", "time"],
      why: "Registro imutável vindo da bolsa",
    },
    {
      entity: "Funds ledger",
      store: "Relational DB (double-entry)",
      key: "entryId",
      fields: ["userId", "amount", "type (deposit/block/settle)", "orderId"],
      why: "Margem bloqueada no momento da ordem, liquidada nas execuções",
    },
    {
      entity: "Quote",
      store: "In-memory cache",
      key: "symbol",
      fields: ["last", "bid", "ask", "volume", "time"],
      why: "Último snapshot para novos assinantes",
    },
  ],

  nodes: [
    { id: "app", kind: "mobile-client", label: "App de trading", role: "Watchlists, gráficos, ordens" },
    { id: "web", kind: "web-client", label: "Terminal web", role: "Gráficos e entrada de ordens" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, sessões, limites de taxa" },
    { id: "oms", kind: "service", label: "Gestão de ordens (OMS)", role: "Valida, acompanha e roteia ordens" },
    { id: "rms", kind: "service", label: "Gestão de risco (RMS)", role: "Verificações de margem, limites e exposição" },
    { id: "exchange-gw", kind: "service", label: "Gateway de bolsa", role: "Sessões FIX com as bolsas" },
    { id: "exchanges", kind: "partner-api", label: "Bolsas de valores", role: "Casam ordens; publicam dados de mercado" },
    { id: "md-ingest", kind: "stream-processor", label: "Ingestão de dados de mercado", role: "Normaliza os feeds das bolsas" },
    { id: "md-stream", kind: "event-stream", label: "Stream de dados de mercado", role: "Ticks normalizados" },
    { id: "quote-cache", kind: "cache", label: "Cache de cotações", role: "Última cotação por símbolo" },
    { id: "ws", kind: "realtime-gateway", label: "Gateway de streaming", role: "Envia cotações e atualizações de ordens aos clientes" },
    { id: "order-db", kind: "relational-db", label: "Ordens e negócios", role: "Livro de ordens oficial" },
    { id: "ledger", kind: "relational-db", label: "Saldo e posições", role: "Livro-razão e custódia" },
    { id: "trade-events", kind: "event-stream", label: "Eventos de ordens e negócios", role: "Mudanças de status e execuções" },
    { id: "notify", kind: "notifications", label: "Alertas", role: "Ordem executada, alertas de preço" },
  ],

  edges: [
    { id: "app-gateway", from: "app", to: "gateway", label: "Ordens" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "app-ws", from: "app", to: "ws", label: "Cotações ao vivo", protocol: "ws" },
    { id: "web-ws", from: "web", to: "ws", protocol: "ws" },
    { id: "gateway-oms", from: "gateway", to: "oms", protocol: "grpc" },
    { id: "oms-rms", from: "oms", to: "rms", label: "Verificação de margem", protocol: "grpc" },
    { id: "rms-ledger", from: "rms", to: "ledger", label: "Bloquear saldo" },
    { id: "oms-db", from: "oms", to: "order-db" },
    { id: "oms-exchange-gw", from: "oms", to: "exchange-gw", protocol: "grpc" },
    { id: "exchange-gw-exchanges", from: "exchange-gw", to: "exchanges", label: "FIX" },
    { id: "exchanges-md", from: "exchanges", to: "md-ingest", label: "Feeds", protocol: "stream" },
    { id: "md-stream-write", from: "md-ingest", to: "md-stream", protocol: "stream" },
    { id: "md-cache", from: "md-stream", to: "quote-cache", protocol: "stream" },
    { id: "md-ws", from: "md-stream", to: "ws", protocol: "stream" },
    { id: "exchange-gw-events", from: "exchange-gw", to: "trade-events", label: "Execuções", protocol: "stream" },
    { id: "events-ledger", from: "trade-events", to: "ledger", label: "Liquidar posições", protocol: "async" },
    { id: "events-ws", from: "trade-events", to: "ws", label: "Atualizações de ordens", protocol: "stream" },
    { id: "events-notify", from: "trade-events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "order",
      name: "Enviar uma ordem de compra",
      steps: [
        { edge: "app-gateway", text: "O investidor compra 100 ações a um preço limite, com um id de ordem do cliente." },
        { edge: "gateway-oms", text: "O OMS valida a ordem (horário de pregão, tick size, quantidade)." },
        { edge: "oms-rms", text: "O risco verifica a margem e os limites de exposição." },
        { edge: "rms-ledger", text: "Os fundos necessários são bloqueados no livro-razão." },
        { edge: "oms-db", text: "A ordem é registrada como OPEN." },
        { edge: "oms-exchange-gw", text: "Ela é entregue ao gateway de bolsa." },
        { edge: "exchange-gw-exchanges", text: "A ordem vai para a bolsa via FIX e é casada." },
        { edge: "exchange-gw-events", text: "Os relatórios de execução voltam e são publicados." },
        { edge: "events-ledger", text: "As posições são atualizadas e os fundos bloqueados são liquidados." },
        { edge: "events-ws", text: "O app mostra 'executada' instantaneamente." },
      ],
    },
    {
      id: "quotes",
      name: "Cotações ao vivo",
      steps: [
        { edge: "exchanges-md", text: "As bolsas transmitem os ticks." },
        { edge: "md-stream-write", text: "A ingestão os normaliza em um único formato." },
        { edge: "md-cache", text: "A última cotação de cada símbolo fica em cache para novos assinantes." },
        { edge: "md-ws", text: "O gateway de streaming envia atualizações da watchlist de cada cliente, agrupando ticks que mudam rápido para não inundar clientes lentos." },
        { edge: "app-ws", text: "Os preços são atualizados na tela." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Pico na abertura do mercado",
      fix: "Escalar antes da abertura, enfileirar ordens em sequência por usuário e manter o caminho da ordem em memória com persistência assíncrona.",
      nodes: ["gateway", "oms"],
    },
    {
      problem: "Distribuir ticks para milhões de clientes",
      fix: "Assinaturas com um tópico por símbolo e conflation por cliente — enviar apenas o valor mais recente em uma taxa limitada.",
      nodes: ["ws", "md-stream"],
    },
    {
      problem: "Ordens duplicadas por retentativas",
      fix: "Ids de ordem do cliente únicos; o OMS rejeita repetições.",
      nodes: ["oms", "order-db"],
    },
  ],

  scaling: [
    "Particionar OMS e RMS por usuário para que as ordens de cada um permaneçam em sequência.",
    "Separar o caminho de dados de mercado do caminho de ordens.",
    "Standby ativo-passivo com failover rápido durante o pregão.",
  ],

  extensions: [
    "Opções e derivativos com cálculo de margem mais complexo.",
    "Ordens algorítmicas e em cesta.",
    "Relatórios de imposto e notas de corretagem.",
  ],
};
