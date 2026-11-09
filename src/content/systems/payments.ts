import type { SystemDesignInput } from "@/types/schema";

export const payments: SystemDesignInput = {
  slug: "payments",
  name: "Gateway de pagamento",
  tagline: "Pagamentos com cartão estilo Stripe com um ledger exactly-once",
  description:
    "Lojistas chamam uma única API para cobrar um cliente. Os números de cartão vão direto do navegador para um cofre trancado e são substituídos por tokens, então quase nada mais toca em dados sensíveis. Cada pagamento é registrado antes de qualquer ação externa, verificado contra fraude, roteado para um banco adquirente e escrito em um ledger de partidas dobradas. Chaves de idempotência tornam cada retry seguro, e a conciliação noturna prova que os livros batem com os bancos.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["idempotency", "ledger", "event-driven", "authentication", "sharding"],

  requirements: {
    functional: [
      "Autorizar e capturar pagamentos por cartão, carteira, UPI ou transferência bancária — em uma ou duas etapas",
      "Reembolsos totais e parciais; tratar chargebacks e disputas",
      "Armazenar cartões como tokens reutilizáveis para pagamentos recorrentes e assinaturas",
      "Notificar os lojistas sobre cada mudança de status via webhooks",
      "Liquidação diária para os lojistas e conciliação com os bancos",
    ],
    nonFunctional: [
      "Movimentação de dinheiro exactly-once: um retry nunca pode cobrar em dobro",
      "Consistência forte para saldos e estado das transações",
      "Conformidade com PCI DSS: dados brutos de cartão apenas dentro de um cofre isolado",
      "Disponibilidade de 99,99%+; autorização em poucos segundos",
      "Toda alteração auditável e imutável",
    ],
  },

  apis: [
    { method: "POST", path: "/v1/payments", purpose: "Cria (e opcionalmente captura) um pagamento; exige o header Idempotency-Key" },
    { method: "POST", path: "/v1/payments/{id}/capture", purpose: "Captura um valor previamente autorizado" },
    { method: "POST", path: "/v1/refunds", purpose: "Reembolsa todo ou parte de um pagamento capturado" },
    { method: "GET", path: "/v1/payments/{id}", purpose: "Status e histórico do pagamento" },
    { method: "POST", path: "/v1/tokens", purpose: "Chamada pelo SDK do navegador: troca os dados do cartão por um token" },
    { method: "POST", path: "{merchant webhook URL}", purpose: "Evento assinado enviado ao lojista (payment.succeeded, refund.created …)" },
  ],

  estimates: [
    { label: "Pagamentos", value: "≈ 50 M/dia (~600/s)", derivation: "Premissa; em dias de pico de compras 10× (~6 k/s)" },
    { label: "Lançamentos no ledger", value: "≈ 200 M/dia", derivation: "Cada pagamento registra 2–4 lançamentos balanceados de débito/crédito" },
    { label: "Armazenamento de transações", value: "≈ 50 GB/dia", derivation: "50 M × ~1 KB incluindo histórico; mantido por anos para auditoria" },
    { label: "Latência de autorização", value: "1–3 s", derivation: "Dominada pela bandeira e pelo emissor; nosso próprio caminho deve adicionar < 100 ms" },
    { label: "Webhooks", value: "≈ 150 M/dia", derivation: "~3 eventos por pagamento, com retry e backoff" },
  ],

  dataModel: [
    {
      entity: "Pagamento",
      store: "Relational DB",
      key: "paymentId",
      fields: ["merchantId", "amount", "currency", "status", "methodToken", "processorRef", "idempotencyKey", "createdAt"],
      why: "Uma máquina de estados (PENDING → AUTHORIZED → CAPTURED / FAILED / REFUNDED) que precisa de transações",
    },
    {
      entity: "Lançamento do ledger",
      store: "Relational DB (append-only)",
      key: "entryId",
      fields: ["transactionId", "account", "debit", "credit", "currency", "postedAt"],
      why: "Partidas dobradas: os lançamentos de cada transação somam zero, então o dinheiro não pode surgir nem sumir",
    },
    {
      entity: "Chave de idempotência",
      store: "Cache + relational DB",
      key: "merchantId + key",
      fields: ["requestHash", "response", "expiresAt"],
      why: "Uma requisição repetida retorna a resposta original em vez de cobrar de novo",
    },
    {
      entity: "Token de cartão",
      store: "Vault (encrypted, PCI zone)",
      key: "token",
      fields: ["encrypted PAN", "expiry", "fingerprint", "last4"],
      why: "Mantém os números brutos de cartão fora de todos os outros sistemas",
    },
    {
      entity: "Reembolso / Disputa",
      store: "Relational DB",
      key: "refundId / disputeId",
      fields: ["paymentId", "amount", "status", "reason"],
      why: "Vinculado ao pagamento original e lançado no ledger",
    },
  ],

  nodes: [
    { id: "checkout", kind: "web-client", label: "Página de checkout do lojista", role: "Coleta os dados do cartão com o SDK do gateway" },
    { id: "merchant", kind: "web-client", label: "Backend do lojista", role: "Cria pagamentos com uma chave de API secreta e recebe webhooks" },
    { id: "gateway", kind: "api-gateway", label: "API pública", role: "Autenticação por chave de API, rate limits, validação de requisições" },
    { id: "idempotency", kind: "cache", label: "Store de idempotência", role: "Lembra cada chave de requisição e sua resposta" },
    { id: "payment-svc", kind: "service", label: "Serviço de pagamentos", role: "Executa a máquina de estados do pagamento" },
    { id: "risk", kind: "ml-platform", label: "Motor de risco", role: "Pontua cada pagamento quanto a fraude; pode bloquear ou exigir 3-D Secure" },
    { id: "router", kind: "service", label: "Roteador de processadores", role: "Escolhe um adquirente e traduz para o protocolo dele" },
    { id: "vault", kind: "service", label: "Cofre de cartões", role: "Tokeniza e destokeniza números de cartão dentro da zona PCI" },
    { id: "kms", kind: "secrets", label: "HSM / gestão de chaves", role: "Chaves de criptografia dos dados de cartão" },
    { id: "ledger-svc", kind: "service", label: "Serviço de ledger", role: "Registra lançamentos balanceados de partidas dobradas" },
    { id: "webhook-svc", kind: "service", label: "Dispatcher de webhooks", role: "Entrega eventos assinados com retries" },
    { id: "events", kind: "event-stream", label: "Eventos de pagamento", role: "Toda mudança de status, em ordem por pagamento" },
    { id: "recon", kind: "batch-processing", label: "Conciliação e liquidação", role: "Cruza os relatórios dos bancos com o ledger; agenda repasses" },
    { id: "txn-db", kind: "relational-db", label: "Transações", role: "Pagamentos, reembolsos e disputas" },
    { id: "ledger-db", kind: "relational-db", label: "Ledger", role: "Diário de partidas dobradas append-only" },
    { id: "acquirer", kind: "payments", label: "Adquirentes e bandeiras", role: "Bancos e esquemas que movimentam o dinheiro" },
  ],

  edges: [
    { id: "checkout-vault", from: "checkout", to: "vault", label: "Cartão → token" },
    { id: "merchant-gateway", from: "merchant", to: "gateway", label: "Criar pagamento" },
    { id: "gateway-idempotency", from: "gateway", to: "idempotency", label: "Já viu esta chave?" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-db", from: "payment-svc", to: "txn-db", label: "Mudanças de estado" },
    { id: "payment-risk", from: "payment-svc", to: "risk", label: "Pontuar", protocol: "grpc" },
    { id: "payment-router", from: "payment-svc", to: "router", label: "Autorizar", protocol: "grpc" },
    { id: "router-vault", from: "router", to: "vault", label: "Destokenizar", protocol: "grpc" },
    { id: "vault-kms", from: "vault", to: "kms" },
    { id: "router-acquirer", from: "router", to: "acquirer", label: "ISO 8583 / API" },
    { id: "payment-events", from: "payment-svc", to: "events", protocol: "stream" },
    { id: "events-ledger", from: "events", to: "ledger-svc", protocol: "async" },
    { id: "ledger-db-write", from: "ledger-svc", to: "ledger-db" },
    { id: "events-webhook", from: "events", to: "webhook-svc", protocol: "async" },
    { id: "webhook-merchant", from: "webhook-svc", to: "merchant", label: "Webhook assinado" },
    { id: "acquirer-recon", from: "acquirer", to: "recon", label: "Relatórios de liquidação" },
    { id: "recon-ledger", from: "recon", to: "ledger-db", label: "Cruzar e repassar" },
  ],

  flows: [
    {
      id: "charge",
      name: "Cobrar um cartão",
      steps: [
        { edge: "checkout-vault", text: "O cartão do cliente vai direto do navegador para o cofre e volta como um token. O lojista nunca vê o número." },
        { edge: "merchant-gateway", text: "O servidor do lojista cria um pagamento com o token, o valor e uma chave de idempotência." },
        { edge: "gateway-idempotency", text: "Se a chave já foi vista, a resposta original é retornada — sem segunda cobrança." },
        { edge: "gateway-payment", text: "Caso contrário, o serviço de pagamentos assume." },
        { edge: "payment-db", text: "Ele registra o pagamento como PENDING antes de chamar qualquer outro." },
        { edge: "payment-risk", text: "O motor de risco o pontua; pagamentos de alto risco são bloqueados ou desafiados." },
        { edge: "payment-router", text: "O roteador escolhe o melhor adquirente para este cartão e moeda." },
        { edge: "router-vault", text: "Dentro da zona PCI, o token é trocado de volta pelo número do cartão." },
        { edge: "router-acquirer", text: "A autorização passa pela bandeira até o banco emissor, que aprova ou recusa." },
        { edge: "payment-db", text: "O resultado é salvo: CAPTURED ou FAILED." },
        { edge: "payment-events", text: "Um evento de status é publicado." },
      ],
    },
    {
      id: "after",
      name: "Ledger e webhooks",
      steps: [
        { edge: "payment-events", text: "O evento 'pagamento capturado' é publicado uma única vez, em ordem." },
        { edge: "events-ledger", text: "O serviço de ledger o consome (deduplicando por paymentId)." },
        { edge: "ledger-db-write", text: "Ele registra lançamentos balanceados: debita a conta de origem do cliente, credita o saldo do lojista e a receita de taxas." },
        { edge: "events-webhook", text: "O dispatcher de webhooks pega o mesmo evento." },
        { edge: "webhook-merchant", text: "O lojista recebe um webhook assinado; entregas que falham são repetidas com backoff." },
      ],
    },
    {
      id: "recon",
      name: "Conciliação noturna",
      steps: [
        { edge: "acquirer-recon", text: "Os adquirentes enviam arquivos de liquidação listando o que de fato foi movimentado." },
        { edge: "recon-ledger", text: "Cada linha é cruzada com o ledger; divergências são sinalizadas para investigação e os repasses aos lojistas são agendados." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Retries e timeouts causando cobranças em dobro",
      fix: "Chaves de idempotência na API, uma unique constraint em (merchant, key) e chamadas ao processador que reutilizam a mesma referência.",
      nodes: ["gateway", "idempotency", "payment-svc"],
    },
    {
      problem: "Resultado desconhecido quando a chamada ao banco dá timeout",
      fix: "Manter o pagamento PENDING, consultar o processador pelo resultado e nunca assumir falha; a conciliação pega o que sobrar.",
      nodes: ["router", "acquirer", "recon"],
    },
    {
      problem: "Escritas no ledger virando um hotspot para grandes lojistas",
      fix: "Lançamentos append-only particionados por conta; calcular saldos a partir dos lançamentos mais snapshots periódicos.",
      nodes: ["ledger-svc", "ledger-db"],
    },
    {
      problem: "Um adquirente ficando lento ou falhando",
      fix: "Circuit breakers por adquirente e roteamento automático para um backup saudável.",
      nodes: ["router", "acquirer"],
    },
    {
      problem: "Dados sensíveis de cartão se espalhando pelo sistema",
      fix: "Tokenizar na borda; apenas o cofre (com chaves mantidas em HSM) pode ver números de cartão, o que mantém o escopo PCI pequeno.",
      nodes: ["vault", "kms"],
    },
  ],

  scaling: [
    "Fazer sharding de transações e ledger por merchantId; manter o histórico de cada pagamento em um único shard.",
    "Serviços de API e de pagamentos stateless escalam horizontalmente; o estado fica no banco de dados.",
    "Usar o event stream (com uma tabela outbox) para que escritas no banco e eventos publicados nunca divirjam.",
    "Replicação síncrona dentro de uma região para o banco de transações; réplicas assíncronas de DR em outra região.",
    "Manter o cofre pequeno, isolado e escalado separadamente.",
  ],

  extensions: [
    "Assinaturas e cobrança recorrente com retries para renovações que falham.",
    "Carteiras e transferências peer-to-peer (estilo PayPal, PhonePe) sobre o mesmo ledger.",
    "Crédito buy-now-pay-later com pontuação de risco.",
    "Multimoeda com conversão cambial no momento da captura.",
    "Um fluxo de disputas com upload de evidências.",
  ],
};
