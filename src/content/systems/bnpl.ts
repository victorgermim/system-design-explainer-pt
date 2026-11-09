import type { SystemDesignInput } from "@/types/schema";

export const bnpl: SystemDesignInput = {
  slug: "bnpl",
  name: "Compre agora, pague depois",
  tagline: "Crédito instantâneo no checkout, pago depois",
  description:
    "No checkout do lojista, o cliente escolhe 'pagar depois'. A plataforma toma uma decisão de crédito em cerca de um segundo — usando seu próprio modelo de risco, o limite do usuário e, para novos usuários, uma consulta ao bureau de crédito — e então paga o lojista e registra um empréstimo em um ledger de partidas dobradas. Um agendador cobra as parcelas por débito automático, aplica multas por atraso e encaminha contas vencidas para a cobrança.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["ledger", "idempotency", "event-driven", "saga", "authentication"],

  requirements: {
    functional: [
      "Cadastro com KYC e obtenção de um limite de crédito",
      "Pagar depois em lojistas parceiros com um checkout de um toque",
      "Decisão de crédito instantânea; divisão em parcelas quando oferecida",
      "Pagar por débito automático ou manualmente; multas por atraso e lembretes",
      "Repasse ao lojista e estornos que restauram o limite do usuário",
    ],
    nonFunctional: [
      "Decisão em menos de ~1 segundo no checkout",
      "Movimentação de dinheiro exactly-once e um ledger auditável",
      "Conformidade regulatória (KYC, proteção de dados, regras de crédito)",
      "Fraude mantida baixa sem bloquear bons clientes",
    ],
  },

  apis: [
    { method: "POST", path: "/checkout/eligibility", purpose: "O lojista pergunta: este usuário pode pagar depois por este valor?" },
    { method: "POST", path: "/checkout/transactions", purpose: "Confirma a compra (Idempotency-Key)" },
    { method: "POST", path: "/transactions/{id}/refund", purpose: "Estorno pelo lojista; restaura o limite" },
    { method: "GET", path: "/users/{id}/statement", purpose: "Valores devidos, vencimentos e histórico" },
    { method: "POST", path: "/repayments", purpose: "Pagar agora" },
  ],

  estimates: [
    { label: "Usuários", value: "≈ 10 M com limite", derivation: "Suposição" },
    { label: "Checkouts", value: "≈ 2 M/dia (~25/s, ~250/s em promoções)", derivation: "Suposição" },
    { label: "Latência da decisão", value: "< 1 s", derivation: "Não pode atrasar o checkout do lojista" },
    { label: "Lançamentos no ledger", value: "≈ 10 M/dia", derivation: "Compra, repasse ao lojista, taxas, pagamentos" },
  ],

  dataModel: [
    {
      entity: "Linha de crédito",
      store: "Banco relacional",
      key: "userId",
      fields: ["limit", "available", "status", "riskTier", "version"],
      why: "O limite disponível muda de forma atômica a cada compra ou pagamento",
    },
    {
      entity: "Empréstimo / transação",
      store: "Banco relacional",
      key: "transactionId",
      fields: ["userId", "merchantId", "amount", "instalments", "status"],
      why: "Ciclo de vida da compra até o encerramento",
    },
    {
      entity: "Lançamento no ledger",
      store: "Banco relacional (somente acréscimo)",
      key: "entryId",
      fields: ["account", "debit", "credit", "transactionId"],
      why: "Registro em partidas dobradas de cada movimentação",
    },
    {
      entity: "Cronograma de pagamento",
      store: "Banco relacional",
      key: "transactionId + instalmentNo",
      fields: ["dueDate", "amount", "status", "attempts"],
      why: "Orienta débitos automáticos, lembretes e multas por atraso",
    },
  ],

  nodes: [
    { id: "checkout", kind: "web-client", label: "Checkout do lojista", role: "Oferece 'pagar depois' pelo SDK da plataforma" },
    { id: "app", kind: "mobile-client", label: "App do usuário", role: "Limites, extratos, pagamentos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação de lojistas e usuários, rate limits" },
    { id: "identity", kind: "identity", label: "KYC e identidade", role: "Onboarding, login por OTP, verificação de documentos" },
    { id: "decision-svc", kind: "service", label: "Decisão de crédito", role: "Elegibilidade e aprovação no checkout" },
    { id: "risk", kind: "ml-platform", label: "Modelos de risco e fraude", role: "Pontua usuários e transações" },
    { id: "bureau", kind: "partner-api", label: "Bureau de crédito", role: "Histórico de crédito para novos usuários" },
    { id: "credit-svc", kind: "service", label: "Crédito e empréstimos", role: "Limites, empréstimos, estornos" },
    { id: "ledger", kind: "relational-db", label: "Ledger e linhas de crédito", role: "Ledger de partidas dobradas e limites" },
    { id: "scheduler", kind: "workflow", label: "Agendador de pagamentos", role: "Vencimentos, débito automático, retries, multas por atraso" },
    { id: "payment-svc", kind: "service", label: "Pagamentos", role: "Repasse ao lojista, débito automático, cobrança" },
    { id: "psp", kind: "payments", label: "Bancos e rails de pagamento", role: "Mandatos, UPI autopay, repasses" },
    { id: "events", kind: "event-stream", label: "Eventos de crédito", role: "Compras, pagamentos, inadimplências" },
    { id: "notify", kind: "notifications", label: "SMS e push", role: "Lembretes de vencimento, recibos" },
    { id: "warehouse", kind: "data-warehouse", label: "Analytics de risco", role: "Carteira e dados de treinamento de modelos" },
  ],

  edges: [
    { id: "checkout-gateway", from: "checkout", to: "gateway", label: "Elegibilidade / confirmação" },
    { id: "app-gateway", from: "app", to: "gateway" },
    { id: "gateway-identity", from: "gateway", to: "identity" },
    { id: "gateway-decision", from: "gateway", to: "decision-svc", protocol: "grpc" },
    { id: "decision-risk", from: "decision-svc", to: "risk", label: "Pontuar" },
    { id: "decision-bureau", from: "decision-svc", to: "bureau", label: "Novos usuários" },
    { id: "decision-credit", from: "decision-svc", to: "credit-svc", label: "Reservar limite", protocol: "grpc" },
    { id: "credit-ledger", from: "credit-svc", to: "ledger" },
    { id: "credit-events", from: "credit-svc", to: "events", protocol: "stream" },
    { id: "events-payment", from: "events", to: "payment-svc", label: "Repassar ao lojista", protocol: "async" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "payment-ledger", from: "payment-svc", to: "ledger" },
    { id: "events-scheduler", from: "events", to: "scheduler", label: "Criar cronograma", protocol: "async" },
    { id: "scheduler-payment", from: "scheduler", to: "payment-svc", label: "Débito automático" },
    { id: "scheduler-notify", from: "scheduler", to: "notify", label: "Lembretes" },
    { id: "events-warehouse", from: "events", to: "warehouse", protocol: "stream" },
  ],

  flows: [
    {
      id: "purchase",
      name: "Pagar depois no checkout",
      steps: [
        { edge: "checkout-gateway", text: "O cliente escolhe 'pagar depois' para ₹4.000; o lojista consulta a elegibilidade." },
        { edge: "gateway-decision", text: "O serviço de decisão de crédito faz a avaliação." },
        { edge: "decision-risk", text: "O modelo de risco pontua o usuário, o dispositivo e a cesta em milissegundos." },
        { edge: "decision-credit", text: "₹4.000 são reservados contra o limite disponível do usuário com uma atualização condicional." },
        { edge: "credit-ledger", text: "Na confirmação, o empréstimo é lançado: debita-se o valor a receber do usuário e credita-se o valor a pagar ao lojista." },
        { edge: "credit-events", text: "Um evento de 'compra' é publicado." },
        { edge: "events-payment", text: "O lojista é pago (líquido das taxas) no próximo ciclo de repasse." },
        { edge: "events-scheduler", text: "Um cronograma de pagamento é criado." },
      ],
    },
    {
      id: "repay",
      name: "Pagamento vencendo",
      steps: [
        { edge: "scheduler-notify", text: "Lembretes são enviados antes do vencimento." },
        { edge: "scheduler-payment", text: "No dia do vencimento, o agendador dispara um débito automático." },
        { edge: "payment-psp", text: "O mandato bancário é cobrado." },
        { edge: "payment-ledger", text: "O pagamento é lançado e o limite do usuário é restaurado. Débitos que falham são repetidos e, depois, aplicam-se multas por atraso." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Latência no checkout",
      fix: "Limites pré-aprovados e features de risco em cache, para que a maioria das decisões dispense chamadas externas.",
      nodes: ["decision-svc", "risk", "bureau"],
    },
    {
      problem: "Compras concorrentes estourando um limite",
      fix: "Atualização condicional sobre o limite disponível com verificação de versão.",
      nodes: ["credit-svc", "ledger"],
    },
    {
      problem: "Débitos automáticos que falham",
      fix: "Retries inteligentes em torno do dia de pagamento do salário, múltiplos mandatos e lembretes antecipados.",
      nodes: ["scheduler", "payment-svc"],
    },
  ],

  scaling: [
    "Sharding das linhas de crédito e do ledger por userId.",
    "Manter o caminho de decisão stateless, com features pré-calculadas em um feature store.",
    "Usar o stream de eventos para que repasses, cronogramas e analytics escalem separadamente.",
  ],

  extensions: [
    "Conversão em parcelas (EMI) de compras maiores.",
    "Aumentos de limite de crédito com base no histórico de pagamentos.",
    "Co-lending com bancos parceiros.",
  ],
};
