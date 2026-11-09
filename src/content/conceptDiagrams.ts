import type { ConceptInput, ConceptVisual } from "@/types/schema";

/*
 * Diagrams for concept pages: a small architecture showing the idea in action,
 * with one or more step-through scenarios, plus an optional interactive visual.
 * Merged into the concepts by slug in content/index.ts.
 */

type Diagram = NonNullable<ConceptInput["diagram"]>;
type Node = Diagram["nodes"][number];
type Edge = Diagram["edges"][number];

const n = (id: string, kind: string, label: string, role: string): Node => ({ id, kind, label, role });
const e = (id: string, from: string, to: string, label?: string, protocol?: Edge["protocol"]): Edge => ({
  id,
  from,
  to,
  label,
  protocol,
});
const s = (edge: string, text: string) => ({ edge, text });

export const conceptDiagrams: Record<string, { diagram?: Diagram; visual?: ConceptVisual }> = {
  caching: {
    diagram: {
      nodes: [
        n("app", "web-client", "App", "Pede o produto 42"),
        n("svc", "service", "Serviço de produtos", "Aplica cache-aside"),
        n("cache", "cache", "Cache", "Produtos quentes, TTL de 5 minutos"),
        n("db", "relational-db", "Banco de dados", "Fonte da verdade"),
      ],
      edges: [
        e("app-svc", "app", "svc", "GET /products/42"),
        e("svc-cache", "svc", "cache", "get / set / delete"),
        e("svc-db", "svc", "db", "leitura / escrita"),
      ],
      flows: [
        {
          id: "hit",
          name: "Cache hit",
          steps: [
            s("app-svc", "O app requisita o produto 42."),
            s("svc-cache", "O serviço busca product:42 no cache — ele está lá, então retorna em menos de um milissegundo. O banco de dados nunca é acionado."),
          ],
        },
        {
          id: "miss",
          name: "Cache miss",
          steps: [
            s("app-svc", "O app requisita um produto que ninguém visualizou recentemente."),
            s("svc-cache", "A busca no cache falha (cache miss)."),
            s("svc-db", "O serviço lê a linha do banco de dados (alguns milissegundos)."),
            s("svc-cache", "Ele armazena o resultado no cache com um TTL, para que o próximo leitor tenha um cache hit."),
          ],
        },
        {
          id: "write",
          name: "Atualizar (invalidar)",
          steps: [
            s("app-svc", "Um administrador altera o preço do produto."),
            s("svc-db", "O serviço grava o novo preço primeiro no banco de dados."),
            s("svc-cache", "Em seguida, remove product:42 do cache; a próxima leitura o repovoa com dados atualizados."),
          ],
        },
      ],
    },
  },

  sharding: {
    diagram: {
      nodes: [
        n("app", "web-client", "App", "Lê e grava usuários"),
        n("router", "service", "Roteador de shards", "Calcula o shard a partir da chave"),
        n("map", "coordination", "Mapa de shards", "Qual faixa de chaves fica em qual shard"),
        n("s0", "relational-db", "Shard 0", "hash(userId) mod 3 = 0"),
        n("s1", "relational-db", "Shard 1", "hash(userId) mod 3 = 1"),
        n("s2", "relational-db", "Shard 2", "hash(userId) mod 3 = 2"),
      ],
      edges: [
        e("app-router", "app", "router"),
        e("router-map", "router", "map", "Busca"),
        e("router-s0", "router", "s0"),
        e("router-s1", "router", "s1"),
        e("router-s2", "router", "s2"),
      ],
      flows: [
        {
          id: "single",
          name: "Consulta por chave",
          steps: [
            s("app-router", "O app pede o perfil do usuário 42."),
            s("router-map", "O roteador calcula o hash da chave: hash(42) mod 3 = 1, e confirma no mapa de shards que o shard 1 é o dono."),
            s("router-s1", "Apenas o shard 1 é consultado. Cada shard guarda um terço dos dados e recebe um terço da carga."),
          ],
        },
        {
          id: "scatter",
          name: "Consulta sem a chave",
          steps: [
            s("app-router", "O app pede 'todos os usuários que se cadastraram hoje' — sem id de usuário na consulta."),
            s("router-s0", "O roteador precisa perguntar a todos os shards…"),
            s("router-s1", "…em paralelo…"),
            s("router-s2", "…e mesclar os resultados. É por isso que a chave de shard deve corresponder às suas consultas mais comuns."),
          ],
        },
      ],
    },
  },

  "read-replicas": {
    diagram: {
      nodes: [
        n("app", "service", "Servidores da aplicação", "Enviam escritas ao primário, leituras às réplicas"),
        n("primary", "relational-db", "Primário", "Aceita todas as escritas"),
        n("r1", "relational-db", "Réplica 1", "Cópia somente leitura"),
        n("r2", "relational-db", "Réplica 2", "Cópia somente leitura"),
      ],
      edges: [
        e("app-primary", "app", "primary", "Escritas"),
        e("primary-r1", "primary", "r1", "Replicação", "async"),
        e("primary-r2", "primary", "r2", "Replicação", "async"),
        e("app-r1", "app", "r1", "Leituras"),
        e("app-r2", "app", "r2", "Leituras"),
      ],
      flows: [
        {
          id: "write-read",
          name: "Escrever e depois ler",
          steps: [
            s("app-primary", "Um usuário atualiza seu nome; a escrita vai para o primário."),
            s("primary-r1", "O primário transmite a alteração para as réplicas alguns milissegundos depois."),
            s("primary-r2", "Ambas as réplicas a aplicam."),
            s("app-r1", "A maioria das leituras vai para as réplicas, multiplicando a capacidade de leitura. Leituras que precisam ver a própria escrita do usuário imediatamente vão para o primário."),
          ],
        },
      ],
    },
  },

  "horizontal-scaling": {
    diagram: {
      nodes: [
        n("users", "web-client", "Usuários", "O tráfego cresce ao longo do dia"),
        n("lb", "load-balancer", "Load balancer", "Distribui requisições entre instâncias saudáveis"),
        n("i1", "service", "Instância 1", "Stateless"),
        n("i2", "service", "Instância 2", "Stateless"),
        n("i3", "service", "Instância 3 (nova)", "Adicionada pelo autoscaler"),
        n("cache", "cache", "Cache de sessão", "O estado compartilhado fica fora das instâncias"),
        n("metrics", "observability", "Métricas e autoscaler", "Monitora CPU e latência"),
      ],
      edges: [
        e("users-lb", "users", "lb"),
        e("lb-i1", "lb", "i1"),
        e("lb-i2", "lb", "i2"),
        e("lb-i3", "lb", "i3"),
        e("i1-cache", "i1", "cache"),
        e("i2-cache", "i2", "cache"),
        e("i3-cache", "i3", "cache"),
        e("metrics-i3", "metrics", "i3", "Iniciar", "async"),
      ],
      flows: [
        {
          id: "scale-out",
          name: "Escalar horizontalmente (scale out)",
          steps: [
            s("users-lb", "O tráfego dobra na hora do almoço."),
            s("lb-i1", "As requisições são distribuídas entre as instâncias existentes…"),
            s("lb-i2", "…até que a média de CPU ultrapasse a meta."),
            s("metrics-i3", "O autoscaler inicia outra instância idêntica."),
            s("lb-i3", "Assim que fica saudável, o load balancer começa a enviar tráfego para ela."),
            s("i3-cache", "Como as sessões ficam no cache compartilhado, qualquer instância pode atender qualquer usuário."),
          ],
        },
      ],
    },
  },

  "consistent-hashing": {
    visual: "hash-ring",
    diagram: {
      nodes: [
        n("client", "service", "Biblioteca cliente", "Calcula o hash de cada chave no anel"),
        n("a", "cache", "Nó A", "É dono do arco anterior a ele"),
        n("b", "cache", "Nó B", "É dono do arco anterior a ele"),
        n("c", "cache", "Nó C", "É dono do arco anterior a ele"),
      ],
      edges: [e("client-a", "client", "a"), e("client-b", "client", "b"), e("client-c", "client", "c")],
      flows: [
        {
          id: "route",
          name: "Rotear uma chave",
          steps: [
            s("client-b", "hash('user:42') cai logo antes do nó B no anel, então B é o dono dessa chave."),
            s("client-c", "Se B falhar, apenas as chaves de B se movem — para o próximo nó no sentido horário, C. As chaves de A não se movem."),
          ],
        },
      ],
    },
  },

  "multi-region": {
    diagram: {
      nodes: [
        n("eu", "web-client", "Usuários da UE", "Próximos a Frankfurt"),
        n("us", "web-client", "Usuários dos EUA", "Próximos à Virgínia"),
        n("dns", "dns", "Geo-DNS", "Roteia para a região saudável mais próxima"),
        n("eu-app", "service", "Região UE", "Cópia completa da aplicação"),
        n("us-app", "service", "Região EUA", "Cópia completa da aplicação"),
        n("eu-db", "relational-db", "Banco de dados da UE", "Primário para usuários da UE"),
        n("us-db", "relational-db", "Banco de dados dos EUA", "Primário para usuários dos EUA"),
      ],
      edges: [
        e("eu-dns", "eu", "dns"),
        e("us-dns", "us", "dns"),
        e("dns-eu", "dns", "eu-app"),
        e("dns-us", "dns", "us-app"),
        e("eu-app-db", "eu-app", "eu-db"),
        e("us-app-db", "us-app", "us-db"),
        e("eu-us-repl", "eu-db", "us-db", "Replicação assíncrona", "async"),
      ],
      flows: [
        {
          id: "normal",
          name: "Dia normal",
          steps: [
            s("eu-dns", "Um usuário em Berlim abre o app."),
            s("dns-eu", "O Geo-DNS o envia para a região UE — dezenas de milissegundos mais próxima do que os EUA."),
            s("eu-app-db", "Seus dados ficam no banco de dados da UE."),
            s("eu-us-repl", "As alterações são replicadas de forma assíncrona para os EUA para recuperação de desastres."),
          ],
        },
        {
          id: "outage",
          name: "Queda de região",
          steps: [
            s("eu-dns", "A região UE cai; os health checks falham."),
            s("dns-us", "O Geo-DNS passa a rotear os usuários da UE para a região dos EUA."),
            s("us-app-db", "A cópia dos EUA os atende — mais lenta e sem as escritas que ainda não haviam sido replicadas (o RPO)."),
          ],
        },
      ],
    },
  },

  "rate-limiting": {
    visual: "token-bucket",
    diagram: {
      nodes: [
        n("client", "web-client", "Cliente da API", "Envia requisições com uma chave de API"),
        n("gateway", "api-gateway", "API gateway", "Consulta o limitador antes de encaminhar"),
        n("limiter", "service", "Rate limiter", "Token bucket por cliente"),
        n("counters", "cache", "Armazenamento de contadores", "Tokens restantes por cliente"),
        n("backend", "service", "Backend", "Serviço protegido"),
      ],
      edges: [
        e("client-gw", "client", "gateway"),
        e("gw-limiter", "gateway", "limiter", "Permitir?"),
        e("limiter-counters", "limiter", "counters", "Pegar um token"),
        e("gw-backend", "gateway", "backend", "Permitido"),
      ],
      flows: [
        {
          id: "allowed",
          name: "Permitida",
          steps: [
            s("client-gw", "Uma requisição chega."),
            s("gw-limiter", "O gateway consulta o limitador."),
            s("limiter-counters", "Um script atômico recarrega o balde pelo tempo decorrido e consome um token — restam 7."),
            s("gw-backend", "A requisição é encaminhada com X-RateLimit-Remaining: 7."),
          ],
        },
        {
          id: "rejected",
          name: "Rejeitada",
          steps: [
            s("client-gw", "O cliente dispara uma rajada de 50 requisições em um segundo."),
            s("gw-limiter", "O gateway consulta o limitador."),
            s("limiter-counters", "O balde está vazio. O gateway responde 429 Too Many Requests com Retry-After — o backend nem chega a ver a requisição."),
          ],
        },
      ],
    },
  },

  authentication: {
    diagram: {
      nodes: [
        n("browser", "web-client", "Navegador", "O usuário fazendo login"),
        n("app", "service", "Sua aplicação", "Inicia o login, troca o código"),
        n("idp", "identity", "Provedor de identidade", "Verifica credenciais, emite tokens"),
        n("gateway", "api-gateway", "API gateway", "Verifica assinaturas dos tokens"),
        n("api", "service", "API", "Confia nas claims do token"),
      ],
      edges: [
        e("browser-app", "browser", "app", "Entrar"),
        e("browser-idp", "browser", "idp", "Redirecionamento + senha"),
        e("app-idp", "app", "idp", "Código → tokens"),
        e("browser-gw", "browser", "gateway", "Bearer token"),
        e("gw-api", "gateway", "api", "Claims verificadas"),
      ],
      flows: [
        {
          id: "oidc",
          name: "Fazer login (OIDC)",
          steps: [
            s("browser-app", "O usuário clica em 'Entrar'."),
            s("browser-idp", "Ele é redirecionado ao provedor de identidade e digita sua senha (a aplicação nunca a vê)."),
            s("app-idp", "O provedor redireciona de volta com um código de uso único; o servidor da aplicação o troca por um ID token, um access token de curta duração e um refresh token."),
            s("browser-gw", "As chamadas de API levam o access token (um JWT assinado)."),
            s("gw-api", "O gateway verifica a assinatura e a expiração com a chave pública do provedor — sem consulta ao banco de dados — e encaminha o id e os papéis do usuário."),
          ],
        },
      ],
    },
  },

  microservices: {
    diagram: {
      nodes: [
        n("client", "web-client", "Cliente", "Uma única API para o mundo externo"),
        n("gateway", "api-gateway", "API gateway", "Roteia para os serviços"),
        n("orders", "service", "Serviço de pedidos", "É dono dos pedidos"),
        n("payments", "service", "Serviço de pagamentos", "É dono dos pagamentos"),
        n("users", "service", "Serviço de usuários", "É dono dos usuários"),
        n("orders-db", "relational-db", "Banco de pedidos", "Apenas o serviço de pedidos toca nele"),
        n("payments-db", "relational-db", "Banco de pagamentos", "Apenas o serviço de pagamentos toca nele"),
        n("events", "event-stream", "Stream de eventos", "Os serviços anunciam o que aconteceu"),
      ],
      edges: [
        e("client-gw", "client", "gateway"),
        e("gw-orders", "gateway", "orders", undefined, "grpc"),
        e("gw-users", "gateway", "users", undefined, "grpc"),
        e("orders-db-rw", "orders", "orders-db"),
        e("orders-payments", "orders", "payments", "Cobrar", "grpc"),
        e("payments-db-rw", "payments", "payments-db"),
        e("orders-events", "orders", "events", "OrderPlaced", "stream"),
      ],
      flows: [
        {
          id: "order",
          name: "Fazer um pedido",
          steps: [
            s("client-gw", "O cliente chama uma única API pública."),
            s("gw-orders", "O gateway roteia para o serviço de pedidos."),
            s("orders-db-rw", "O serviço de pedidos grava em seu próprio banco de dados — nenhum outro serviço o compartilha."),
            s("orders-payments", "Ele chama o serviço de pagamentos via gRPC com timeout e orçamento de retentativas."),
            s("payments-db-rw", "Pagamentos registra a cobrança em seu próprio banco de dados."),
            s("orders-events", "Um evento OrderPlaced permite que outras equipes reajam sem que o serviço de pedidos precise conhecê-las."),
          ],
        },
      ],
    },
  },

  "event-driven": {
    diagram: {
      nodes: [
        n("orders", "service", "Serviço de pedidos", "Produtor"),
        n("log", "event-stream", "Log de eventos", "Durável, ordenado, reprocessável"),
        n("email", "service", "Serviço de e-mail", "Grupo de consumidores 1"),
        n("search", "stream-processor", "Indexador de busca", "Grupo de consumidores 2"),
        n("analytics", "data-warehouse", "Analytics", "Grupo de consumidores 3"),
      ],
      edges: [
        e("orders-log", "orders", "log", "OrderPlaced", "stream"),
        e("log-email", "log", "email", undefined, "async"),
        e("log-search", "log", "search", undefined, "async"),
        e("log-analytics", "log", "analytics", undefined, "async"),
      ],
      flows: [
        {
          id: "publish",
          name: "Um evento, muitos leitores",
          steps: [
            s("orders-log", "O serviço de pedidos adiciona OrderPlaced ao log e segue em frente — não espera por ninguém."),
            s("log-email", "O serviço de e-mail lê o evento e envia uma confirmação."),
            s("log-search", "O indexador de busca lê o mesmo evento em seu próprio ritmo."),
            s("log-analytics", "O Analytics ficou fora do ar por uma hora; quando reinicia, retoma a partir do offset salvo e alcança o restante — nada é perdido."),
          ],
        },
      ],
    },
  },

  "fan-out": {
    diagram: {
      nodes: [
        n("author", "mobile-client", "Autor", "Publica algo"),
        n("posts", "service", "Serviço de posts", "Armazena o post"),
        n("events", "event-stream", "Eventos de novo post", "Um por post"),
        n("fanout", "service", "Workers de fan-out", "Copiam ids de posts para os feeds dos seguidores"),
        n("feeds", "cache", "Cache de feeds", "Uma lista por seguidor"),
        n("reader", "mobile-client", "Seguidor", "Abre seu feed"),
        n("feed-svc", "service", "Serviço de feed", "Lê a lista, mescla celebridades"),
        n("posts-db", "wide-column-db", "Armazenamento de posts", "Todos os posts por autor"),
      ],
      edges: [
        e("author-posts", "author", "posts"),
        e("posts-db-write", "posts", "posts-db"),
        e("posts-events", "posts", "events", undefined, "stream"),
        e("events-fanout", "events", "fanout", undefined, "async"),
        e("fanout-feeds", "fanout", "feeds", "Push"),
        e("reader-feed", "reader", "feed-svc"),
        e("feed-cache", "feed-svc", "feeds", "Ler lista"),
        e("feed-posts", "feed-svc", "posts-db", "Buscar posts de celebridades"),
      ],
      flows: [
        {
          id: "push",
          name: "Push (fan-out na escrita)",
          steps: [
            s("author-posts", "Um usuário comum com 300 seguidores publica um post."),
            s("posts-db-write", "O post é armazenado uma única vez."),
            s("posts-events", "Um evento de novo post é publicado."),
            s("events-fanout", "Os workers de fan-out o capturam."),
            s("fanout-feeds", "Eles adicionam o id do post no início das listas de feed dos 300 seguidores — 300 escritas baratas agora, para que toda leitura depois seja instantânea."),
          ],
        },
        {
          id: "pull",
          name: "Pull (fan-out na leitura)",
          steps: [
            s("reader-feed", "Um seguidor abre seu feed."),
            s("feed-cache", "Sua lista pré-montada contém os posts de contas comuns."),
            s("feed-posts", "Os posts de celebridades que ele segue (milhões de seguidores, portanto nunca enviados via push) são buscados agora e mesclados."),
          ],
        },
      ],
    },
  },

  idempotency: {
    diagram: {
      nodes: [
        n("client", "web-client", "Cliente", "Tenta novamente em caso de timeout"),
        n("api", "service", "API de pagamentos", "Verifica primeiro a chave de idempotência"),
        n("keys", "cache", "Armazenamento de idempotência", "chave → resposta salva"),
        n("psp", "payments", "Bandeira do cartão", "Move o dinheiro de fato"),
      ],
      edges: [
        e("client-api", "client", "api", "POST /charges + Idempotency-Key"),
        e("api-keys", "api", "keys", "Já viu esta chave?"),
        e("api-psp", "api", "psp", "Cobrar"),
      ],
      flows: [
        {
          id: "first",
          name: "Primeira tentativa",
          steps: [
            s("client-api", "O cliente envia uma cobrança com a chave abc-123."),
            s("api-keys", "A chave é nova; ela é reservada atomicamente."),
            s("api-psp", "O cartão é cobrado."),
            s("api-keys", "A resposta é salva sob abc-123 — mas a rede cai antes de o cliente receber o retorno."),
          ],
        },
        {
          id: "retry",
          name: "Retentativa",
          steps: [
            s("client-api", "O cliente sofre timeout e tenta novamente com a mesma chave abc-123."),
            s("api-keys", "A chave é encontrada, então a resposta salva é retornada. O cartão não é cobrado duas vezes."),
          ],
        },
      ],
    },
  },

  saga: {
    diagram: {
      nodes: [
        n("orders", "service", "Serviço de pedidos", "Inicia a saga"),
        n("saga", "workflow", "Orquestrador da saga", "Executa passos e compensações"),
        n("inventory", "service", "Estoque", "Reservar / liberar estoque"),
        n("payment", "service", "Pagamento", "Cobrar / estornar"),
        n("shipping", "service", "Envio", "Criar remessa"),
      ],
      edges: [
        e("orders-saga", "orders", "saga", "Iniciar", "async"),
        e("saga-inventory", "saga", "inventory", undefined, "grpc"),
        e("saga-payment", "saga", "payment", undefined, "grpc"),
        e("saga-shipping", "saga", "shipping", undefined, "grpc"),
      ],
      flows: [
        {
          id: "happy",
          name: "Todos os passos têm sucesso",
          steps: [
            s("orders-saga", "Um pedido é criado como PENDING e a saga começa."),
            s("saga-inventory", "Passo 1: reservar estoque — efetivado no banco de dados do próprio estoque."),
            s("saga-payment", "Passo 2: cobrar o cartão — efetivado no banco de dados de pagamento."),
            s("saga-shipping", "Passo 3: criar a remessa. O pedido passa para CONFIRMED."),
          ],
        },
        {
          id: "compensate",
          name: "O pagamento falha",
          steps: [
            s("saga-inventory", "O passo 1 tem sucesso: o estoque é reservado."),
            s("saga-payment", "O passo 2 falha: o cartão é recusado."),
            s("saga-inventory", "Compensação: o orquestrador libera a reserva. Não há rollback global — cada passo concluído é desfeito por sua própria ação de compensação."),
          ],
        },
      ],
    },
  },

  ledger: {
    visual: "ledger-table",
    diagram: {
      nodes: [
        n("payments", "service", "Serviço de pagamentos", "Emite um evento 'capturado'"),
        n("events", "event-stream", "Eventos de pagamento", "Ordenados por pagamento"),
        n("ledger-svc", "service", "Serviço de razão (ledger)", "Transforma eventos em lançamentos balanceados"),
        n("ledger", "relational-db", "Livro-razão (Ledger)", "Diário somente de adição (append-only)"),
        n("bank", "partner-api", "Liquidação bancária", "O que realmente foi movimentado"),
        n("recon", "batch-processing", "Conciliação", "Compara os dois todas as noites"),
      ],
      edges: [
        e("payments-events", "payments", "events", undefined, "stream"),
        e("events-ledger", "events", "ledger-svc", undefined, "async"),
        e("ledger-write", "ledger-svc", "ledger", "Débito = crédito"),
        e("bank-recon", "bank", "recon", "Arquivo de liquidação"),
        e("recon-ledger", "recon", "ledger", "Conferir"),
      ],
      flows: [
        {
          id: "post",
          name: "Lançar e conciliar",
          steps: [
            s("payments-events", "Um pagamento de cartão de $100 é capturado."),
            s("events-ledger", "O serviço de razão consome o evento (desduplicado pelo id do pagamento)."),
            s("ledger-write", "Ele adiciona lançamentos que somam zero: debita $100 na conta de compensação de cartão, credita $97 ao lojista e $3 em receita de taxas."),
            s("bank-recon", "Durante a noite, o banco envia o que foi efetivamente liquidado."),
            s("recon-ledger", "Cada linha é conferida com os lançamentos do livro-razão; qualquer divergência é sinalizada para análise humana."),
          ],
        },
      ],
    },
  },

  "distributed-locks": {
    diagram: {
      nodes: [
        n("a", "service", "Servidor A", "Quer o assento 12A"),
        n("b", "service", "Servidor B", "Também quer o assento 12A"),
        n("locks", "cache", "Armazenamento de locks", "lock:seat:12A com um TTL"),
        n("db", "relational-db", "Banco de reservas", "Verifica o fencing token"),
      ],
      edges: [
        e("a-lock", "a", "locks", "SET NX EX 30"),
        e("b-lock", "b", "locks", "SET NX EX 30"),
        e("a-db", "a", "db", "Gravar com token 33"),
        e("b-db", "b", "db", "Gravar com token 34"),
      ],
      flows: [
        {
          id: "contend",
          name: "Dois servidores, um assento",
          steps: [
            s("a-lock", "O Servidor A define lock:seat:12A apenas se ele não existir — tem sucesso e recebe o fencing token 33."),
            s("b-lock", "O Servidor B tenta o mesmo um instante depois e falha, então avisa ao usuário que o assento está ocupado."),
            s("a-db", "A conclui a reserva apresentando o token 33 e depois remove o lock."),
          ],
        },
        {
          id: "crash",
          name: "O detentor trava",
          steps: [
            s("a-lock", "O Servidor A obtém o lock (token 33) e então congela em uma longa pausa."),
            s("b-lock", "Após 30 s o lock expira; B o obtém com o token 34 e reserva o assento."),
            s("b-db", "A escrita de B é armazenada com o token 34."),
            s("a-db", "A volta a responder e tenta gravar com o token 33 — o banco de dados rejeita porque o 34 já foi visto. É exatamente isso que os fencing tokens evitam."),
          ],
        },
      ],
    },
  },

  "back-pressure": {
    diagram: {
      nodes: [
        n("api", "service", "API", "Aceita uploads rapidamente"),
        n("queue", "message-queue", "Fila de tarefas", "Absorve picos"),
        n("workers", "service", "Workers", "Processam em seu próprio ritmo"),
        n("dlq", "message-queue", "Dead-letter queue", "Mensagens que continuam falhando"),
        n("autoscale", "observability", "Autoscaler", "Escala conforme o tamanho da fila"),
      ],
      edges: [
        e("api-queue", "api", "queue", "Enfileirar", "async"),
        e("queue-workers", "queue", "workers", undefined, "async"),
        e("workers-dlq", "workers", "dlq", "Após 5 falhas", "async"),
        e("autoscale-workers", "autoscale", "workers", "Adicionar workers"),
      ],
      flows: [
        {
          id: "spike",
          name: "Pico de tráfego",
          steps: [
            s("api-queue", "Um momento viral traz 10× o volume normal de uploads; a API apenas enfileira as tarefas e responde 'aceito'."),
            s("queue-workers", "Os workers continuam consumindo em ritmo constante; a fila cresce em vez de o sistema cair."),
            s("autoscale-workers", "O tamanho da fila cruza um limite, então mais workers são adicionados até o acúmulo esvaziar."),
          ],
        },
        {
          id: "poison",
          name: "Mensagem envenenada (poison message)",
          steps: [
            s("queue-workers", "Uma tarefa derruba um worker toda vez que é processada."),
            s("workers-dlq", "Após 5 tentativas, ela vai para a dead-letter queue, deixando de bloquear o restante e podendo ser inspecionada."),
          ],
        },
      ],
    },
  },

  websockets: {
    diagram: {
      nodes: [
        n("alice", "mobile-client", "Alice", "Conectada ao nó 1"),
        n("bob", "mobile-client", "Bob", "Conectado ao nó 2"),
        n("lb", "load-balancer", "Load balancer L4", "Distribui conexões de longa duração"),
        n("n1", "realtime-gateway", "Nó de gateway 1", "Mantém o socket da Alice"),
        n("n2", "realtime-gateway", "Nó de gateway 2", "Mantém o socket do Bob"),
        n("registry", "cache", "Registro de conexões", "usuário → nó"),
        n("bus", "event-stream", "Barramento pub/sub", "Entrega entre nós"),
      ],
      edges: [
        e("alice-lb", "alice", "lb", undefined, "ws"),
        e("bob-lb", "bob", "lb", undefined, "ws"),
        e("lb-n1", "lb", "n1", undefined, "ws"),
        e("lb-n2", "lb", "n2", undefined, "ws"),
        e("n1-registry", "n1", "registry", "Onde está Bob?"),
        e("n1-bus", "n1", "bus", "Para o nó 2", "stream"),
        e("bus-n2", "bus", "n2", undefined, "stream"),
      ],
      flows: [
        {
          id: "message",
          name: "Mensagem entre nós",
          steps: [
            s("alice-lb", "Alice envia 'oi' pelo seu socket aberto."),
            s("lb-n1", "A mensagem chega ao nó de gateway 1."),
            s("n1-registry", "O nó 1 procura por Bob — ele está no nó 2."),
            s("n1-bus", "O nó 1 publica a mensagem no canal do nó 2."),
            s("bus-n2", "O nó 2 a recebe…"),
            s("lb-n2", "…e a envia imediatamente pelo socket de Bob — sem polling."),
          ],
        },
      ],
    },
  },

  "adaptive-bitrate-streaming": {
    diagram: {
      nodes: [
        n("upload", "object-storage", "Upload original", "Um arquivo de alta qualidade"),
        n("transcoder", "media-transcoder", "Transcodificador", "Gera uma escada de qualidades"),
        n("renditions", "object-storage", "Versões (renditions)", "240p … 4K, cortadas em segmentos de 4 s"),
        n("cdn", "cdn", "CDN", "Faz cache do manifesto e dos segmentos"),
        n("player", "web-client", "Player", "Mede a largura de banda e escolhe a qualidade por segmento"),
      ],
      edges: [
        e("upload-transcoder", "upload", "transcoder", undefined, "async"),
        e("transcoder-renditions", "transcoder", "renditions", "HLS/DASH"),
        e("cdn-renditions", "cdn", "renditions", "Origem"),
        e("player-cdn", "player", "cdn", "Manifesto + segmentos"),
      ],
      flows: [
        {
          id: "play",
          name: "Assistir no trem",
          steps: [
            s("upload-transcoder", "Após o upload, o vídeo é codificado em várias taxas de bits (bitrates)."),
            s("transcoder-renditions", "Cada versão é cortada em segmentos curtos e listada em um manifesto."),
            s("player-cdn", "O player carrega o manifesto e começa em 720p a partir da borda (edge) mais próxima."),
            s("cdn-renditions", "Segmentos que ainda não estão na borda são buscados na origem uma única vez."),
            s("player-cdn", "O trem entra em um túnel; a vazão cai, então os próximos segmentos vêm da versão 360p — sem travar para carregar (buffering), apenas com qualidade menor até o sinal voltar."),
          ],
        },
      ],
    },
  },

  "presigned-urls": {
    diagram: {
      nodes: [
        n("app", "mobile-client", "App", "Tem um vídeo de 200 MB para enviar"),
        n("api", "service", "API", "Autoriza e assina URLs"),
        n("storage", "object-storage", "Object storage", "Aceita o upload assinado"),
        n("processor", "serverless", "Processador", "Executa quando o upload chega"),
      ],
      edges: [
        e("app-api", "app", "api", "Solicitar URL de upload"),
        e("app-storage", "app", "storage", "PUT arquivo (URL assinada)"),
        e("storage-processor", "storage", "processor", "Objeto criado", "async"),
      ],
      flows: [
        {
          id: "upload",
          name: "Fazer upload diretamente",
          steps: [
            s("app-api", "O app pede permissão de upload para a API; a API verifica o usuário e retorna uma URL assinada para um objeto, válida por 10 minutos."),
            s("app-storage", "O app envia o arquivo direto para o storage — gigabytes nunca passam pelos servidores da API."),
            s("storage-processor", "O storage emite um evento de 'objeto criado', que dispara a validação e o processamento."),
          ],
        },
      ],
    },
  },

  "search-indexing": {
    diagram: {
      nodes: [
        n("app", "service", "Serviço de catálogo", "Grava produtos"),
        n("db", "relational-db", "Banco de dados", "Fonte da verdade"),
        n("cdc", "event-stream", "Stream de alterações", "Cada insert/update/delete"),
        n("indexer", "stream-processor", "Indexador", "Constrói documentos de busca"),
        n("index", "search", "Índice de busca", "Índice invertido + facetas"),
        n("search", "service", "Serviço de busca", "Analisa e classifica consultas"),
        n("user", "web-client", "Comprador", "Digita 'fones sem fio'"),
      ],
      edges: [
        e("app-db", "app", "db"),
        e("db-cdc", "db", "cdc", undefined, "cdc"),
        e("cdc-indexer", "cdc", "indexer", undefined, "stream"),
        e("indexer-index", "indexer", "index"),
        e("user-search", "user", "search"),
        e("search-index", "search", "index", "Consulta"),
      ],
      flows: [
        {
          id: "index",
          name: "Manter o índice atualizado",
          steps: [
            s("app-db", "Um novo produto é salvo."),
            s("db-cdc", "O log de alterações do banco de dados publica a inserção."),
            s("cdc-indexer", "O indexador a transforma em um documento de busca (título tokenizado, marca, preço, avaliação)."),
            s("indexer-index", "Ele é adicionado ao índice invertido em segundos."),
          ],
        },
        {
          id: "query",
          name: "Buscar",
          steps: [
            s("user-search", "O comprador busca por 'fones sem fio'."),
            s("search-index", "Cada termo aponta direto para os produtos que o contêm; os resultados passam por interseção, filtro por facetas e classificação — em milissegundos, sem varredura de tabela (table scan)."),
          ],
        },
      ],
    },
  },

  "geospatial-indexing": {
    visual: "geo-grid",
    diagram: {
      nodes: [
        n("driver", "mobile-client", "App do motorista", "Envia GPS a cada 4 s"),
        n("location", "service", "Serviço de localização", "Move motoristas entre células"),
        n("geo", "cache", "Índice geoespacial", "id da célula → motoristas"),
        n("rider", "mobile-client", "App do passageiro", "Solicita uma corrida"),
        n("matching", "service", "Matching", "Busca na célula do passageiro e nas vizinhas"),
      ],
      edges: [
        e("driver-location", "driver", "location", undefined, "ws"),
        e("location-geo", "location", "geo", "Atualizar célula"),
        e("rider-matching", "rider", "matching"),
        e("matching-geo", "matching", "geo", "Células próximas"),
      ],
      flows: [
        {
          id: "match",
          name: "Encontrar motoristas próximos",
          steps: [
            s("driver-location", "A posição de um motorista chega."),
            s("location-geo", "O id dele é movido para a célula que cobre essa posição."),
            s("rider-matching", "Um passageiro solicita uma corrida."),
            s("matching-geo", "O serviço de matching lê a célula do passageiro e suas 8 vizinhas — meia dúzia de buscas em vez de varrer todos os motoristas da cidade."),
          ],
        },
      ],
    },
  },

  "leader-election": {
    diagram: {
      nodes: [
        n("w1", "service", "Worker 1", "Líder atual"),
        n("w2", "service", "Worker 2", "Seguidor"),
        n("w3", "service", "Worker 3", "Seguidor"),
        n("etcd", "coordination", "Armazenamento de coordenação", "Concede uma lease a um único worker"),
        n("job", "batch-processing", "Job noturno", "Deve executar exatamente uma vez"),
      ],
      edges: [
        e("w1-etcd", "w1", "etcd", "Manter lease"),
        e("w2-etcd", "w2", "etcd", "Observar"),
        e("w3-etcd", "w3", "etcd", "Observar"),
        e("w1-job", "w1", "job", "Executar"),
        e("w2-job", "w2", "job", "Executar"),
      ],
      flows: [
        {
          id: "failover",
          name: "O líder falha",
          steps: [
            s("w1-etcd", "O Worker 1 mantém a lease de líder e a renova a cada poucos segundos."),
            s("w1-job", "Apenas o líder executa o job noturno."),
            s("w2-etcd", "O Worker 1 trava; sua lease expira. Os Workers 2 e 3 disputam a lease e o armazenamento a concede a exatamente um — o worker 2."),
            s("w2-job", "O Worker 2 assume o job. Nunca há um momento com dois líderes mantendo leases válidas."),
          ],
        },
      ],
    },
  },

  "id-generation": {
    visual: "snowflake-id",
    diagram: {
      nodes: [
        n("s1", "service", "Servidor 1 (worker 7)", "Gera IDs localmente"),
        n("s2", "service", "Servidor 2 (worker 8)", "Gera IDs localmente"),
        n("ranges", "coordination", "Registro de workers", "Atribui a cada servidor um worker id único uma vez"),
        n("db", "wide-column-db", "Armazenamento de tweets", "Os IDs são ordenados por tempo"),
      ],
      edges: [
        e("s1-ranges", "s1", "ranges", "Reivindicar worker id"),
        e("s2-ranges", "s2", "ranges", "Reivindicar worker id"),
        e("s1-db", "s1", "db"),
        e("s2-db", "s2", "db"),
      ],
      flows: [
        {
          id: "generate",
          name: "Gerar IDs",
          steps: [
            s("s1-ranges", "Na inicialização, cada servidor reivindica um worker id único — a única coordenação necessária."),
            s("s1-db", "O Servidor 1 monta IDs a partir de tempo + worker 7 + uma sequência: nenhuma chamada de rede por ID."),
            s("s2-db", "O Servidor 2 faz o mesmo com o worker 8 — os IDs nunca colidem e ambos são ordenados pelo momento de criação."),
          ],
        },
      ],
    },
  },

  "change-data-capture": {
    diagram: {
      nodes: [
        n("app", "service", "App", "Grava apenas no banco de dados"),
        n("db", "relational-db", "Banco de dados", "O write-ahead log registra cada alteração"),
        n("connector", "service", "Conector CDC", "Lê o final do log continuamente"),
        n("stream", "event-stream", "Eventos de alteração", "Um por linha alterada"),
        n("search", "search", "Índice de busca", "Permanece sincronizado"),
        n("cache", "cache", "Invalidador de cache", "Remove chaves obsoletas"),
        n("warehouse", "data-warehouse", "Warehouse", "Cópia para analytics"),
      ],
      edges: [
        e("app-db", "app", "db"),
        e("db-connector", "db", "connector", "Ler log", "cdc"),
        e("connector-stream", "connector", "stream", undefined, "stream"),
        e("stream-search", "stream", "search", undefined, "async"),
        e("stream-cache", "stream", "cache", undefined, "async"),
        e("stream-warehouse", "stream", "warehouse", undefined, "async"),
      ],
      flows: [
        {
          id: "sync",
          name: "Uma escrita, todas as cópias atualizadas",
          steps: [
            s("app-db", "O app atualiza um preço no banco de dados — e nada mais. Sem escritas duplas (dual writes) arriscadas."),
            s("db-connector", "O conector lê a alteração diretamente do log do próprio banco de dados."),
            s("connector-stream", "Ele publica um evento de alteração com os valores anterior e novo."),
            s("stream-search", "O índice de busca é atualizado…"),
            s("stream-cache", "…o cache invalida o valor antigo…"),
            s("stream-warehouse", "…e o analytics recebe o histórico. Se algum consumidor cair, ele se atualiza a partir do stream."),
          ],
        },
      ],
    },
  },

  "bloom-filter": {
    visual: "bloom-filter",
    diagram: {
      nodes: [
        n("parser", "service", "Extrator de links", "Encontra 50 links por página"),
        n("bloom", "cache", "Filtro de Bloom", "Em memória, ~10 bits por URL"),
        n("db", "wide-column-db", "Armazenamento de URLs", "Registro exato de cada URL"),
        n("frontier", "message-queue", "Fronteira de URLs", "Páginas ainda por rastrear"),
      ],
      edges: [
        e("parser-bloom", "parser", "bloom", "Já vista?"),
        e("parser-db", "parser", "db", "Apenas em 'talvez'"),
        e("parser-frontier", "parser", "frontier", "Nova URL", "async"),
      ],
      flows: [
        {
          id: "check",
          name: "Verificar um link",
          steps: [
            s("parser-bloom", "Para cada link, o filtro é verificado primeiro. 'Definitivamente não vista' é a resposta mais comum — sem nenhuma chamada ao banco de dados."),
            s("parser-frontier", "Esses links vão direto para a fronteira."),
            s("parser-db", "Apenas respostas 'talvez vista' (incluindo o ~1% de falsos positivos) são confirmadas no armazenamento exato."),
          ],
        },
      ],
    },
  },

  "prefix-trie": {
    visual: "prefix-trie",
    diagram: {
      nodes: [
        n("box", "web-client", "Caixa de busca", "Envia o prefixo enquanto você digita"),
        n("suggest", "service", "Serviço de sugestões", "Uma consulta por tecla digitada"),
        n("trie", "nosql-db", "Shards da trie", "As top-k sugestões ficam armazenadas em cada prefixo"),
        n("logs", "event-stream", "Log de consultas", "O que as pessoas buscaram"),
        n("builder", "batch-processing", "Construtor da trie", "Reconstrói as tries diariamente"),
      ],
      edges: [
        e("box-suggest", "box", "suggest", "GET /suggest?q=sys"),
        e("suggest-trie", "suggest", "trie", "Nó 'sys'"),
        e("logs-builder", "logs", "builder", undefined, "stream"),
        e("builder-trie", "builder", "trie", "Publicar"),
      ],
      flows: [
        {
          id: "suggest",
          name: "Sugerir",
          steps: [
            s("box-suggest", "O usuário digita 'sys'."),
            s("suggest-trie", "O serviço percorre s → y → s e retorna a lista top-k armazenada naquele nó — sem classificação no momento da consulta."),
          ],
        },
        {
          id: "build",
          name: "Reconstruir",
          steps: [
            s("logs-builder", "Todas as noites, o construtor contabiliza as consultas do dia anterior."),
            s("builder-trie", "Ele reconstrói as tries com listas top-k atualizadas em cada prefixo e as publica."),
          ],
        },
      ],
    },
  },

  webrtc: {
    diagram: {
      nodes: [
        n("alice", "web-client", "Alice", "Inicia uma chamada"),
        n("bob", "mobile-client", "Bob", "Atende"),
        n("signal", "realtime-gateway", "Sinalização", "Retransmite ofertas e candidatos de rede"),
        n("turn", "webrtc-media", "Relay TURN", "Usado apenas quando a conexão direta falha"),
      ],
      edges: [
        e("alice-signal", "alice", "signal", "Oferta", "ws"),
        e("bob-signal", "bob", "signal", "Resposta", "ws"),
        e("alice-turn", "alice", "turn", "Mídia"),
        e("bob-turn", "bob", "turn", "Mídia"),
      ],
      flows: [
        {
          id: "call",
          name: "Estabelecer uma chamada",
          steps: [
            s("alice-signal", "O navegador da Alice cria uma oferta (codecs, chaves) e a envia pelo servidor de sinalização."),
            s("bob-signal", "O app do Bob responde; ambos trocam candidatos de rede descobertos via STUN."),
            s("alice-turn", "A maioria das chamadas agora se conecta diretamente ponto a ponto (peer-to-peer). Se um firewall bloquear isso, a mídia flui pelo relay TURN…"),
            s("bob-turn", "…que a encaminha para Bob. Os servidores só transportam mídia quando é estritamente necessário."),
          ],
        },
      ],
    },
  },
};
