import type { SystemDesignInput } from "@/types/schema";

export const pastebin: SystemDesignInput = {
  slug: "pastebin",
  name: "Pastebin",
  tagline: "Compartilhe trechos de texto por link curto",
  description:
    "Um primo próximo do encurtador de URLs, com valores maiores. O texto colado vai para o object storage, um pequeno registro de metadados guarda a chave, o dono e a expiração, e as leituras são servidas por CDN e cache, porque pastes populares são lidos muito mais do que escritos. Pastes expirados são removidos por um job em segundo plano.",
  category: "infrastructure",
  difficulty: 1,
  concepts: ["id-generation", "caching", "sharding", "rate-limiting"],

  requirements: {
    functional: [
      "Criar um paste (até alguns MB) e receber uma URL curta",
      "Ler um paste pela URL, incluindo uma visualização em texto puro",
      "Expiração opcional, proteção por senha e visibilidade não listada",
      "Excluir seus próprios pastes",
    ],
    nonFunctional: [
      "Leituras rápidas e com alta disponibilidade",
      "Pastes duráveis até expirarem",
      "Chaves difíceis de adivinhar",
    ],
  },

  apis: [
    { method: "POST", path: "/pastes", purpose: "{ content, expiresIn?, visibility? } → { key, url }" },
    { method: "GET", path: "/{key}", purpose: "Paste renderizado" },
    { method: "GET", path: "/raw/{key}", purpose: "Texto puro (cacheável na CDN)" },
    { method: "DELETE", path: "/pastes/{key}", purpose: "Excluir (somente o dono)" },
  ],

  estimates: [
    { label: "Novos pastes", value: "≈ 1 M/dia (~12/s)", derivation: "Premissa" },
    { label: "Leituras", value: "≈ 10 M/dia (~115/s)", derivation: "Proporção leitura/escrita de 10:1" },
    { label: "Novo conteúdo", value: "≈ 10 GB/dia", derivation: "1 M × ~10 KB em média; ~3,6 TB por ano" },
    { label: "Metadados", value: "≈ 0,5 GB/dia", derivation: "1 M × ~500 bytes" },
  ],

  dataModel: [
    {
      entity: "Metadados do paste",
      store: "Key-value DB",
      key: "key",
      fields: ["contentUrl", "ownerId", "sizeBytes", "visibility", "createdAt", "expiresAt"],
      why: "Registros pequenos consultados apenas pela chave",
    },
    {
      entity: "Conteúdo do paste",
      store: "Object storage",
      key: "key",
      fields: ["text (compressed)"],
      why: "Valores grandes não pertencem ao banco de dados",
    },
  ],

  nodes: [
    { id: "browser", kind: "web-client", label: "Navegador / CLI", role: "Cria e lê pastes" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Faz cache do texto puro dos pastes na borda" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Distribui o tráfego" },
    { id: "app", kind: "service", label: "Serviço de pastes", role: "Cria, lê e exclui pastes" },
    { id: "kgs", kind: "service", label: "Gerador de chaves", role: "Entrega chaves aleatórias únicas" },
    { id: "cache", kind: "cache", label: "Cache", role: "Metadados de pastes quentes e conteúdos pequenos" },
    { id: "meta-db", kind: "nosql-db", label: "Metadados dos pastes", role: "key → local do conteúdo e expiração" },
    { id: "blob", kind: "object-storage", label: "Conteúdo dos pastes", role: "O texto em si" },
    { id: "cleanup", kind: "serverless", label: "Limpeza de expirados", role: "Exclui pastes expirados" },
  ],

  edges: [
    { id: "browser-lb", from: "browser", to: "lb", label: "Criar / ler" },
    { id: "browser-cdn", from: "browser", to: "cdn", label: "Visualização raw" },
    { id: "cdn-lb", from: "cdn", to: "lb", label: "Miss" },
    { id: "lb-app", from: "lb", to: "app" },
    { id: "app-kgs", from: "app", to: "kgs", label: "Próxima chave", protocol: "grpc" },
    { id: "app-blob", from: "app", to: "blob" },
    { id: "app-meta", from: "app", to: "meta-db" },
    { id: "app-cache", from: "app", to: "cache" },
    { id: "cleanup-meta", from: "cleanup", to: "meta-db", label: "Encontrar expirados" },
    { id: "cleanup-blob", from: "cleanup", to: "blob", label: "Excluir" },
  ],

  flows: [
    {
      id: "create",
      name: "Criar um paste",
      steps: [
        { edge: "browser-lb", text: "O usuário envia o texto (com rate limit por IP)." },
        { edge: "lb-app", text: "O serviço de pastes valida o tamanho." },
        { edge: "app-kgs", text: "Ele obtém uma chave aleatória única." },
        { edge: "app-blob", text: "O conteúdo é comprimido e armazenado." },
        { edge: "app-meta", text: "Os metadados com o local do conteúdo e a expiração são salvos, e a URL é retornada." },
      ],
    },
    {
      id: "read",
      name: "Ler um paste",
      steps: [
        { edge: "browser-cdn", text: "As visualizações raw de pastes populares vêm da CDN." },
        { edge: "cdn-lb", text: "Em caso de miss, a requisição chega ao serviço." },
        { edge: "lb-app", text: "O serviço de pastes faz a consulta." },
        { edge: "app-cache", text: "Pastes quentes estão no cache…" },
        { edge: "app-meta", text: "…caso contrário, os metadados são lidos e a expiração é verificada." },
        { edge: "app-blob", text: "O conteúdo é buscado no armazenamento e colocado em cache." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Pastes grandes no banco de dados",
      fix: "Manter o conteúdo no object storage e apenas um ponteiro no banco de dados.",
      nodes: ["blob", "meta-db"],
    },
    {
      problem: "Pastes virais",
      fix: "Servir o conteúdo raw pela CDN e pelo cache com TTLs adequados.",
      nodes: ["cdn", "cache"],
    },
    {
      problem: "Abuso (spam, segredos vazados, malware)",
      fix: "Rate limits, limites de tamanho e varredura antes de tornar pastes públicos.",
      nodes: ["app"],
    },
  ],

  scaling: [
    "Fazer sharding dos metadados pelo hash da chave.",
    "Usar regras de ciclo de vida do armazenamento como rede de segurança para a expiração.",
    "Serviços stateless escalam atrás do load balancer.",
  ],

  extensions: [
    "Realce de sintaxe e detecção de linguagem.",
    "Histórico e versões de pastes.",
    "Pastes privados criptografados no cliente.",
  ],
};
