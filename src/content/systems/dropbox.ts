import type { SystemDesignInput } from "@/types/schema";

export const dropbox: SystemDesignInput = {
  slug: "dropbox",
  name: "Dropbox",
  tagline: "Sincronização de arquivos em todos os dispositivos",
  description:
    "O cliente de sincronização divide os arquivos em blocos de 4 MB e gera uma impressão digital (hash) para cada um. Apenas os blocos que o servidor ainda não viu são enviados, diretamente para o object storage, de modo que edições em arquivos grandes e arquivos duplicados não custam quase nada. Um serviço de metadados registra cada versão de arquivo como uma lista de hashes de blocos e a adiciona a um diário de alterações (change journal); outros dispositivos são avisados de que 'algo mudou' por meio de uma conexão de longa duração e baixam apenas os blocos novos.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["presigned-urls", "websockets", "sharding", "caching", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Fazer upload, download, renomear, mover e excluir arquivos e pastas",
      "Sincronização automática entre os dispositivos de um usuário",
      "Compartilhar arquivos e pastas com outros usuários",
      "Histórico de versões e restauração",
      "Trabalhar offline e reconciliar ao reconectar",
    ],
    nonFunctional: [
      "Nunca perder um arquivo; os arquivos são armazenados com alta durabilidade",
      "Sincronizar em poucos segundos após uma alteração",
      "Eficiente: reenviar apenas as partes alteradas de arquivos grandes",
      "Consistência forte para metadados (sem duas versões 'mais recentes' sem gerar uma cópia em conflito)",
    ],
  },

  apis: [
    { method: "POST", path: "/files/commit", purpose: "{ path, blockHashes[], baseVersion } → hashes de blocos ausentes ou nova versão" },
    { method: "PUT", path: "/blocks/{hash}", purpose: "Enviar um bloco (via pre-signed URL)" },
    { method: "GET", path: "/changes?cursor=", purpose: "Tudo o que mudou desde o cursor do dispositivo" },
    { method: "GET", path: "/blocks/{hash}", purpose: "Baixar um bloco" },
    { method: "WS", path: "/notify", purpose: "Conexão de longa duração que avisa 'novas alterações disponíveis'" },
    { method: "POST", path: "/shares", purpose: "Compartilhar uma pasta com outro usuário" },
  ],

  estimates: [
    { label: "Usuários", value: "≈ 50 M, 10 M diários", derivation: "Estimativa" },
    { label: "Dados armazenados", value: "≈ 1 EB lógicos", derivation: "50 M × ~20 GB usados em média; deduplicação reduz o armazenamento físico" },
    { label: "Alterações de arquivos", value: "≈ 12 mil/s", derivation: "10 M de usuários ativos × 100 alterações ÷ 86.400 s" },
    { label: "Transferência", value: "≈ 2 PB/dia (~185 Gbps)", derivation: "10 M de usuários × ~200 MB sincronizados por dia" },
  ],

  dataModel: [
    {
      entity: "Versão do arquivo",
      store: "Banco relacional, com sharding por namespace (usuário ou pasta compartilhada)",
      key: "namespaceId + path + version",
      fields: ["blockHashes[]", "size", "modifiedAt", "deviceId"],
      why: "Atualizações transacionais e detecção de conflitos por pasta",
    },
    {
      entity: "Diário de alterações (Change journal)",
      store: "Banco relacional (append-only por namespace)",
      key: "namespaceId + sequence",
      fields: ["path", "operation", "version"],
      why: "Os dispositivos retomam a sincronização a partir de um cursor neste log",
    },
    {
      entity: "Bloco",
      store: "Object storage",
      key: "sha256 do conteúdo",
      fields: ["≤ 4 MB de bytes"],
      why: "Endereçado por conteúdo: blocos idênticos são armazenados apenas uma vez",
    },
  ],

  nodes: [
    { id: "desktop", kind: "web-client", label: "Cliente de sincronização desktop", role: "Monitora pastas, divide em blocos e calcula hashes dos arquivos" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Navega e baixa sob demanda" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Distribui o tráfego da API" },
    { id: "meta-svc", kind: "service", label: "Serviço de metadados", role: "Registra versões de arquivos e fornece listas de alterações" },
    { id: "notify", kind: "realtime-gateway", label: "Serviço de notificação", role: "Avisa os dispositivos conectados que suas pastas mudaram" },
    { id: "meta-db", kind: "relational-db", label: "Metadados e diário", role: "Versões de arquivos e log de alterações por pasta" },
    { id: "meta-cache", kind: "cache", label: "Cache de metadados", role: "Listagens de pastas quentes e verificações de existência de blocos" },
    { id: "blocks", kind: "object-storage", label: "Armazenamento de blocos", role: "Blocos de 4 MB endereçados por conteúdo" },
    { id: "events", kind: "event-stream", label: "Eventos de alteração", role: "Um evento por alteração confirmada" },
  ],

  edges: [
    { id: "desktop-lb", from: "desktop", to: "lb", label: "Commit / listar alterações" },
    { id: "mobile-lb", from: "mobile", to: "lb" },
    { id: "lb-meta", from: "lb", to: "meta-svc" },
    { id: "meta-db-rw", from: "meta-svc", to: "meta-db" },
    { id: "meta-cache-rw", from: "meta-svc", to: "meta-cache", label: "Blocos conhecidos?" },
    { id: "desktop-blocks", from: "desktop", to: "blocks", label: "Enviar blocos ausentes (pre-signed)" },
    { id: "mobile-blocks", from: "mobile", to: "blocks", label: "Baixar blocos" },
    { id: "meta-events", from: "meta-svc", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "desktop-notify", from: "desktop", to: "notify", label: "Inscrever-se", protocol: "ws" },
    { id: "mobile-notify", from: "mobile", to: "notify", protocol: "ws" },
  ],

  flows: [
    {
      id: "upload",
      name: "Salvar um arquivo",
      steps: [
        { edge: "desktop-lb", text: "O cliente detecta uma alteração, divide o arquivo em blocos de 4 MB, calcula seus hashes e pede para fazer o commit da nova versão." },
        { edge: "lb-meta", text: "O serviço de metadados recebe a lista de hashes dos blocos." },
        { edge: "meta-cache-rw", text: "Ele verifica quais blocos já existem — geralmente a maioria deles." },
        { edge: "desktop-blocks", text: "O cliente faz upload apenas dos blocos ausentes, diretamente para o armazenamento." },
        { edge: "meta-db-rw", text: "O cliente tenta o commit novamente; a nova versão e uma entrada no diário são gravadas em uma única transação. Se a versão base estiver desatualizada, uma cópia em conflito é criada." },
        { edge: "meta-events", text: "Um evento de alteração é publicado." },
        { edge: "events-notify", text: "O serviço de notificação encontra os outros dispositivos conectados do usuário." },
        { edge: "mobile-notify", text: "Cada dispositivo é avisado sobre 'novas alterações'…" },
        { edge: "mobile-lb", text: "…e solicita as alterações desde o seu cursor." },
        { edge: "mobile-blocks", text: "Ele baixa apenas os blocos que ainda não possui." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Reenviar arquivos inteiros por causa de pequenas edições",
      fix: "Divisão em nível de bloco (chunking) com hashes de conteúdo; apenas os blocos alterados trafegam. Arquivos idênticos entre usuários são armazenados uma única vez.",
      nodes: ["desktop", "blocks"],
    },
    {
      problem: "Milhões de dispositivos ociosos fazendo polling por alterações",
      fix: "Conexões de notificação de longa duração que apenas dizem 'algo mudou'; os dispositivos então buscam o delta.",
      nodes: ["notify"],
    },
    {
      problem: "Dois dispositivos editando o mesmo arquivo offline",
      fix: "Os commits carregam a versão base; uma divergência cria uma cópia em conflito em vez de sobrescrever.",
      nodes: ["meta-svc", "meta-db"],
    },
    {
      problem: "Pastas compartilhadas enormes se tornam hotspots de metadados",
      fix: "Fazer sharding por namespace e cache das listagens; paginar as listas de alterações.",
      nodes: ["meta-db", "meta-cache"],
    },
  ],

  scaling: [
    "Faça sharding dos metadados por namespace para que o diário de cada pasta fique em um único shard.",
    "O object storage escala por conta própria; replique os blocos entre zonas ou regiões.",
    "Escale a camada de notificação horizontalmente com um registro de conexões.",
    "Mantenha os uploads de blocos fora dos servidores de API usando pre-signed URLs.",
  ],

  extensions: [
    "Sincronização via LAN entre dispositivos na mesma rede.",
    "Sincronização seletiva e arquivos placeholder sob demanda.",
    "Busca em texto completo (full-text search) sobre documentos.",
    "Criptografia no lado do cliente (client-side encryption).",
  ],
};
