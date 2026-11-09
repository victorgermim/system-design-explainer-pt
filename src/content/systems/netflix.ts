import type { SystemDesignInput } from "@/types/schema";

// A Netflix opera sua própria CDN independentemente da nuvem por trás dela.
const openConnect = { aws: "Open Connect", gcp: "Open Connect", azure: "Open Connect", oss: "Open Connect" };

export const netflix: SystemDesignInput = {
  slug: "netflix",
  name: "Netflix",
  tagline: "Streaming global de vídeo com microsserviços",
  description:
    "A Netflix se divide em dois mundos: um control plane de microsserviços stateless na nuvem que lida com login, navegação, recomendações e decisões de reprodução, e uma CDN dedicada (Open Connect) instalada dentro dos provedores de internet (ISPs) que entrega os bytes de vídeo de fato. O conteúdo dos estúdios é codificado uma única vez em centenas de streams e enviado para caches de borda (edge caches) antes mesmo de alguém apertar o play.",
  category: "media-social",
  difficulty: 3,
  concepts: ["adaptive-bitrate-streaming", "caching", "multi-region", "microservices", "event-driven", "sharding"],

  requirements: {
    functional: [
      "Cadastrar-se, gerenciar uma assinatura e manter vários perfis por conta",
      "Navegar e buscar no catálogo por título, gênero e pessoas",
      "Reproduzir, pausar, avançar/retroceder e retomar em qualquer dispositivo, continuando de onde outro dispositivo parou",
      "Qualidade adaptativa (de SD a 4K/HDR), múltiplas faixas de áudio e legendas",
      "Fileiras personalizadas na página inicial por perfil",
      "Baixar títulos para assistir offline onde o licenciamento permitir",
    ],
    nonFunctional: [
      "Início rápido de reprodução e quase nenhum rebuffering — a qualidade da experiência é a métrica principal",
      "Dezenas de milhões de streams simultâneos no horário de pico",
      "Sempre disponível: uma queda regional na nuvem não pode interromper a reprodução",
      "O conteúdo é protegido com DRM e exibido apenas nas regiões licenciadas",
      "Dados de navegação podem ter consistência eventual; cobrança e direitos de acesso (entitlements) não",
    ],
  },

  apis: [
    { method: "POST", path: "/auth/login", purpose: "Fazer login e obter um token de sessão" },
    { method: "GET", path: "/profiles/{profileId}/home", purpose: "Fileiras personalizadas de títulos para a tela inicial" },
    { method: "GET", path: "/titles/{titleId}", purpose: "Detalhes do título, episódios, faixas de áudio e legendas disponíveis" },
    { method: "GET", path: "/search?q=", purpose: "Buscar títulos, gêneros e pessoas" },
    { method: "POST", path: "/playback/{titleId}/start", purpose: "Verificar direitos de acesso, escolher servidores de borda, retornar URLs de manifesto e uma licença DRM" },
    { method: "PUT", path: "/profiles/{profileId}/progress", purpose: "Salvar a posição de retomada (enviada a cada poucos segundos durante a reprodução)" },
    { method: "GET", path: "/profiles/{profileId}/watchlist", purpose: "Minha Lista" },
  ],

  estimates: [
    { label: "Assinantes", value: "≈ 300 M", derivation: "Número público; assuma 100–150 M ativos diariamente" },
    { label: "Pico de streams simultâneos", value: "≈ 50–65 M", derivation: "Observado durante grandes eventos ao vivo" },
    {
      label: "Tráfego médio de saída de vídeo (egress)",
      value: "≈ 15 Tbps",
      derivation: "125 M horas assistidas/dia × 3.600 s × 3 Mbps ÷ 86.400 s; os picos são várias vezes maiores",
    },
    {
      label: "Streams codificados por título",
      value: "≈ 1.000+",
      derivation: "Codecs × resoluções × bitrates × variantes de áudio/legenda",
    },
    { label: "Armazenamento de vídeo", value: "10–100+ PB", derivation: "Arquivos master mais cada versão codificada, replicados" },
  ],

  dataModel: [
    {
      entity: "Account",
      store: "DB relacional (ex.: MySQL)",
      key: "accountId",
      fields: ["email", "passwordHash", "plan", "billingStatus", "country"],
      why: "Cobrança e direitos de acesso precisam de transações e consistência forte",
    },
    {
      entity: "Profile",
      store: "DB relacional",
      key: "profileId",
      fields: ["accountId", "name", "maturityRating", "language"],
      why: "Pequeno, relacional, lido em cada requisição",
    },
    {
      entity: "Title / Episode",
      store: "DB relacional + cache",
      key: "titleId",
      fields: ["name", "synopsis", "genres", "cast", "regionsLicensed", "artwork"],
      why: "Lido constantemente, muda raramente — ideal para uso intenso de cache",
    },
    {
      entity: "Viewing history",
      store: "DB orientado a colunas (ex.: Cassandra)",
      key: "profileId + timestamp",
      fields: ["titleId", "positionSec", "device", "durationWatched"],
      why: "Enorme volume de escrita vindo de atualizações de progresso, lido por perfil",
    },
    {
      entity: "Encoded asset",
      store: "Object storage",
      key: "titleId/codec/resolution/bitrate",
      fields: ["segments", "manifest", "subtitle files"],
      why: "Arquivos grandes e imutáveis, copiados para caches de borda",
    },
  ],

  nodes: [
    { id: "tv-client", kind: "web-client", label: "App de TV / web", role: "Navegar, buscar e reproduzir com um player adaptativo" },
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Streaming e downloads offline" },
    { id: "studio", kind: "web-client", label: "Parceiros de conteúdo", role: "Estúdios entregam arquivos master de alta qualidade" },
    { id: "open-connect", kind: "cdn", label: "Open Connect CDN", role: "Caches próprios da Netflix dentro dos ISPs que servem quase todos os bytes de vídeo", overrides: openConnect },
    { id: "gateway", kind: "api-gateway", label: "API gateway (Zuul)", role: "Roteamento de borda, autenticação e rate limiting" },
    { id: "auth", kind: "identity", label: "Serviço de autenticação", role: "Login, sessões e tokens de dispositivo" },
    { id: "playback-svc", kind: "service", label: "Serviço de reprodução", role: "Verifica direitos de acesso, escolhe os melhores servidores de borda e emite licenças DRM" },
    { id: "catalog-svc", kind: "service", label: "Serviço de catálogo", role: "Títulos, artes de capa e disponibilidade regional" },
    { id: "profile-svc", kind: "service", label: "Serviço de perfil e histórico", role: "Perfis, Minha Lista e posições de retomada" },
    { id: "recommend", kind: "ml-platform", label: "Recomendações", role: "Constrói fileiras personalizadas para cada perfil" },
    { id: "events", kind: "event-stream", label: "Pipeline de eventos (Keystone)", role: "Transporta eventos de play, pausa e navegação para analytics" },
    { id: "encoder", kind: "media-transcoder", label: "Pipeline de codificação", role: "Divide arquivos master em partes (chunks) e os codifica em paralelo" },
    { id: "account-db", kind: "relational-db", label: "DB de contas", role: "Contas, planos e cobrança" },
    { id: "catalog-db", kind: "relational-db", label: "DB de catálogo", role: "Metadados de títulos e episódios" },
    { id: "history-db", kind: "wide-column-db", label: "Histórico de visualização (Cassandra)", role: "O progresso de visualização de cada perfil" },
    { id: "cache", kind: "cache", label: "EVCache", role: "Cache distribuído para metadados, fileiras e sessões" },
    { id: "media-store", kind: "object-storage", label: "Armazenamento de mídia", role: "Arquivos master e cada versão codificada" },
    { id: "analytics", kind: "batch-processing", label: "Analytics em lote (batch)", role: "Agrega dados de visualização para treinar modelos" },
  ],

  edges: [
    { id: "tv-gateway", from: "tv-client", to: "gateway", label: "API" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "tv-cdn", from: "tv-client", to: "open-connect", label: "Segmentos de vídeo" },
    { id: "mobile-cdn", from: "mobile", to: "open-connect" },
    { id: "gateway-auth", from: "gateway", to: "auth", protocol: "grpc" },
    { id: "gateway-playback", from: "gateway", to: "playback-svc", protocol: "grpc" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "gateway-profile", from: "gateway", to: "profile-svc", protocol: "grpc" },
    { id: "gateway-recommend", from: "gateway", to: "recommend", label: "Fileiras da home", protocol: "grpc" },
    { id: "auth-accounts", from: "auth", to: "account-db" },
    { id: "playback-accounts", from: "playback-svc", to: "account-db", label: "Direitos de acesso" },
    { id: "playback-cdn", from: "playback-svc", to: "open-connect", label: "Escolher bordas" },
    { id: "catalog-cache", from: "catalog-svc", to: "cache" },
    { id: "catalog-db-read", from: "catalog-svc", to: "catalog-db" },
    { id: "profile-history", from: "profile-svc", to: "history-db", label: "Posição de retomada" },
    { id: "profile-events", from: "profile-svc", to: "events", label: "Eventos de reprodução", protocol: "stream" },
    { id: "events-analytics", from: "events", to: "analytics", protocol: "stream" },
    { id: "analytics-recommend", from: "analytics", to: "recommend", label: "Treinar modelos" },
    { id: "recommend-cache", from: "recommend", to: "cache", label: "Fileiras pré-computadas" },
    { id: "studio-store", from: "studio", to: "media-store", label: "Masters" },
    { id: "store-encoder", from: "media-store", to: "encoder", label: "Chunks", protocol: "async" },
    { id: "encoder-store", from: "encoder", to: "media-store", label: "Streams codificados" },
    { id: "cdn-fill", from: "open-connect", to: "media-store", label: "Abastecimento fora de pico" },
  ],

  flows: [
    {
      id: "play",
      name: "Apertar o play",
      steps: [
        { edge: "tv-gateway", text: "O player solicita o início da reprodução de um título." },
        { edge: "gateway-playback", text: "O gateway roteia a requisição para o serviço de reprodução." },
        { edge: "playback-accounts", text: "Ele verifica o plano, a licença da região e o número de streams ativos." },
        { edge: "playback-cdn", text: "Ele escolhe os servidores Open Connect próximos mais saudáveis que já possuem o título e retorna as URLs de manifesto mais uma licença DRM." },
        { edge: "tv-cdn", text: "O player faz streaming dos segmentos a partir do cache instalado no ISP, ajustando o bitrate conforme a largura de banda muda." },
        { edge: "gateway-profile", text: "A cada poucos segundos, o player informa sua posição." },
        { edge: "profile-history", text: "A posição de retomada é salva para que outro dispositivo possa continuar." },
        { edge: "profile-events", text: "Os eventos de reprodução vão para o pipeline de eventos para analytics." },
      ],
    },
    {
      id: "home",
      name: "Carregar a página inicial",
      steps: [
        { edge: "tv-gateway", text: "O app solicita a tela inicial para o perfil ativo." },
        { edge: "gateway-recommend", text: "O serviço de recomendação monta fileiras personalizadas." },
        { edge: "recommend-cache", text: "As fileiras foram pré-computadas offline e são lidas do cache." },
        { edge: "gateway-catalog", text: "As artes de capa e os detalhes dos títulos são buscados para cada fileira." },
        { edge: "catalog-cache", text: "Quase todas as leituras de catálogo são cache hits." },
      ],
    },
    {
      id: "ingest",
      name: "Adicionar um novo título",
      steps: [
        { edge: "studio-store", text: "Um estúdio entrega o arquivo master, que passa por verificação de qualidade." },
        { edge: "store-encoder", text: "O master é dividido em chunks e enfileirado para codificação." },
        { edge: "encoder-store", text: "Workers codificam cada chunk em cada codec, resolução e bitrate em paralelo." },
        { edge: "cdn-fill", text: "Durante os horários fora de pico, os caches de borda baixam o novo título, para que ele já esteja local no dia do lançamento." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Codificar um título 4K/HDR em ~1.000 streams exige um poder computacional enorme",
      fix: "Dividir os arquivos master em chunks e codificá-los em paralelo em uma frota de workers com autoscaling; tentar novamente apenas os chunks que falharem.",
      nodes: ["encoder", "media-store"],
    },
    {
      problem: "Terabits por segundo de vídeo podem saturar os backbones da internet",
      fix: "Instalar caches dentro das redes dos ISPs e abastecê-los fora do horário de pico, para que o tráfego de pico nunca saia do ISP.",
      nodes: ["open-connect"],
    },
    {
      problem: "Um grande lançamento estreia para milhões de pessoas no mesmo minuto",
      fix: "Pré-posicionar o título nas bordas antes do lançamento e servir metadados a partir do cache para que o control plane receba pouca carga extra.",
      nodes: ["open-connect", "cache", "catalog-svc"],
    },
    {
      problem: "Atualizações constantes de progresso inundam o banco de histórico",
      fix: "Usar um banco orientado a colunas otimizado para escrita, particionado por perfil, e agrupar em lote (batch) ou amostrar eventos enviados para analytics.",
      nodes: ["history-db", "events"],
    },
    {
      problem: "Um microsserviço com falha derrubando os demais",
      fix: "Timeouts, circuit breakers e fallbacks (ex.: mostrar fileiras genéricas se as recomendações falharem); testar com chaos engineering.",
      nodes: ["gateway", "recommend"],
    },
  ],

  scaling: [
    "Executar o control plane em modo ativo-ativo em várias regiões de nuvem; desviar o tráfego de uma região com falha.",
    "Manter todos os serviços stateless atrás do gateway para que possam fazer autoscaling.",
    "Fazer sharding do histórico de visualização por perfil e replicá-lo entre data centers com consistência ajustável.",
    "Replicar contas no DB relacional entre zonas com failover automático.",
    "Fazer cache de tudo que tem leitura intensa (catálogo, fileiras, sessões) e replicar o cache entre zonas.",
    "Expandir a CDN adicionando equipamentos (appliances) nos ISPs e pontos de troca de tráfego (IXPs) em vez de escalar a origem.",
  ],

  extensions: [
    "DRM com Widevine, FairPlay e PlayReady, além de verificações de licença por região.",
    "Downloads offline com licenças que expiram.",
    "Artes de capa personalizadas escolhidas por testes A/B por perfil.",
    "Eventos ao vivo, que não podem ser pré-posicionados e precisam de streaming de baixa latência.",
    "Codificação por título e por cena para reduzir o consumo de banda sem perder qualidade.",
  ],
};
