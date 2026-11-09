import type { SystemDesignInput } from "@/types/schema";

export const websocketScale: SystemDesignInput = {
  slug: "websocket-scale",
  name: "WebSockets em escala",
  tagline: "Milhões de conexões ativas com Go no Kubernetes",
  description:
    "Uma camada de tempo real reutilizável: pods de gateway leves em Go mantêm milhões de conexões WebSocket atrás de um load balancer L4. Os serviços de backend publicam eventos em um barramento durável; um roteador consulta a qual pod de gateway cada destinatário está conectado e encaminha o evento por um canal pub/sub específico do pod, que o envia pelo socket. Eventos de destinatários offline são armazenados para quando eles se reconectarem.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["websockets", "consistent-hashing", "back-pressure", "event-driven", "horizontal-scaling"],

  requirements: {
    functional: [
      "Os clientes mantêm uma conexão persistente e recebem eventos em tempo real",
      "Os serviços de backend podem enviar para um usuário, um grupo (sala) ou todos",
      "Presença: saber quem está online",
      "Entregar eventos perdidos após uma reconexão",
    ],
    nonFunctional: [
      "Milhões de conexões simultâneas",
      "Latência de entrega abaixo de ~100 ms",
      "Pods de gateway podem ser adicionados, removidos ou reiniciados sem perder eventos",
      "O uso de memória por conexão permanece baixo",
    ],
  },

  apis: [
    { method: "WS", path: "/connect?token=", purpose: "Abrir uma conexão; o token é verificado uma vez ao conectar" },
    { method: "WS", path: "← event { type, payload, seq }", purpose: "Push do servidor; clientes confirmam (ack) pelo número de sequência" },
    { method: "POST", path: "/internal/publish", purpose: "Backends publicam { recipients | room, event } no barramento" },
    { method: "GET", path: "/internal/presence/{userId}", purpose: "Status online e dispositivos conectados" },
  ],

  estimates: [
    { label: "Conexões simultâneas", value: "≈ 10 M", derivation: "Premissa" },
    { label: "Conexões por pod", value: "≈ 50–100 k", derivation: "~10–20 KB por conexão em Go → 1–2 GB de RAM por 100 k" },
    { label: "Pods de gateway", value: "≈ 100–200", derivation: "10 M ÷ 50–100 k, com folga para failover" },
    { label: "Heartbeats", value: "≈ 330 k/s", derivation: "10 M conexões ÷ um ping a cada 30 s" },
  ],

  dataModel: [
    {
      entity: "Connection",
      store: "Registro em memória",
      key: "userId + deviceId",
      fields: ["podId", "connectedAt", "lastSeen"],
      why: "O roteamento precisa saber 'qual pod mantém este usuário?' em uma única consulta",
    },
    {
      entity: "Room membership",
      store: "Registro em memória",
      key: "roomId",
      fields: ["set of userIds"],
      why: "Fan-out para grupos",
    },
    {
      entity: "Pending event",
      store: "DB chave-valor com TTL",
      key: "userId + seq",
      fields: ["payload", "createdAt"],
      why: "Reenviar (replay) para clientes que estavam offline",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "Clientes mobile", role: "Mantêm uma conexão cada" },
    { id: "web", kind: "web-client", label: "Clientes web", role: "Mantêm uma conexão por aba" },
    { id: "nlb", kind: "load-balancer", label: "Load balancer L4", role: "Distribui conexões TCP de longa duração entre os pods" },
    { id: "gateway", kind: "realtime-gateway", label: "Pods de gateway (Go)", role: "Mantêm sockets, verificam tokens, enviam eventos" },
    { id: "identity", kind: "identity", label: "Validação de token", role: "Emite e verifica JWTs" },
    { id: "registry", kind: "cache", label: "Registro de conexões", role: "userId → pod, salas e presença" },
    { id: "backends", kind: "service", label: "Serviços de backend", role: "Chat, notificações, placares ao vivo…" },
    { id: "bus", kind: "event-stream", label: "Barramento de eventos", role: "Stream durável e ordenado de eventos de saída" },
    { id: "router", kind: "service", label: "Roteador de fan-out", role: "Resolve destinatários para seus respectivos pods" },
    { id: "pubsub", kind: "message-queue", label: "Canais por pod", role: "Pub/sub de baixa latência para cada pod de gateway" },
    { id: "pending", kind: "nosql-db", label: "Eventos pendentes", role: "Eventos para usuários offline" },
    { id: "metrics", kind: "observability", label: "Métricas", role: "Conexões, atraso (lag) e quedas por pod" },
  ],

  edges: [
    { id: "mobile-nlb", from: "mobile", to: "nlb", protocol: "ws" },
    { id: "web-nlb", from: "web", to: "nlb", protocol: "ws" },
    { id: "nlb-gateway", from: "nlb", to: "gateway", protocol: "ws" },
    { id: "gateway-identity", from: "gateway", to: "identity", label: "Verificar token" },
    { id: "gateway-registry", from: "gateway", to: "registry", label: "Registrar / heartbeat" },
    { id: "backends-bus", from: "backends", to: "bus", label: "Publicar", protocol: "stream" },
    { id: "bus-router", from: "bus", to: "router", protocol: "async" },
    { id: "router-registry", from: "router", to: "registry", label: "Onde está o usuário?" },
    { id: "router-pubsub", from: "router", to: "pubsub", label: "Para o canal do pod" },
    { id: "pubsub-gateway", from: "pubsub", to: "gateway", label: "Entregar", protocol: "stream" },
    { id: "router-pending", from: "router", to: "pending", label: "Offline" },
    { id: "gateway-pending", from: "gateway", to: "pending", label: "Replay ao reconectar" },
    { id: "gateway-metrics", from: "gateway", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "connect",
      name: "Conectar",
      steps: [
        { edge: "mobile-nlb", text: "O app abre um WebSocket com seu token." },
        { edge: "nlb-gateway", text: "O balanceador L4 escolhe um pod de gateway com capacidade livre." },
        { edge: "gateway-identity", text: "O pod verifica o token uma única vez." },
        { edge: "gateway-registry", text: "Ele registra userId → este pod, e mantém o registro atualizado com heartbeats." },
        { edge: "gateway-pending", text: "Quaisquer eventos perdidos enquanto estava offline são reenviados em ordem." },
      ],
    },
    {
      id: "deliver",
      name: "Entregar um evento",
      steps: [
        { edge: "backends-bus", text: "Um backend publica um evento para um usuário ou sala." },
        { edge: "bus-router", text: "Workers roteadores consomem o barramento (particionado para que os eventos de cada usuário permaneçam em ordem)." },
        { edge: "router-registry", text: "Eles consultam quais pods mantêm as conexões dos destinatários." },
        { edge: "router-pubsub", text: "O evento vai para o canal de cada pod." },
        { edge: "pubsub-gateway", text: "O pod escreve nos sockets; os clientes confirmam pelo número de sequência." },
        { edge: "router-pending", text: "Destinatários sem conexão ativa têm o evento armazenado para mais tarde." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Memória por conexão",
      fix: "Goroutines leves do Go somadas a buffers pequenos; leitores estilo epoll para pods muito grandes.",
      nodes: ["gateway"],
    },
    {
      problem: "Tempestades de reconexão após um deploy ou falha",
      fix: "Drenar pods gradualmente, adicionar backoff com jitter no cliente e fazer autoscaling antes do rollout.",
      nodes: ["gateway", "nlb"],
    },
    {
      problem: "Clientes lentos travando o pod",
      fix: "Filas de envio limitadas por conexão; descartar mensagens ou desconectar clientes que ficarem muito atrasados.",
      nodes: ["gateway", "pubsub"],
    },
    {
      problem: "Broadcast para milhões",
      fix: "Enviar uma vez por pod, não por usuário, e deixar cada pod fazer o fan-out localmente.",
      nodes: ["router", "pubsub"],
    },
  ],

  scaling: [
    "Fazer autoscaling dos pods de gateway com base no número de conexões e uso de CPU.",
    "Fazer sharding do registro com consistent hashing; as entradas expiram se os heartbeats pararem.",
    "Particionar o barramento por destinatário para manter a ordenação por usuário.",
    "Implantar por região e encaminhar eventos entre regiões através do barramento.",
  ],

  extensions: [
    "Fallback para Server-Sent Events em redes restritivas.",
    "Rate limits por tenant na publicação.",
    "Confirmações de entrega de ponta a ponta expostas para os backends.",
  ],
};
