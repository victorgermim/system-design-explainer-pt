import type { ConceptFamily, ConceptInput } from "@/types/schema";

/*
 * Ideias transversais que aparecem em muitos sistemas. Sistemas e componentes apontam
 * para cá pelo slug; as listas "Visto em" nas páginas de conceitos são derivadas desses vínculos.
 */
// `family` is merged in from conceptFamilyBySlug below (and required by the schema).
export const conceptInputs: Omit<ConceptInput, "family">[] = [
  {
    slug: "caching",
    name: "Caching",
    summary: "Mantenha cópias dos dados lidos com frequência em memória rápida, para que a maioria das requisições nunca chegue ao banco de dados.",
    explanation: [
      "A maioria dos grandes sistemas tem muita leitura, e uma pequena fração dos dados recebe a maior parte das leituras. Colocar esses dados quentes em um armazenamento em memória (ou na borda de uma CDN) reduz a latência de milissegundos para microssegundos e protege o banco de dados da carga.",
      "As partes difíceis são decidir o que colocar em cache, por quanto tempo mantê-lo e o que acontece quando os dados originais mudam.",
    ],
    howItWorks: [
      "Cache-aside: leia o cache; em caso de miss, leia o BD e preencha o cache. O padrão mais comum.",
      "Write-through: escreva no cache e no BD juntos, para que o cache esteja sempre atualizado.",
      "Write-back: escreva no cache e grave no BD depois — rápido, mas com risco de perda.",
      "Eviction (LRU/LFU) e TTLs limitam a memória; chaves versionadas evitam invalidação explícita.",
    ],
    tradeoffs: [
      "Leituras desatualizadas até o TTL expirar ou a chave ser invalidada.",
      "Cache stampede quando uma chave quente expira — use request coalescing ou refresh antecipado.",
      "Mais um sistema para operar, monitorar e dimensionar.",
    ],
    related: ["read-replicas", "consistent-hashing", "sharding"],
  },
  {
    slug: "sharding",
    name: "Sharding (particionamento)",
    summary: "Divida um grande conjunto de dados entre várias máquinas por uma chave, de modo que cada uma guarde e sirva apenas uma parte dele.",
    explanation: [
      "Quando um único banco de dados não aguenta o volume de escrita ou o tamanho dos dados, os dados são divididos em shards. Cada shard é um banco de dados independente que guarda as linhas cuja shard key aponta para ele.",
      "Escolher a shard key é a decisão mais importante: consultas que incluem a chave atingem um shard; consultas que não a incluem precisam consultar todos eles (fan-out).",
    ],
    howItWorks: [
      "Hash sharding: shard = hash(chave) mod N (ou um hash ring) — distribui a carga de forma uniforme.",
      "Range sharding: intervalos contíguos de chaves por shard — bom para range scans, com risco de hotspots.",
      "Baseado em diretório: uma tabela de consulta mapeia chaves para shards, o que permite rebalanceamento.",
      "Chaves típicas: userId, conversationId, videoId, merchantId, cidade.",
    ],
    tradeoffs: [
      "Joins e transações entre shards se tornam difíceis ou impossíveis.",
      "Hot keys (uma celebridade, um vídeo viral) ainda podem sobrecarregar um shard.",
      "Refazer o sharding conforme os dados crescem exige planejamento (shards virtuais, consistent hashing).",
    ],
    related: ["consistent-hashing", "read-replicas", "horizontal-scaling"],
  },
  {
    slug: "read-replicas",
    name: "Read replicas",
    summary: "Copie o banco de dados primário para servidores extras que atendem consultas de leitura.",
    explanation: [
      "As escritas vão para um primário; as mudanças são enviadas por streaming para réplicas que respondem às leituras. Como a maior parte do tráfego é leitura, isso multiplica a capacidade de forma barata e oferece um alvo de failover pronto.",
    ],
    howItWorks: [
      "Replicação assíncrona para escala (pequeno lag), síncrona para zero perda de dados no failover.",
      "Direcione para o primário as leituras que precisam ver as próprias escritas (por exemplo, logo após postar).",
    ],
    tradeoffs: [
      "O replication lag faz com que as réplicas possam retornar dados ligeiramente antigos.",
      "Não ajuda na vazão de escrita — isso exige sharding.",
    ],
    related: ["sharding", "caching", "multi-region"],
  },
  {
    slug: "horizontal-scaling",
    name: "Escalabilidade horizontal",
    summary: "Lide com mais carga adicionando mais máquinas, em vez de máquinas maiores.",
    explanation: [
      "Serviços stateless podem ser copiados livremente atrás de um balanceador de carga: qualquer instância atende qualquer requisição, pois o estado fica em bancos de dados e caches compartilhados. O autoscaling adiciona ou remove instâncias conforme o tráfego muda.",
    ],
    howItWorks: [
      "Mantenha os serviços stateless; guarde sessões em um cache ou em tokens.",
      "Coloque um balanceador de carga na frente e faça autoscale por CPU, latência ou profundidade da fila.",
      "Camadas com estado (bancos de dados) escalam horizontalmente com sharding e replicação.",
    ],
    tradeoffs: [
      "Mais instâncias significam mais chamadas de rede e mais peças móveis para observar.",
      "Componentes com estado (conexões, bancos de dados) não escalam de forma tão simples.",
    ],
    related: ["microservices", "sharding", "caching"],
  },
  {
    slug: "consistent-hashing",
    name: "Consistent hashing",
    summary: "Mapeie chaves para servidores em um hash ring, de modo que adicionar ou remover um servidor mova apenas uma pequena parte das chaves.",
    explanation: [
      "Com o simples hash mod N, mudar N remapeia quase todas as chaves — um desastre para caches e roteamento de conexões. O consistent hashing coloca servidores e chaves no mesmo anel; cada chave pertence ao próximo servidor no sentido horário, então uma mudança afeta apenas os vizinhos.",
    ],
    howItWorks: [
      "Cada servidor recebe muitos nós virtuais no anel para equilibrar a carga.",
      "Usado em clusters de cache, bancos wide-column, roteamento de sessões WebSocket e contadores de rate limit.",
    ],
    tradeoffs: [
      "Ainda precisa de replicação para disponibilidade; as chaves de um nó perdido precisam ser reconstruídas ou lidas de réplicas.",
    ],
    related: ["sharding", "caching", "websockets"],
  },
  {
    slug: "multi-region",
    name: "Implantação multi-região",
    summary: "Execute o sistema em várias regiões geográficas para menor latência e para sobreviver a uma queda regional.",
    explanation: [
      "Os usuários são roteados para a região saudável mais próxima por geo-DNS ou anycast. Os dados são replicados entre regiões — de forma assíncrona para a maioria, e com cuidado para tudo que precisa ser fortemente consistente.",
    ],
    howItWorks: [
      "Active-passive: uma região atende, outra fica em standby.",
      "Active-active: todas as regiões atendem tráfego; conflitos precisam ser evitados (particionar usuários por região de origem) ou resolvidos.",
      "Particionar por região (Uber por cidade) mantém a maior parte do tráfego local.",
    ],
    tradeoffs: [
      "Escritas entre regiões são lentas; consistência forte global é cara.",
      "Dobra a infraestrutura e a complexidade operacional.",
    ],
    related: ["read-replicas", "sharding"],
  },
  {
    slug: "rate-limiting",
    name: "Rate limiting",
    summary: "Limite quantas requisições um cliente pode fazer em uma janela de tempo para evitar abuso e proteger a capacidade.",
    explanation: [
      "Toda requisição é atribuída a um cliente (chave de API, usuário, IP) e verificada contra uma regra, como 100 requisições por minuto. Acima do limite, a requisição é rejeitada com HTTP 429 em vez de chegar ao backend.",
    ],
    howItWorks: [
      "Token bucket: os tokens são repostos a uma taxa constante; cada requisição consome um; permite rajadas curtas.",
      "Fixed window: contagem por minuto — simples, mas permite rajadas de 2× nas bordas da janela.",
      "Sliding window: combina janelas adjacentes para limites mais suaves.",
      "Os contadores ficam em um armazenamento em memória compartilhado e são atualizados de forma atômica.",
    ],
    tradeoffs: [
      "Adiciona uma verificação a cada requisição; precisa ser rápida e fazer fail open.",
      "Limites globais exatos entre regiões são caros; aproximações são o usual.",
    ],
    related: ["back-pressure", "caching"],
  },
  {
    slug: "authentication",
    name: "Autenticação e tokens",
    summary: "Verifique quem é o usuário uma vez e entregue a ele um token que todo serviço consiga checar de forma barata.",
    explanation: [
      "Os usuários entram com senha, login social ou OTP. O serviço de identidade emite um token assinado de curta duração (geralmente um JWT) mais um refresh token. O gateway verifica a assinatura a cada requisição sem consultar o banco de dados.",
    ],
    howItWorks: [
      "OAuth 2.0 / OpenID Connect para fluxos de login e acesso de terceiros.",
      "Access tokens de vida curta mais refresh tokens limitam o dano de vazamentos.",
      "Os serviços autorizam usando claims do token (id do usuário, papéis, plano).",
    ],
    tradeoffs: [
      "Revogar um token stateless antes de expirar exige uma deny-list.",
      "Nunca guarde senhas por conta própria sem um esquema de hash comprovado — prefira um provedor de identidade gerenciado.",
    ],
    related: ["rate-limiting", "microservices"],
  },
  {
    slug: "microservices",
    name: "Microsserviços",
    summary: "Divida um sistema em pequenos serviços, cada um dono de um domínio e dos seus próprios dados.",
    explanation: [
      "Cada serviço (usuários, pedidos, pagamentos …) é implantado e escalado de forma independente e se comunica por APIs ou eventos. Isso permite que as equipes avancem de forma independente e que os caminhos quentes escalem separadamente.",
    ],
    howItWorks: [
      "Um API gateway roteia chamadas externas; os serviços conversam via gRPC/REST e eventos.",
      "Cada serviço é dono do seu banco de dados — sem tabelas compartilhadas.",
      "Timeouts, retentativas e circuit breakers evitam falhas em cascata.",
    ],
    tradeoffs: [
      "Chamadas de rede, falhas parciais e transações distribuídas (sagas) viram problemas cotidianos.",
      "Equipes pequenas costumam se sair melhor com um monólito bem estruturado no início.",
    ],
    related: ["event-driven", "saga", "horizontal-scaling"],
  },
  {
    slug: "event-driven",
    name: "Arquitetura orientada a eventos",
    summary: "Os serviços publicam eventos sobre o que aconteceu; outros reagem de forma assíncrona.",
    explanation: [
      "Em vez de o serviço de pedidos chamar diretamente envio, e-mail e analytics, ele publica 'pedido realizado' em um log durável. Cada consumidor lê no seu próprio ritmo, então o produtor continua rápido e novos consumidores podem ser adicionados sem alterá-lo.",
    ],
    howItWorks: [
      "Um log particionado e reproduzível (estilo Kafka) mantém os eventos em ordem por chave.",
      "Os consumidores controlam seus próprios offsets e podem reprocessar o histórico para reconstruir o estado.",
      "Use uma tabela outbox para que a escrita no BD e o seu evento sejam publicados juntos.",
    ],
    tradeoffs: [
      "Consistência eventual: os consumidores ficam atrasados em relação ao produtor.",
      "A depuração atravessa muitos serviços; exige bom tracing.",
      "Os consumidores precisam ser idempotentes, pois os eventos podem ser entregues mais de uma vez.",
    ],
    related: ["idempotency", "fan-out", "change-data-capture", "back-pressure"],
  },
  {
    slug: "fan-out",
    name: "Fan-out (feeds push vs pull)",
    summary: "Entregue um item a muitos destinatários — copiado no momento da escrita ou reunido no momento da leitura.",
    explanation: [
      "Feeds (Instagram, Twitter, notificações) enfrentam uma escolha. O fan-out na escrita copia um novo post para o feed de cada seguidor, então as leituras são instantâneas. O fan-out na leitura reúne os posts de todos que você segue quando abre o feed.",
      "A maioria dos sistemas reais é híbrida: push para contas normais, pull para celebridades com milhões de seguidores.",
    ],
    howItWorks: [
      "Caminho de escrita: evento → workers de fan-out → anexar postId à lista em cache de cada seguidor.",
      "Caminho de leitura: buscar a lista em cache, mesclar posts recentes de celebridades, ranquear, hidratar.",
    ],
    tradeoffs: [
      "Push: enorme amplificação de escrita para contas populares, trabalho desperdiçado para usuários inativos.",
      "Pull: leituras lentas que tocam muitas fontes.",
    ],
    related: ["event-driven", "caching"],
  },
  {
    slug: "idempotency",
    name: "Idempotência",
    summary: "Torne uma operação segura para repetir, de modo que retentativas nunca causem efeitos duplicados.",
    explanation: [
      "As redes falham depois que a requisição é processada, mas antes de a resposta chegar. O cliente tenta de novo — e sem proteção, um pagamento é cobrado duas vezes ou um pedido é criado duas vezes.",
    ],
    howItWorks: [
      "Os clientes enviam uma chave de idempotência; o servidor guarda chave → resultado e devolve o resultado armazenado nas repetições.",
      "Unique constraints (por exemplo, uma curtida por usuário por post) tornam as escritas naturalmente idempotentes.",
      "Os consumidores de eventos eliminam duplicatas pelo id do evento ou da entidade.",
    ],
    tradeoffs: [
      "As chaves precisam ser armazenadas (com expiração) e verificadas de forma atômica.",
    ],
    related: ["event-driven", "saga", "ledger"],
  },
  {
    slug: "saga",
    name: "Padrão Saga",
    summary: "Execute uma transação entre vários serviços como uma série de etapas locais, desfazendo as etapas concluídas se uma posterior falhar.",
    explanation: [
      "O checkout envolve estoque, pagamento e envio, cada um com seu próprio banco de dados, então uma única transação ACID não está disponível. Uma saga executa cada etapa localmente e define uma ação compensatória (liberar estoque, reembolsar) para quando uma etapa posterior falha.",
    ],
    howItWorks: [
      "Orquestração: um motor de workflow chama cada etapa e a sua compensação.",
      "Coreografia: os serviços reagem aos eventos uns dos outros.",
      "Cada etapa e compensação precisa ser idempotente e passível de retentativa.",
    ],
    tradeoffs: [
      "Estados intermediários ficam visíveis (um pedido fica PENDING por um tempo).",
      "As compensações precisam ser projetadas com cuidado — algumas ações não podem ser desfeitas, apenas compensadas.",
    ],
    related: ["microservices", "idempotency", "event-driven"],
  },
  {
    slug: "ledger",
    name: "Ledger de partidas dobradas",
    summary: "Registre cada movimentação de dinheiro como débitos e créditos balanceados, para que o dinheiro nunca apareça nem desapareça.",
    explanation: [
      "Em vez de atualizar uma coluna de saldo, os sistemas de pagamento acrescentam lançamentos: debitam uma conta, creditam outra, somando zero. Os saldos são derivados dos lançamentos, e o histórico completo serve como trilha de auditoria.",
    ],
    howItWorks: [
      "Os lançamentos são append-only; erros são corrigidos com novos lançamentos de estorno.",
      "Snapshots periódicos de saldo mantêm as leituras rápidas.",
      "A conciliação compara o ledger com os arquivos de liquidação bancária.",
    ],
    tradeoffs: [
      "Mais linhas e disciplina mais rígida do que um simples campo de saldo.",
    ],
    related: ["idempotency", "saga"],
  },
  {
    slug: "distributed-locks",
    name: "Locks distribuídos e holds",
    summary: "Impeça que dois processos reivindiquem a mesma coisa ao mesmo tempo — um assento, um motorista, um horário.",
    explanation: [
      "Reservas e despacho precisam de exclusividade entre muitos servidores. Um lock ou hold de curta duração em um armazenamento compartilhado marca um item como ocupado enquanto o resto do processo termina.",
    ],
    howItWorks: [
      "Defina uma chave somente se ausente, com TTL (SET NX EX), para que holders que travaram liberem automaticamente.",
      "Ou use row locks do banco de dados / atualizações condicionais (available ≥ qty).",
      "Fencing tokens impedem que um holder obsoleto aja depois que o lock expirou.",
    ],
    tradeoffs: [
      "Problemas de relógio e de rede tornam os locks baseados em cache imperfeitos; caminhos críticos de dinheiro devem confiar em constraints do banco de dados.",
    ],
    related: ["caching", "idempotency"],
  },
  {
    slug: "back-pressure",
    name: "Back-pressure e filas",
    summary: "Quando os produtores superam os consumidores, faça buffer e desacelere em vez de cair.",
    explanation: [
      "Picos (um upload viral, uma venda relâmpago) chegam mais rápido do que os workers conseguem processar. Uma fila absorve a rajada, de modo que o custo é atraso, não falha, e sinaliza a montante para desacelerar quando fica longa demais.",
    ],
    howItWorks: [
      "Fila entre o caminho da requisição e o trabalho pesado (transcodificação, e-mails, fan-out).",
      "Faça autoscale dos consumidores pela profundidade da fila.",
      "Dead-letter queues para mensagens que continuam falhando.",
      "Rejeite ou descarte carga de baixa prioridade quando as filas estiverem cheias.",
    ],
    tradeoffs: [
      "Os usuários veem atrasos durante picos; as filas precisam de monitoramento.",
    ],
    related: ["event-driven", "rate-limiting"],
  },
  {
    slug: "websockets",
    name: "WebSockets e push em tempo real",
    summary: "Mantenha uma conexão persistente aberta para que o servidor possa enviar atualizações instantaneamente.",
    explanation: [
      "Chat, rastreamento ao vivo e cotações não podem esperar por polling. Cada cliente mantém uma conexão de longa duração com um gateway; o servidor envia as mensagens assim que acontecem.",
    ],
    howItWorks: [
      "Um registro de conexões mapeia userId → nó do gateway.",
      "Os gateways trocam mensagens via pub/sub, de modo que qualquer nó alcance qualquer usuário.",
      "Heartbeats detectam conexões mortas; os clientes reconectam com backoff.",
    ],
    tradeoffs: [
      "Servidores com estado: deploys e falhas causam tempestades de reconexão.",
      "Cada nó mantém dezenas de milhares de sockets — exige I/O assíncrono e balanceamento de carga L4.",
    ],
    related: ["consistent-hashing", "event-driven"],
  },
  {
    slug: "adaptive-bitrate-streaming",
    name: "Streaming com taxa de bits adaptativa",
    summary: "Codifique o vídeo em várias qualidades, em pequenos segmentos, para que o player troque de qualidade conforme a banda muda.",
    explanation: [
      "Os vídeos são transcodificados em renditions (240p–4K) e cortados em segmentos de 2–10 segundos listados em um manifest (HLS ou DASH). O player mede a vazão e escolhe a melhor qualidade para o próximo segmento, evitando buffering.",
    ],
    howItWorks: [
      "Transcodifique em chunks paralelos; guarde os segmentos em armazenamento de objetos.",
      "Sirva manifests e segmentos a partir de uma CDN.",
      "A codificação por título ajusta os bitrates à complexidade do conteúdo.",
    ],
    tradeoffs: [
      "Muitas renditions multiplicam o custo de armazenamento e de codificação.",
    ],
    related: ["caching", "presigned-urls"],
  },
  {
    slug: "presigned-urls",
    name: "Uploads pré-assinados",
    summary: "Permita que os clientes enviem arquivos grandes direto para o armazenamento de objetos usando uma URL assinada de curta duração.",
    explanation: [
      "Transmitir gigabytes pelos seus servidores de API desperdiça banda e CPU. Em vez disso, a API devolve uma URL assinada que permite um upload para um local por alguns minutos; o cliente envia o arquivo diretamente ao armazenamento.",
    ],
    howItWorks: [
      "Uploads multipart/retomáveis para arquivos grandes; hashes de chunks permitem deduplicação.",
      "Um evento de armazenamento ou callback do cliente dispara o processamento depois.",
    ],
    tradeoffs: [
      "O servidor precisa validar o arquivo após o upload (tipo, tamanho, malware).",
    ],
    related: ["adaptive-bitrate-streaming", "event-driven"],
  },
  {
    slug: "search-indexing",
    name: "Indexação de busca",
    summary: "Mantenha um índice invertido para que consultas de texto encontrem documentos correspondentes em milissegundos.",
    explanation: [
      "Bancos de dados são ruins em 'encontrar produtos que correspondam a fones de ouvido sem fio por menos de R$ 100'. Um mecanismo de busca tokeniza o texto em um índice invertido (termo → documentos), oferece filtros e facetas e ranqueia os resultados.",
    ],
    howItWorks: [
      "Alimente o índice a partir de eventos de mudança (CDC) para que ele fique próximo da fonte da verdade.",
      "Faça sharding do índice e adicione réplicas para vazão de consultas.",
      "O autocomplete usa índices de prefixo ou tries.",
    ],
    tradeoffs: [
      "O índice fica ligeiramente atrás do banco de dados.",
      "Reindexar catálogos grandes leva tempo; use aliases para trocar índices.",
    ],
    related: ["change-data-capture", "sharding"],
  },
  {
    slug: "geospatial-indexing",
    name: "Indexação geoespacial",
    summary: "Agrupe localizações em células para que 'o que está perto de mim' vire uma consulta rápida.",
    explanation: [
      "Transporte por aplicativo e delivery precisam de motoristas ou restaurantes próximos instantaneamente. O mapa é dividido em células (Geohash, S2, H3); cada localização é guardada sob a sua célula, e uma busca por proximidade lê a célula e as suas vizinhas.",
    ],
    howItWorks: [
      "Posições ao vivo em memória indexadas por célula; atualizadas a cada poucos segundos.",
      "Células menores em cidades densas, maiores nos demais lugares.",
      "Ranqueie candidatos pelo ETA por estrada, não pela distância em linha reta.",
    ],
    tradeoffs: [
      "Os limites das células significam que você também precisa buscar nas células vizinhas.",
      "Células quentes em áreas movimentadas precisam de shards extras.",
    ],
    related: ["sharding", "caching"],
  },
  {
    slug: "leader-election",
    name: "Eleição de líder e coordenação",
    summary: "Entre em acordo sobre qual nó está no comando ou quem é dono de qual shard, usando um serviço de coordenação consistente.",
    explanation: [
      "Alguns jobs precisam rodar em exatamente um nó (schedulers, donos de shards, alocação de faixas de chaves). Um armazenamento baseado em consenso, como etcd ou ZooKeeper, concede leases; se o líder morre, o lease expira e outro nó assume.",
    ],
    howItWorks: [
      "Leases com TTL e heartbeats.",
      "Watches notificam os nós quando a configuração ou a propriedade muda.",
    ],
    tradeoffs: [
      "O próprio cluster de coordenação precisa ser pequeno, confiável e rápido.",
    ],
    related: ["distributed-locks", "consistent-hashing"],
  },
  {
    slug: "id-generation",
    name: "Geração de IDs únicos",
    summary: "Crie IDs únicos, frequentemente ordenáveis por tempo, em muitas máquinas sem um gargalo central.",
    explanation: [
      "Colunas auto-increment não funcionam entre shards. IDs estilo Snowflake combinam um timestamp, um id de máquina e uma sequência por máquina em 64 bits, então são únicos e ordenam por tempo. Links curtos usam contadores de faixas pré-alocadas codificados em Base62.",
    ],
    howItWorks: [
      "Snowflake: 41 bits de tempo + 10 bits de worker + 12 bits de sequência.",
      "Alocação de faixas: cada gerador reivindica um bloco de números de um armazenamento de coordenação.",
      "UUIDv7 oferece IDs aleatórios ordenados por tempo sem coordenação.",
    ],
    tradeoffs: [
      "O clock skew pode quebrar a ordenação; IDs sequenciais podem ser adivinháveis.",
    ],
    related: ["sharding", "leader-election"],
  },
  {
    slug: "change-data-capture",
    name: "Change data capture",
    summary: "Transmita cada mudança do banco de dados como um evento para que outros sistemas fiquem sincronizados sem dual writes.",
    explanation: [
      "Escrever em um banco de dados e depois, separadamente, em um índice de busca ou cache pode deixá-los inconsistentes se uma escrita falhar. O CDC acompanha o próprio log de mudanças do banco e publica cada insert, update e delete, de modo que as cópias a jusante seguem a fonte da verdade.",
    ],
    howItWorks: [
      "Ferramentas leem o write-ahead log ou binlog e publicam em um event stream.",
      "Os consumidores atualizam índices de busca, caches e warehouses.",
    ],
    tradeoffs: [
      "As cópias a jusante são eventualmente consistentes.",
      "Mudanças de schema precisam ser coordenadas com os consumidores.",
    ],
    related: ["event-driven", "search-indexing"],
  },
  {
    slug: "bloom-filter",
    name: "Bloom filters",
    summary: "Um minúsculo conjunto probabilístico que responde 'definitivamente não visto' ou 'provavelmente visto' usando poucos bits por item.",
    explanation: [
      "Verificar bilhões de itens (URLs que um crawler já visitou, nomes de usuário em uso) em um banco de dados é lento. Um Bloom filter faz o hash de cada item para algumas posições de bit; se algum bit não estiver definido, o item nunca foi adicionado. Falsos positivos são possíveis, falsos negativos não.",
    ],
    howItWorks: [
      "k funções de hash definem k bits por item inserido.",
      "As consultas verificam os mesmos k bits; todos definidos significa 'provavelmente presente'.",
      "Dimensione o array de bits para a contagem esperada de itens e a taxa aceitável de falsos positivos (~10 bits por item ≈ 1%).",
    ],
    tradeoffs: [
      "Não é possível excluir itens (use counting Bloom filters) e nunca dá um 'sim' definitivo.",
    ],
    related: ["caching", "sharding"],
  },
  {
    slug: "prefix-trie",
    name: "Tries e busca por prefixo",
    summary: "Armazene strings pelos seus prefixos para que as 'melhores sugestões para o que o usuário digitou até agora' sejam uma única consulta.",
    explanation: [
      "O autocomplete precisa responder a cada tecla digitada. Um trie mapeia cada prefixo para os seus filhos; guardar as top-k completions em cada nó faz da consulta uma única descida pelo prefixo, sem ranqueamento no momento da consulta.",
    ],
    howItWorks: [
      "Construa tries offline a partir de logs de consultas, ponderando por frequência e recência.",
      "Faça sharding por faixa de prefixo e mantenha os prefixos quentes em um cache em memória.",
      "Atualize periodicamente; misture consultas em alta vindas de um stream.",
    ],
    tradeoffs: [
      "Consome muita memória; listas top-k pré-calculadas ficam atrás de tendências repentinas.",
    ],
    related: ["caching", "sharding", "search-indexing"],
  },
  {
    slug: "webrtc",
    name: "Chamadas WebRTC",
    summary: "Áudio e vídeo em tempo real entre navegadores e apps, com servidores apenas para sinalização e retransmissão quando necessário.",
    explanation: [
      "Os peers trocam detalhes de conexão por meio de um servidor de sinalização (frequentemente via WebSockets) e depois tentam se conectar diretamente. O STUN descobre endereços públicos; quando firewalls bloqueiam caminhos diretos, um servidor TURN retransmite a mídia. Chamadas em grupo usam um SFU que encaminha cada stream para os outros participantes.",
    ],
    howItWorks: [
      "Sinalização: offer/answer e candidatos ICE via WebSockets.",
      "STUN para descoberta de NAT; o TURN retransmite cerca de 10–20% das chamadas.",
      "SFU para grupos; o simulcast permite que cada espectador receba uma qualidade adequada.",
    ],
    tradeoffs: [
      "A banda do TURN e do SFU é o principal custo.",
      "Gravação e compliance exigem pipelines extras.",
    ],
    related: ["websockets", "multi-region"],
  },
];

/** Família de cor de cada conceito (validado: todo conceito precisa ter uma). */
export const conceptFamilyBySlug: Record<string, ConceptFamily> = {
  caching: "data",
  sharding: "data",
  "read-replicas": "data",
  "search-indexing": "data",
  "change-data-capture": "data",
  ledger: "data",
  "horizontal-scaling": "scale",
  "consistent-hashing": "scale",
  "multi-region": "scale",
  "geospatial-indexing": "scale",
  "id-generation": "scale",
  "bloom-filter": "scale",
  "prefix-trie": "scale",
  "event-driven": "messaging",
  "fan-out": "messaging",
  "back-pressure": "messaging",
  websockets: "messaging",
  saga: "messaging",
  "adaptive-bitrate-streaming": "messaging",
  "presigned-urls": "messaging",
  webrtc: "messaging",
  idempotency: "reliability",
  "distributed-locks": "reliability",
  "leader-election": "reliability",
  "rate-limiting": "reliability",
  microservices: "reliability",
  authentication: "security",
};
