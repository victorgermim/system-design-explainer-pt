import type { SystemDesignInput } from "@/types/schema";

export const webrtc: SystemDesignInput = {
  slug: "webrtc",
  name: "Videochamadas (WebRTC)",
  tagline: "Chamadas 1:1 e em grupo com sinalização, TURN e SFUs",
  description:
    "Os servidores nunca misturam o vídeo. Um serviço de sinalização (sobre WebSockets) permite que os participantes troquem ofertas de conexão; a maioria das chamadas 1:1 se conecta ponto a ponto (peer-to-peer), com relays TURN para aquelas bloqueadas por firewalls. Chamadas em grupo enviam o stream de cada participante uma única vez para uma Selective Forwarding Unit (SFU), que o encaminha para todos os outros e pode bifurcar o fluxo para um pipeline de gravação.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["webrtc", "websockets", "multi-region", "horizontal-scaling"],

  requirements: {
    functional: [
      "Chamadas de áudio/vídeo 1:1 e em grupo em navegadores e apps",
      "Compartilhamento de tela e chat durante a chamada",
      "Entrar em salas por link com autenticação",
      "Gravação opcional",
    ],
    nonFunctional: [
      "Latência unidirecional abaixo de ~150 ms para uma conversa natural",
      "Funciona atrás de firewalls corporativos e NATs de redes móveis",
      "Adapta a qualidade à largura de banda de cada participante",
      "Mídia criptografada em trânsito",
    ],
  },

  apis: [
    { method: "POST", path: "/rooms", purpose: "Criar uma sala; retorna roomId e tokens de acesso" },
    { method: "WS", path: "/signal?room=&token=", purpose: "Trocar ofertas/respostas SDP e candidatos ICE" },
    { method: "GET", path: "/ice-servers", purpose: "Credenciais STUN/TURN de curta duração" },
    { method: "POST", path: "/rooms/{roomId}/recordings", purpose: "Iniciar gravação" },
  ],

  estimates: [
    { label: "Chamadas simultâneas", value: "≈ 100 k", derivation: "Premissa" },
    { label: "Proporção via relay", value: "≈ 20% das chamadas 1:1", derivation: "Fatia típica que não consegue conectar diretamente" },
    { label: "Tráfego de saída TURN", value: "≈ 60 Gbps", derivation: "100 k × 20% × 2 streams × 1,5 Mbps" },
    { label: "Fan-out da SFU", value: "N−1 streams de saída por stream de entrada", derivation: "Uma chamada de 10 pessoas envia cada stream para outras 9; o simulcast reduz a qualidade para miniaturas menores" },
  ],

  dataModel: [
    {
      entity: "Room",
      store: "Cache em memória",
      key: "roomId",
      fields: ["participants", "sfuNodeId", "createdAt", "recording"],
      why: "Estado de curta duração, lido em cada mensagem de sinalização",
    },
    {
      entity: "Recording",
      store: "Object storage",
      key: "roomId/recordingId",
      fields: ["mp4/webm", "duration"],
      why: "Arquivos de mídia grandes",
    },
  ],

  nodes: [
    { id: "caller", kind: "web-client", label: "Quem liga (navegador)", role: "Captura câmera/microfone, codifica e envia" },
    { id: "callee", kind: "mobile-client", label: "Quem recebe (app)", role: "O mesmo, em redes móveis" },
    { id: "signal", kind: "realtime-gateway", label: "Serviço de sinalização", role: "Retransmite ofertas, respostas e candidatos ICE" },
    { id: "identity", kind: "identity", label: "Autenticação", role: "Tokens de sala" },
    { id: "rooms", kind: "service", label: "Serviço de salas", role: "Cria salas, atribui uma SFU, emite credenciais TURN" },
    { id: "room-state", kind: "cache", label: "Estado da sala", role: "Participantes e servidor de mídia atribuído" },
    { id: "turn", kind: "webrtc-media", label: "Relays STUN / TURN", role: "Descoberta de NAT e relays para conexões bloqueadas" },
    { id: "sfu", kind: "webrtc-media", label: "Servidores de mídia SFU (Go)", role: "Encaminham cada stream para os demais participantes" },
    { id: "recorder", kind: "service", label: "Workers de gravação", role: "Mixam streams bifurcados em um arquivo (FFmpeg)" },
    { id: "recordings", kind: "object-storage", label: "Gravações", role: "Gravações finalizadas" },
    { id: "metrics", kind: "observability", label: "Métricas de qualidade de chamada", role: "Perda de pacotes, jitter, bitrate por chamada" },
  ],

  edges: [
    { id: "caller-signal", from: "caller", to: "signal", label: "Oferta, ICE", protocol: "ws" },
    { id: "callee-signal", from: "callee", to: "signal", label: "Resposta, ICE", protocol: "ws" },
    { id: "signal-identity", from: "signal", to: "identity", label: "Verificar token" },
    { id: "signal-rooms", from: "signal", to: "rooms", protocol: "grpc" },
    { id: "rooms-state", from: "rooms", to: "room-state" },
    { id: "caller-turn", from: "caller", to: "turn", label: "Mídia via relay" },
    { id: "callee-turn", from: "callee", to: "turn" },
    { id: "caller-sfu", from: "caller", to: "sfu", label: "Mídia em grupo" },
    { id: "callee-sfu", from: "callee", to: "sfu" },
    { id: "sfu-recorder", from: "sfu", to: "recorder", label: "Streams bifurcados", protocol: "stream" },
    { id: "recorder-store", from: "recorder", to: "recordings" },
    { id: "sfu-metrics", from: "sfu", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "one-to-one",
      name: "Iniciar uma chamada 1:1",
      steps: [
        { edge: "caller-signal", text: "Quem liga se conecta à sinalização e envia uma oferta SDP." },
        { edge: "signal-identity", text: "O token comprova que a pessoa pode entrar nesta sala." },
        { edge: "signal-rooms", text: "O serviço de salas registra a chamada e retorna credenciais TURN de curta duração." },
        { edge: "callee-signal", text: "Quem recebe a chamada obtém a oferta e responde com uma resposta SDP; ambos trocam candidatos ICE." },
        { edge: "caller-turn", text: "O STUN descobre os endereços públicos. A maioria das chamadas agora se conecta diretamente; caso contrário, a mídia flui através de um relay TURN." },
      ],
    },
    {
      id: "group",
      name: "Chamada em grupo com gravação",
      steps: [
        { edge: "signal-rooms", text: "Para mais de duas pessoas, o serviço de salas atribui uma SFU próxima aos participantes." },
        { edge: "rooms-state", text: "A atribuição é armazenada para que quem entrar depois use a mesma SFU." },
        { edge: "caller-sfu", text: "Cada participante envia seu stream uma única vez (em várias qualidades com simulcast)." },
        { edge: "callee-sfu", text: "A SFU encaminha a qualidade adequada de cada um dos outros streams para cada participante." },
        { edge: "sfu-recorder", text: "Quando a gravação começa, a SFU bifurca os streams para um worker de gravação." },
        { edge: "recorder-store", text: "O arquivo mixado é enviado para o armazenamento quando a chamada termina." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Custo de largura de banda do relay",
      fix: "Preferir conexões diretas; implantar TURN em muitas regiões e usar TURN sobre TLS na porta 443 apenas quando necessário.",
      nodes: ["turn"],
    },
    {
      problem: "Chamadas grandes sobrecarregam uma única SFU",
      fix: "Encadear SFUs em cascata (servidores encaminham uns para os outros) e limitar o vídeo de participantes que não estão falando.",
      nodes: ["sfu"],
    },
    {
      problem: "Redes ruins causam travamentos",
      fix: "Simulcast e controle de congestionamento permitem que a SFU mude cada espectador para uma camada de menor qualidade.",
      nodes: ["sfu", "metrics"],
    },
  ],

  scaling: [
    "Posicionar SFUs e servidores TURN em muitas regiões; escolher pela localização do participante.",
    "Manter a sinalização stateless com o estado da sala em um cache compartilhado.",
    "Fazer autoscaling das SFUs com base em largura de banda, não em CPU.",
  ],

  extensions: [
    "Legendas ao vivo usando speech-to-text no áudio bifurcado.",
    "Transmissão para grandes audiências convertendo para HLS.",
    "Criptografia de ponta a ponta com insertable streams.",
  ],
};
