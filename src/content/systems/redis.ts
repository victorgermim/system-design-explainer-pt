import type { SystemDesignInput } from "@/types/schema";

// Managed services expose a cluster endpoint; self-hosted clusters use cluster-aware clients or a proxy.
const endpoint = { aws: "ElastiCache cluster endpoint", gcp: "Memorystore cluster endpoint", azure: "Azure Managed Redis endpoint", oss: "Cliente cluster-aware / Envoy" };
const primary = { aws: "Nó primary do ElastiCache", gcp: "Nó primary do Memorystore", azure: "Primary do Azure Managed Redis", oss: "Primary do Redis" };
const replica = { aws: "Réplica do ElastiCache", gcp: "Réplica do Memorystore", azure: "Réplica do Azure Managed Redis", oss: "Réplica do Redis" };

export const redis: SystemDesignInput = {
  slug: "redis",
  name: "Redis Cluster",
  tagline: "Data store distribuído em memória",
  description:
    "O Redis Cluster divide o espaço de chaves em 16.384 hash slots distribuídos entre vários nós primary, cada um com uma ou mais réplicas. Os clientes fazem o hash de cada chave para o seu slot e falam diretamente com o primary responsável, seguindo redirecionamentos MOVED quando os slots migram. Os primaries replicam de forma assíncrona para suas réplicas, e os próprios nós detectam falhas pelo cluster bus e votam para promover uma réplica — sem necessidade de coordenador externo.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["caching", "sharding", "consistent-hashing", "read-replicas", "leader-election"],

  requirements: {
    functional: [
      "Get, set e expiração de chaves, além de estruturas de dados (hashes, sets, sorted sets, streams)",
      "Distribuir dados e carga entre muitos nós",
      "Leituras opcionais a partir de réplicas",
      "Adicionar ou remover nós e mover dados sem downtime",
      "Sobreviver à perda de um primary com failover automático",
    ],
    nonFunctional: [
      "Latência submilissegundo para operações de chave única",
      "Escalabilidade linear do throughput conforme primaries são adicionados",
      "Failover em segundos",
      "Aceitar uma pequena janela de escritas perdidas no failover (a replicação é assíncrona)",
    ],
  },

  apis: [
    { method: "GRPC", path: "GET / SET key [EX ttl]", purpose: "Comandos básicos de chave-valor sobre o protocolo Redis (RESP)" },
    { method: "GRPC", path: "CLUSTER SLOTS / SHARDS", purpose: "Os clientes obtêm qual nó é dono de qual faixa de slots" },
    { method: "GRPC", path: "→ MOVED 3999 10.0.0.12:6379", purpose: "Redirecionamento quando o cliente consulta o nó errado; ele atualiza seu mapa de slots" },
    { method: "GRPC", path: "MULTI / EXEC on {tag} keys", purpose: "Operações com várias chaves só funcionam quando as chaves compartilham uma hash tag (mesmo slot)" },
  ],

  estimates: [
    { label: "Hash slots", value: "16.384", derivation: "slot = CRC16(key) mod 16384; os slots são a unidade de sharding" },
    { label: "Throughput por primary", value: "≈ 100 k+ ops/s", derivation: "Execução de comandos single-threaded em um único core" },
    { label: "Throughput do cluster", value: "≈ 300 k ops/s com 3 primaries", derivation: "Escala de forma aproximadamente linear com os primaries" },
    { label: "Memória por nó", value: "Dezenas de GB", derivation: "Dataset ÷ primaries, mais overhead; réplicas dobram a memória total" },
  ],

  dataModel: [
    {
      entity: "Chave",
      store: "In-memory, on the primary that owns its slot",
      key: "CRC16(key or {hash tag}) mod 16384",
      fields: ["value (string, hash, list, set, sorted set, stream)", "TTL"],
      why: "O hash para slots distribui as chaves uniformemente; hash tags mantêm chaves relacionadas juntas",
    },
    {
      entity: "Mapa de slots",
      store: "Every node (cluster bus) and every client",
      key: "slot range",
      fields: ["primary address", "replica addresses"],
      why: "Permite que os clientes enviem cada comando direto ao nó certo",
    },
    {
      entity: "Persistência",
      store: "Local disk (RDB snapshots / AOF log)",
      key: "per node",
      fields: ["snapshot", "append-only file"],
      why: "Recuperação após reinício; a replicação é o principal mecanismo de disponibilidade",
    },
  ],

  nodes: [
    { id: "app-client", kind: "web-client", label: "Cliente da aplicação", role: "Serviços que usam o Redis para cache, sessões, contadores ou pub/sub" },
    { id: "proxy", kind: "cache", label: "Endpoint do cluster / cliente inteligente", role: "Mapeia cada chave ao seu slot e ao nó responsável", overrides: endpoint },
    {
      id: "failover",
      kind: "cache",
      label: "Detecção de falhas (cluster bus)",
      role: "Os nós trocam informações de saúde por gossip; a maioria dos primaries vota para promover uma réplica",
      overrides: { aws: "Failover automático do ElastiCache", gcp: "Memorystore HA", azure: "Azure Managed Redis HA", oss: "Cluster bus embutido" },
    },
    { id: "primary-1", kind: "cache", label: "Primary A (slots 0–5460)", role: "É dono de um terço dos slots; processa as escritas", overrides: primary },
    { id: "replica-1", kind: "cache", label: "Réplica A", role: "Cópia de A; pode atender leituras e assumir o lugar", overrides: replica },
    { id: "primary-2", kind: "cache", label: "Primary B (slots 5461–10922)", role: "É dono de um terço dos slots; processa as escritas", overrides: primary },
    { id: "replica-2", kind: "cache", label: "Réplica B", role: "Cópia de B", overrides: replica },
    { id: "primary-3", kind: "cache", label: "Primary C (slots 10923–16383)", role: "É dono de um terço dos slots; processa as escritas", overrides: primary },
    { id: "replica-3", kind: "cache", label: "Réplica C", role: "Cópia de C", overrides: replica },
    { id: "monitoring", kind: "observability", label: "Monitoramento", role: "Memória, latência, hit rate e lag de replicação por nó" },
  ],

  edges: [
    { id: "client-proxy", from: "app-client", to: "proxy", label: "Protocolo Redis" },
    { id: "proxy-a", from: "proxy", to: "primary-1", label: "Comandos" },
    { id: "proxy-b", from: "proxy", to: "primary-2" },
    { id: "proxy-c", from: "proxy", to: "primary-3" },
    { id: "repl-a", from: "primary-1", to: "replica-1", label: "Replicação assíncrona", protocol: "async" },
    { id: "repl-b", from: "primary-2", to: "replica-2", protocol: "async" },
    { id: "repl-c", from: "primary-3", to: "replica-3", protocol: "async" },
    { id: "proxy-replica-a", from: "proxy", to: "replica-1", label: "Leituras opcionais" },
    { id: "failover-a", from: "failover", to: "primary-1", label: "Saúde" },
    { id: "failover-b", from: "failover", to: "primary-2" },
    { id: "failover-c", from: "failover", to: "primary-3" },
    { id: "failover-promote", from: "failover", to: "replica-1", label: "Promover" },
    { id: "monitoring-b", from: "monitoring", to: "primary-2", label: "Métricas (todos os nós)" },
  ],

  flows: [
    {
      id: "write",
      name: "Escrever uma chave",
      steps: [
        { edge: "client-proxy", text: "O app executa SET user:42 …; o cliente faz o hash da chave para o slot 5649." },
        { edge: "proxy-b", text: "Seu mapa de slots diz que o Primary B é dono desse slot, então o comando vai direto para lá (se o mapa estiver desatualizado, B responde MOVED e o cliente o atualiza)." },
        { edge: "repl-b", text: "B confirma imediatamente e envia a escrita para a sua réplica de forma assíncrona." },
      ],
    },
    {
      id: "failover",
      name: "Um primary falha",
      steps: [
        { edge: "failover-a", text: "O Primary A para de responder; os outros nós o marcam como possivelmente falho pelo cluster bus." },
        { edge: "failover-promote", text: "A maioria dos primaries concorda, e a Réplica A é promovida a dona dos slots 0–5460." },
        { edge: "proxy-replica-a", text: "Os clientes recebem respostas MOVED, atualizam seu mapa de slots e enviam as chaves de A ao novo primary. Escritas ainda não replicadas são perdidas." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Hot keys concentram a carga em um único primary",
      fix: "Dividir as hot keys, mantê-las em cache na aplicação ou ler das réplicas quando dados levemente desatualizados são aceitáveis.",
      nodes: ["primary-2", "proxy"],
    },
    {
      problem: "Chaves grandes e comandos lentos bloqueiam a única thread",
      fix: "Evitar coleções enormes e comandos O(N) como KEYS; usar SCAN e estruturas menores.",
      nodes: ["primary-1", "primary-2", "primary-3"],
    },
    {
      problem: "Escritas perdidas no failover",
      fix: "Aceitar isso em caches; para dados críticos, usar WAIT para acks das réplicas ou um store durável como fonte da verdade.",
      nodes: ["failover", "replica-1"],
    },
  ],

  scaling: [
    "Adicionar primaries e mover hash slots para eles online (resharding).",
    "Adicionar réplicas para capacidade de leitura e failover mais rápido.",
    "Usar hash tags ({user:42}) para que chaves usadas juntas caiam em um único slot.",
    "Distribuir os nós entre zonas de disponibilidade para que a queda de uma zona deixe a maioria dos primaries de pé.",
  ],

  extensions: [
    "Redis Streams como um log de eventos leve.",
    "Cache no cliente com invalidação assistida pelo servidor.",
    "Configurações active-active com geo-replicação (baseadas em CRDT) para escritas multirregião.",
  ],
};
