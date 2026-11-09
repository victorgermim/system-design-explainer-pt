import type { SystemDesignInput } from "@/types/schema";

export const youtube: SystemDesignInput = {
  slug: "youtube",
  name: "YouTube",
  tagline: "Upload, transcodificação e streaming global de vídeo",
  description:
    "Criadores fazem upload de grandes arquivos de vídeo que são transcodificados em várias resoluções e distribuídos mundialmente através de uma CDN com streaming de bitrate adaptativo (adaptive bitrate streaming). Metadados, engajamento e busca rodam em serviços escalados separadamente, e quase cada byte assistido vem de um cache de borda (edge cache) em vez da origem.",
  category: "media-social",
  difficulty: 3,
  concepts: ["adaptive-bitrate-streaming", "presigned-urls", "back-pressure", "caching", "sharding", "search-indexing", "change-data-capture"],

  requirements: {
    functional: [
      "Fazer upload de vídeos com título, descrição e tags; os uploads devem sobreviver a conexões instáveis",
      "Transmitir vídeos suavemente em qualquer dispositivo e velocidade de rede",
      "Curtir/descurtir, comentar e compartilhar vídeos",
      "Buscar vídeos por título, tags e descrição",
      "Inscrever-se em canais e receber notificações sobre novos uploads",
      "Mostrar miniaturas (thumbnails) e um feed inicial personalizado (pode vir depois do MVP)",
    ],
    nonFunctional: [
      "Alta disponibilidade: assistir deve continuar funcionando mesmo quando uploads ou comentários estiverem degradados",
      "Baixa latência de início de reprodução e mínimo de buffering em todo o mundo",
      "Armazenamento durável: um vídeo enviado nunca é perdido",
      "Consistência eventual é aceitável para contagens de visualizações, curtidas e exibição de novos uploads",
      "Leitura intensa: visualizações superam uploads em várias ordens de grandeza",
    ],
  },

  apis: [
    { method: "POST", path: "/videos", purpose: "Iniciar um upload retomável; retorna um videoId e URLs de upload para cada parte (chunk)" },
    { method: "GET", path: "/videos/{videoId}", purpose: "Metadados do vídeo mais a URL do manifesto HLS/DASH na CDN" },
    { method: "POST", path: "/videos/{videoId}/like", purpose: "Registrar uma curtida ou descurtida para o usuário atual (idempotente)" },
    { method: "GET", path: "/videos/{videoId}/comments?cursor=", purpose: "Paginar comentários, os mais recentes primeiro" },
    { method: "POST", path: "/videos/{videoId}/comments", purpose: "Adicionar um comentário" },
    { method: "GET", path: "/search?q=&cursor=", purpose: "Resultados de busca ranqueados" },
    { method: "POST", path: "/channels/{channelId}/subscribe", purpose: "Seguir um criador" },
    { method: "GET", path: "/feed", purpose: "Recomendações personalizadas para o usuário autenticado" },
  ],

  estimates: [
    { label: "Usuários ativos diários", value: "≈ 500 M", derivation: "Premissa baseada em números públicos" },
    {
      label: "Vídeo enviado por dia",
      value: "≈ 43 M minutos",
      derivation: "500 horas/min × 60 min × 60 × 24 ≈ 43 M min/dia",
    },
    {
      label: "Novo armazenamento por dia",
      value: "≈ 250 TB (uma versão)",
      derivation: "43 M min × ~6 MB/min; multiplique pelo número de versões (renditions) mantidas",
    },
    {
      label: "Requisições de API",
      value: "≈ 30 k/s média, ~90 k/s pico",
      derivation: "500 M usuários × 5 requisições ÷ 86.400 s; pico ≈ 3× a média",
    },
    {
      label: "Tráfego de saída de vídeo (egress)",
      value: "≈ 30 PB/dia (~2,8 Tbps)",
      derivation: "500 M usuários × 10 min × 6 MB/min; ÷ 86.400 s para a largura de banda média",
    },
  ],

  dataModel: [
    {
      entity: "Video",
      store: "DB orientado a colunas (ex.: Bigtable)",
      key: "videoId",
      fields: ["ownerId", "title", "description", "tags", "status", "renditions[]", "thumbnailUrl", "durationSec", "uploadedAt"],
      why: "Lido em cada visualização; precisa de buscas rápidas por chave em enorme escala",
    },
    {
      entity: "Comment",
      store: "DB orientado a colunas",
      key: "videoId + commentId (ordenado por tempo)",
      fields: ["userId", "text", "createdAt", "parentId"],
      why: "Forte em adições (append-heavy), lido em ordem cronológica por vídeo",
    },
    {
      entity: "Like",
      store: "DB chave-valor + contadores em cache",
      key: "videoId + userId",
      fields: ["value (+1/-1)", "createdAt"],
      why: "Um voto por usuário; os totais são mantidos como contadores, não contados na leitura",
    },
    {
      entity: "Subscription",
      store: "DB chave-valor",
      key: "subscriberId + channelId",
      fields: ["createdAt", "notify"],
      why: "Consultado nas duas direções: 'minhas inscrições' e fan-out para inscritos",
    },
    {
      entity: "Video file",
      store: "Object storage",
      key: "videoId/rendition/segment",
      fields: ["raw upload", "encoded segments", "manifest", "thumbnails"],
      why: "Blobs baratos e duráveis; o banco de dados armazena apenas suas URLs",
    },
  ],

  nodes: [
    { id: "web-client", kind: "web-client", label: "App web / TV", role: "Navegar, buscar e reproduzir vídeos com um player adaptativo" },
    { id: "mobile-client", kind: "mobile-client", label: "App mobile", role: "Assistir, fazer upload da galeria, receber notificações" },
    { id: "cdn", kind: "cdn", label: "CDN de vídeo", role: "Entrega manifestos e segmentos de vídeo a partir de caches de borda próximos aos espectadores" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Distribui tráfego de API e upload entre instâncias saudáveis" },
    { id: "api", kind: "api-gateway", label: "API gateway", role: "Autentica usuários, aplica rate limit e roteia para os serviços" },
    { id: "upload-svc", kind: "service", label: "Serviço de upload", role: "Aceita uploads retomáveis em chunks e enfileira jobs de transcodificação" },
    { id: "video-svc", kind: "service", label: "Serviço de vídeo", role: "Metadados de vídeo, manifestos de reprodução, contagem de visualizações" },
    { id: "engagement-svc", kind: "service", label: "Serviço de engajamento", role: "Curtidas, comentários e inscrições" },
    { id: "search-svc", kind: "service", label: "Serviço de busca", role: "Consulta o índice de busca e ranqueia os resultados" },
    { id: "transcode-queue", kind: "event-stream", label: "Jobs de transcodificação", role: "Armazena em buffer novos uploads para que picos apenas aumentem a fila" },
    { id: "transcoder", kind: "media-transcoder", label: "Workers de transcodificação", role: "Codificam versões de 240p a 4K e segmentos HLS/DASH em paralelo" },
    { id: "video-store", kind: "object-storage", label: "Armazenamento de vídeo", role: "Uploads brutos, segmentos codificados e miniaturas" },
    { id: "metadata-db", kind: "wide-column-db", label: "DB de metadados", role: "Vídeos, comentários e curtidas, particionados por videoId" },
    { id: "cache", kind: "cache", label: "Cache de metadados quentes", role: "Metadados de vídeos populares e contadores de visualizações/curtidas" },
    { id: "search-index", kind: "search", label: "Índice de busca", role: "Índice full-text sobre títulos, descrições e tags" },
    { id: "recommend", kind: "ml-platform", label: "Recomendações", role: "Ranqueia o feed inicial e vídeos relacionados a partir do histórico de visualização" },
  ],

  edges: [
    { id: "web-cdn", from: "web-client", to: "cdn", label: "Segmentos" },
    { id: "mobile-cdn", from: "mobile-client", to: "cdn" },
    { id: "web-lb", from: "web-client", to: "lb", label: "API / upload" },
    { id: "mobile-lb", from: "mobile-client", to: "lb" },
    { id: "lb-api", from: "lb", to: "api" },
    { id: "api-upload", from: "api", to: "upload-svc", protocol: "grpc" },
    { id: "api-video", from: "api", to: "video-svc", protocol: "grpc" },
    { id: "api-engagement", from: "api", to: "engagement-svc", protocol: "grpc" },
    { id: "api-search", from: "api", to: "search-svc", protocol: "grpc" },
    { id: "upload-store", from: "upload-svc", to: "video-store", label: "Chunks brutos" },
    { id: "upload-queue", from: "upload-svc", to: "transcode-queue", label: "Job", protocol: "async" },
    { id: "queue-transcoder", from: "transcode-queue", to: "transcoder", protocol: "async" },
    { id: "transcoder-store", from: "transcoder", to: "video-store", label: "Versões" },
    { id: "transcoder-meta", from: "transcoder", to: "metadata-db", label: "Marcar como pronto" },
    { id: "video-cache", from: "video-svc", to: "cache" },
    { id: "video-meta", from: "video-svc", to: "metadata-db" },
    { id: "video-recommend", from: "video-svc", to: "recommend", label: "Relacionados" },
    { id: "engagement-cache", from: "engagement-svc", to: "cache", label: "Contadores" },
    { id: "engagement-meta", from: "engagement-svc", to: "metadata-db" },
    { id: "search-index-read", from: "search-svc", to: "search-index" },
    { id: "meta-index", from: "metadata-db", to: "search-index", label: "Atualizações de índice", protocol: "cdc" },
    { id: "cdn-origin", from: "cdn", to: "video-store", label: "Busca na origem" },
    { id: "recommend-meta", from: "recommend", to: "metadata-db", label: "Histórico de visualização" },
  ],

  flows: [
    {
      id: "upload",
      name: "Fazer upload de um vídeo",
      steps: [
        { edge: "web-lb", text: "O app solicita o início de um upload e recebe um videoId." },
        { edge: "lb-api", text: "O gateway verifica o token do usuário e a cota de upload." },
        { edge: "api-upload", text: "O serviço de upload rastreia cada chunk para que uma conexão interrompida possa ser retomada." },
        { edge: "upload-store", text: "Os chunks brutos são gravados diretamente no object storage." },
        { edge: "upload-queue", text: "Assim que todos os chunks chegam, um job de transcodificação é publicado." },
        { edge: "queue-transcoder", text: "Um worker livre pega o job; mais workers são iniciados se a fila crescer." },
        { edge: "transcoder-store", text: "Cada resolução é codificada em segmentos HLS/DASH e armazenada." },
        { edge: "transcoder-meta", text: "O vídeo é marcado como pronto com as URLs de suas versões." },
        { edge: "meta-index", text: "O novo vídeo flui para o índice de busca." },
      ],
    },
    {
      id: "watch",
      name: "Assistir a um vídeo",
      steps: [
        { edge: "web-lb", text: "O player solicita a página do vídeo." },
        { edge: "lb-api", text: "A requisição é roteada para o serviço de vídeo." },
        { edge: "api-video", text: "O serviço de vídeo monta a resposta." },
        { edge: "video-cache", text: "Os metadados de vídeos populares são servidos a partir do cache…" },
        { edge: "video-meta", text: "…caso contrário, são lidos do DB de metadados e colocados em cache." },
        { edge: "web-cdn", text: "O player busca o manifesto e os segmentos na borda mais próxima, alternando o bitrate conforme a largura de banda muda." },
        { edge: "cdn-origin", text: "Em caso de cache miss, a borda puxa os segmentos do armazenamento uma única vez e depois serve a todos por perto." },
      ],
    },
    {
      id: "search",
      name: "Buscar",
      steps: [
        { edge: "web-lb", text: "O usuário envia uma consulta." },
        { edge: "lb-api", text: "O gateway a roteia para a busca." },
        { edge: "api-search", text: "O serviço de busca analisa a consulta e aplica filtros." },
        { edge: "search-index-read", text: "O índice retorna correspondências ranqueadas por título, tags e descrição." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "A transcodificação exige muita CPU e os uploads chegam em rajadas",
      fix: "Enfileirar jobs e fazer autoscaling de um pool de workers stateless (instâncias GPU para 4K); dividir vídeos longos em chunks codificados em paralelo.",
      nodes: ["transcode-queue", "transcoder"],
    },
    {
      problem: "Vídeos virais criam hot keys nos metadados e contadores",
      fix: "Servir metadados quentes a partir do cache, contar visualizações e curtidas em cache e descarregá-las (flush) no DB em lotes.",
      nodes: ["cache", "metadata-db"],
    },
    {
      problem: "Largura de banda de saída (egress) na escala de Tbps",
      fix: "Empurrar quase todos os bytes pela CDN; pré-aquecer bordas para sucessos esperados e fazer fallback para a próxima borda ou origem.",
      nodes: ["cdn", "video-store"],
    },
    {
      problem: "Um serviço lento gerando efeito cascata nos outros",
      fix: "Manter serviços stateless e com autoscaling, adicionar timeouts, circuit breakers e rate limits no gateway.",
      nodes: ["api", "video-svc", "engagement-svc"],
    },
  ],

  scaling: [
    "Fazer sharding de metadados por videoId e de comentários por videoId para que a carga se espalhe por muitos nós.",
    "Usar réplicas de leitura e um cluster de busca separado para consultas de leitura intensa.",
    "Rotear usuários para a região mais próxima com geo-DNS; cada região tem seus próprios load balancers e pools de serviços.",
    "Manter serviços stateless para que instâncias possam ser adicionadas livremente; o estado vive nos bancos de dados e no cache.",
    "Replicar arquivos de vídeo e metadados entre regiões para recuperação de desastres.",
    "Desacoplar tudo o que é lento (transcodificação, notificações, indexação) com filas para que picos apenas adicionem atraso.",
  ],

  extensions: [
    "Recomendações: pipelines em lote (batch) e de streaming sobre o histórico de visualização alimentam um modelo que ranqueia o feed inicial.",
    "Notificações de inscrição: publicar um evento por upload e fazer fan-out para os inscritos através de uma fila.",
    "Busca aprimorada: autocompletar, filtros e indexação de transcrições geradas automaticamente.",
    "Comentários em threads com filtro de spam e atualizações ao vivo via WebSockets.",
    "Transmissão ao vivo (live streaming): ingestão via RTMP/SRT, transcodificação em tempo real e envio para as bordas com HLS de baixa latência; adicionar chat ao vivo.",
  ],
};
