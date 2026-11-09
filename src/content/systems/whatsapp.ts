import type { SystemDesignInput } from "@/types/schema";

export const whatsapp: SystemDesignInput = {
  slug: "whatsapp",
  name: "WhatsApp / Messenger",
  tagline: "Bilhões de mensagens em tempo real por dia",
  description:
    "Cada celular mantém uma conexão WebSocket persistente com um servidor de chat. Um registro de sessão guarda a qual servidor cada usuário está conectado, de modo que uma mensagem pode ser armazenada, roteada para o servidor do destinatário por um barramento interno e enviada pelo socket em milissegundos. Se o destinatário estiver offline, a mensagem aguarda no banco de dados e uma notificação push acorda o celular dele.",
  category: "media-social",
  difficulty: 2,
  concepts: ["websockets", "consistent-hashing", "sharding", "presigned-urls", "idempotency", "multi-region"],

  requirements: {
    functional: [
      "Conversas individuais (1:1) e em grupo com entrega instantânea",
      "Histórico persistente, sincronizado entre os dispositivos do usuário",
      "Confirmações de enviado, entregue e lido; indicadores de digitação; presença online/visto por último",
      "Enviar fotos, vídeos, mensagens de voz e documentos",
      "Notificações push quando o app está fechado",
    ],
    nonFunctional: [
      "Entrega em menos de um segundo entre usuários online",
      "Nenhuma mensagem é perdida depois que o remetente vê um único check",
      "As mensagens aparecem na mesma ordem para todos em uma conversa",
      "Milhões de conexões simultâneas e bilhões de mensagens por dia",
      "Criptografia de ponta a ponta: os servidores retransmitem apenas texto cifrado (ciphertext)",
    ],
  },

  apis: [
    { method: "WS", path: "/socket → send(conversationId, clientMsgId, payload)", purpose: "Enviar uma mensagem pela conexão aberta; clientMsgId torna as novas tentativas idempotentes" },
    { method: "WS", path: "/socket ← message / ack / receipt / typing / presence", purpose: "O servidor envia novas mensagens, confirmações de entrega, recibos de leitura e mudanças de presença" },
    { method: "GET", path: "/conversations?cursor=", purpose: "Listar conversas com sua mensagem mais recente" },
    { method: "GET", path: "/conversations/{id}/messages?before=", purpose: "Carregar histórico mais antigo ao rolar para cima" },
    { method: "POST", path: "/conversations", purpose: "Criar um grupo e adicionar membros" },
    { method: "POST", path: "/media", purpose: "Obter uma URL pré-assinada (pre-signed URL) para enviar um anexo" },
  ],

  estimates: [
    { label: "Usuários ativos diários", value: "≈ 100 M", derivation: "Premissa: 10% de ~1 B de usuários registrados" },
    { label: "Mensagens", value: "≈ 2 B/dia (~23 k/s)", derivation: "100 M usuários × 20 mensagens ÷ 86.400 s; picos de 3–5×" },
    { label: "Armazenamento de mensagens", value: "≈ 1 TB/dia", derivation: "2 B × ~500 bytes incl. metadados, antes da replicação 3×" },
    { label: "Conexões simultâneas", value: "≈ 10 M", derivation: "Online no pico; ~50 k sockets por servidor → ~200 servidores de chat" },
    { label: "Largura de banda de texto", value: "≈ 12 MB/s", derivation: "23 k msg/s × 500 bytes; a mídia vai via storage e CDN" },
  ],

  dataModel: [
    {
      entity: "Message",
      store: "DB orientado a colunas (ex.: Cassandra)",
      key: "conversationId + messageId (ordenável por tempo)",
      fields: ["senderId", "ciphertext", "attachmentUrl", "createdAt"],
      why: "Somente adição (append-only), particionado por conversa para que o histórico seja uma única leitura sequencial (range scan)",
    },
    {
      entity: "Delivery status",
      store: "DB orientado a colunas",
      key: "messageId + recipientId",
      fields: ["deliveredAt", "readAt"],
      why: "Recibos por destinatário, especialmente em grupos",
    },
    {
      entity: "Conversation / Membership",
      store: "DB relacional",
      key: "conversationId + userId",
      fields: ["type (direct/group)", "name", "role", "lastReadMessageId"],
      why: "Pequeno, relacional, precisa de verificações consistentes de membros",
    },
    {
      entity: "Session",
      store: "Cache em memória",
      key: "userId + deviceId",
      fields: ["chatServerId", "connectedAt", "lastSeen"],
      why: "Consultado a cada mensagem para descobrir onde entregar; expira ao desconectar",
    },
    {
      entity: "User",
      store: "DB relacional",
      key: "userId",
      fields: ["phone", "name", "avatarUrl", "publicKeys"],
      why: "Dados da conta e chaves de criptografia",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Mantém um socket aberto, criptografa mensagens de ponta a ponta" },
    { id: "web", kind: "web-client", label: "Web / desktop", role: "Dispositivo vinculado que sincroniza com o celular" },
    { id: "chat-lb", kind: "load-balancer", label: "Load balancer de conexões", role: "Distribui conexões WebSocket de longa duração (L4)" },
    { id: "api-lb", kind: "load-balancer", label: "Load balancer de API", role: "Roteia requisições HTTPS de histórico, grupos e mídia" },
    { id: "chat-gw", kind: "realtime-gateway", label: "Servidores de chat", role: "Mantêm conexões de usuários; recebem, armazenam e enviam mensagens" },
    { id: "api-svc", kind: "service", label: "Serviço de API", role: "Login, lista de conversas, histórico, grupos" },
    { id: "notify-svc", kind: "service", label: "Notificador offline", role: "Envia um push quando o destinatário não está conectado" },
    { id: "bus", kind: "event-stream", label: "Barramento de mensagens", role: "Roteia mensagens entre servidores de chat" },
    { id: "sessions", kind: "cache", label: "Registro de sessões", role: "userId → servidor de chat, além de presença" },
    { id: "message-db", kind: "wide-column-db", label: "Banco de mensagens", role: "Todas as mensagens, particionadas por conversa" },
    { id: "user-db", kind: "relational-db", label: "Usuários e grupos", role: "Contas, conversas e membros" },
    { id: "media-store", kind: "object-storage", label: "Armazenamento de mídia", role: "Anexos criptografados" },
    { id: "cdn", kind: "cdn", label: "CDN de mídia", role: "Downloads de anexos populares" },
    { id: "push", kind: "notifications", label: "Notificações push", role: "Despertar dispositivos via APNs / FCM" },
  ],

  edges: [
    { id: "mobile-chat", from: "mobile", to: "chat-lb", label: "WebSocket", protocol: "ws" },
    { id: "web-chat", from: "web", to: "chat-lb", protocol: "ws" },
    { id: "chat-lb-gw", from: "chat-lb", to: "chat-gw", protocol: "ws" },
    { id: "mobile-api", from: "mobile", to: "api-lb", label: "HTTPS" },
    { id: "web-api", from: "web", to: "api-lb" },
    { id: "api-lb-svc", from: "api-lb", to: "api-svc" },
    { id: "gw-sessions", from: "chat-gw", to: "sessions", label: "Encontrar destinatário" },
    { id: "gw-store", from: "chat-gw", to: "message-db", label: "Persistir" },
    { id: "gw-bus", from: "chat-gw", to: "bus", label: "Rotear", protocol: "stream" },
    { id: "bus-gw", from: "bus", to: "chat-gw", label: "Entregar", protocol: "stream" },
    { id: "bus-notify", from: "bus", to: "notify-svc", label: "Offline", protocol: "async" },
    { id: "notify-push", from: "notify-svc", to: "push" },
    { id: "api-history", from: "api-svc", to: "message-db", label: "Histórico" },
    { id: "api-users", from: "api-svc", to: "user-db" },
    { id: "mobile-upload", from: "mobile", to: "media-store", label: "Upload (pré-assinado)" },
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Download" },
    { id: "cdn-origin", from: "cdn", to: "media-store" },
  ],

  flows: [
    {
      id: "online",
      name: "Mensagem para um amigo online",
      steps: [
        { edge: "mobile-chat", text: "O app da Alice envia a mensagem criptografada pelo socket aberto, identificada com um ID de mensagem do cliente." },
        { edge: "chat-lb-gw", text: "Ela chega ao servidor de chat que mantém a conexão da Alice." },
        { edge: "gw-store", text: "O servidor armazena a mensagem; Alice agora vê um check (enviada)." },
        { edge: "gw-sessions", text: "Ele consulta a qual servidor de chat o Bob está conectado." },
        { edge: "gw-bus", text: "A mensagem é publicada para o servidor do Bob." },
        { edge: "bus-gw", text: "O servidor do Bob envia a mensagem pelo socket dele. O app dele confirma (ack), e Alice vê dois checks (entregue)." },
      ],
    },
    {
      id: "offline",
      name: "Mensagem para um amigo offline",
      steps: [
        { edge: "mobile-chat", text: "Alice envia uma mensagem enquanto o celular do Bob está em modo de espera." },
        { edge: "chat-lb-gw", text: "Ela chega ao servidor de chat que mantém a conexão da Alice." },
        { edge: "gw-store", text: "Ela é armazenada de forma durável, para que nada se perca." },
        { edge: "gw-sessions", text: "O registro mostra que Bob não tem conexão ativa." },
        { edge: "gw-bus", text: "A mensagem é roteada como uma entrega offline." },
        { edge: "bus-notify", text: "O notificador offline a captura." },
        { edge: "notify-push", text: "Uma notificação push acorda o celular do Bob." },
        { edge: "mobile-api", text: "O app do Bob se reconecta e pede tudo o que perdeu." },
        { edge: "api-history", text: "As mensagens perdidas são lidas do banco, da mais recente para a mais antiga, e as confirmações voltam para a Alice." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Cada servidor de chat consegue manter apenas um número limitado de sockets abertos",
      fix: "Executar centenas de servidores com I/O assíncrono atrás de um balanceador L4; drenar conexões gradualmente nos deploys para evitar tempestades de reconexão.",
      nodes: ["chat-lb", "chat-gw"],
    },
    {
      problem: "O registro de sessões é consultado a cada mensagem",
      fix: "Fazer sharding por userId com consistent hashing, mantê-lo em memória e fazer cache das consultas recentes em cada servidor de chat.",
      nodes: ["sessions"],
    },
    {
      problem: "Bilhões de escritas por dia",
      fix: "Banco otimizado para escrita particionado por conversa; agrupar escritas em lote (batch); adicionar nós conforme o volume cresce.",
      nodes: ["message-db"],
    },
    {
      problem: "Grupos grandes multiplicam cada mensagem",
      fix: "Armazenar cada mensagem de grupo uma única vez e fazer fan-out apenas das notificações de entrega; limitar o tamanho dos grupos.",
      nodes: ["bus", "chat-gw"],
    },
  ],

  scaling: [
    "Fazer sharding de mensagens por conversationId e de usuários por userId.",
    "Replicar o banco de mensagens (fator de replicação 3) entre zonas; qualquer nó pode falhar sem perda de dados.",
    "Rotear usuários para a região mais próxima com geo-DNS; encaminhar mensagens entre regiões através do barramento.",
    "Manter os servidores de API stateless; apenas os servidores de chat mantêm estado de conexão, e esse estado é reconstruído na reconexão.",
    "Enviar mídia via object storage e CDN para que os servidores de chat trafeguem apenas pequenos payloads de texto.",
  ],

  extensions: [
    "Criptografia de ponta a ponta com chaves por dispositivo (protocolo Signal).",
    "Chamadas de voz e vídeo usando WebRTC com relays TURN.",
    "Busca de mensagens no próprio dispositivo (já que os servidores não podem ler o conteúdo).",
    "Mensagens temporárias com TTL no armazenamento.",
  ],
};
