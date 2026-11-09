import type { SystemDesignInput } from "@/types/schema";

export const googleMaps: SystemDesignInput = {
  slug: "google-maps",
  name: "Google Maps",
  tagline: "Tiles de mapa, busca de locais, cálculo de rotas e trânsito em tempo real",
  description:
    "Um mapa é majoritariamente estático: um pipeline offline renderiza o mundo em blocos (tiles) em todos os níveis de zoom, servidos a partir de uma CDN. Os locais são encontrados por meio de um índice de busca com suporte geográfico. O cálculo de rotas roda sobre um grafo viário pré-processado, com pesos de arestas atualizados pelo trânsito em tempo real calculado a partir de milhões de pings anônimos de GPS de celulares, e um modelo de ML transforma tudo isso em ETAs.",
  category: "mobility",
  difficulty: 3,
  concepts: ["geospatial-indexing", "caching", "sharding", "event-driven", "search-indexing"],

  requirements: {
    functional: [
      "Mover e aplicar zoom em um mapa do mundo",
      "Buscar locais e endereços (geocodificação) e fazer geocodificação reversa de um ponto",
      "Rotas de carro, transporte público, bicicleta ou a pé com ETA",
      "Navegação curva a curva (turn-by-turn) com trânsito ao vivo e recálculo de rota",
    ],
    nonFunctional: [
      "Tiles do mapa carregam instantaneamente em qualquer lugar",
      "Rotas em menos de um segundo, mesmo cruzando um continente",
      "O trânsito reflete a realidade em poucos minutos",
      "Os dados de localização são anonimizados",
    ],
  },

  apis: [
    { method: "GET", path: "/tiles/{z}/{x}/{y}", purpose: "Tile vetorial do mapa para o zoom z e posição x, y (em cache na CDN)" },
    { method: "GET", path: "/places/search?q=&near=", purpose: "Locais e endereços próximos a um ponto" },
    { method: "GET", path: "/geocode/reverse?lat=&lng=", purpose: "Endereço correspondente a um ponto" },
    { method: "POST", path: "/routes", purpose: "{ origin, destination, mode, departAt } → rotas com ETA" },
    { method: "POST", path: "/probes", purpose: "Pontos de GPS anônimos agrupados vindos de celulares em navegação" },
  ],

  estimates: [
    { label: "Usuários diários", value: "≈ 100 M", derivation: "Estimativa" },
    { label: "Requisições de tiles", value: "≈ 115 mil/s", derivation: "100 M de usuários × 5 visualizações de mapa × 20 tiles ÷ 86.400 s — quase tudo via CDN" },
    { label: "Requisições de rotas", value: "≈ 2–3 mil/s média", derivation: "100 M de usuários × 2 rotas ÷ 86.400 s" },
    { label: "Sondas de GPS", value: "≈ 2 M/s", derivation: "10 M de dispositivos navegando × um ponto a cada 5 s" },
    { label: "Armazenamento de tiles", value: "Dezenas de TB", derivation: "Tiles vetoriais para zoom 0–18 no mundo todo, mais imagens de satélite separadamente" },
  ],

  dataModel: [
    {
      entity: "Tile de mapa",
      store: "Object storage + CDN",
      key: "z/x/y",
      fields: ["roads", "labels", "buildings", "water"],
      why: "Pré-renderizado e imutável por versão — perfeito para cache",
    },
    {
      entity: "Segmento de via",
      store: "Banco de grafos, particionado por região",
      key: "segmentId",
      fields: ["fromNode", "toNode", "length", "speedLimit", "restrictions"],
      why: "O roteamento percorre este grafo; partições e atalhos tornam rotas longas rápidas",
    },
    {
      entity: "Velocidade em tempo real",
      store: "Cache em memória",
      key: "segmentId",
      fields: ["currentSpeed", "updatedAt", "confidence"],
      why: "Sobrescrita a cada minuto a partir da agregação das sondas de GPS",
    },
    {
      entity: "Local",
      store: "Índice de busca com campos geográficos",
      key: "placeId",
      fields: ["name", "category", "location", "address", "rating", "hours"],
      why: "Classificação por texto combinada com distância",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "App mobile", role: "Mapa, busca, navegação; envia GPS anônimo enquanto navega" },
    { id: "web", kind: "web-client", label: "App web", role: "Mapa, busca e rotas" },
    { id: "cdn", kind: "cdn", label: "CDN de tiles", role: "Serve tiles de mapa a partir da borda (edge)" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, cotas e roteamento" },
    { id: "places-svc", kind: "service", label: "Locais e geocodificação", role: "Busca textual com ranking por distância; geocodificação reversa" },
    { id: "routing-svc", kind: "service", label: "Motor de rotas", role: "Caminhos mínimos no grafo viário com pesos em tempo real" },
    { id: "eta", kind: "ml-platform", label: "Modelo de ETA", role: "Prevê o tempo de viagem com base em velocidades atuais e históricas" },
    { id: "probes", kind: "event-stream", label: "Stream de sondas GPS", role: "Pontos de localização anônimos" },
    { id: "traffic", kind: "stream-processor", label: "Agregação de trânsito", role: "Ajusta pontos às vias (map matching) e calcula velocidades atuais" },
    { id: "speeds", kind: "cache", label: "Velocidades ao vivo", role: "Velocidade atual por segmento de via" },
    { id: "road-graph", kind: "graph-db", label: "Grafo viário", role: "Malha viária particionada com atalhos pré-computados" },
    { id: "places-index", kind: "search", label: "Índice de locais", role: "Locais e endereços com campos geográficos" },
    { id: "tiles", kind: "object-storage", label: "Armazenamento de tiles", role: "Tiles vetoriais pré-renderizados" },
    { id: "map-pipeline", kind: "batch-processing", label: "Pipeline de dados do mapa", role: "Transforma dados brutos do mapa em tiles, grafo e índice" },
  ],

  edges: [
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Tiles" },
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "cdn-tiles", from: "cdn", to: "tiles", label: "Origem" },
    { id: "mobile-gateway", from: "mobile", to: "gateway", label: "Busca / rota" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "gateway-places", from: "gateway", to: "places-svc", protocol: "grpc" },
    { id: "places-index-read", from: "places-svc", to: "places-index" },
    { id: "gateway-routing", from: "gateway", to: "routing-svc", protocol: "grpc" },
    { id: "routing-graph", from: "routing-svc", to: "road-graph" },
    { id: "routing-speeds", from: "routing-svc", to: "speeds", label: "Pesos ao vivo" },
    { id: "routing-eta", from: "routing-svc", to: "eta", label: "ETA" },
    { id: "mobile-probes", from: "mobile", to: "probes", label: "GPS durante a navegação", protocol: "stream" },
    { id: "probes-traffic", from: "probes", to: "traffic", protocol: "stream" },
    { id: "traffic-speeds", from: "traffic", to: "speeds" },
    { id: "pipeline-tiles", from: "map-pipeline", to: "tiles", label: "Renderizar" },
    { id: "pipeline-graph", from: "map-pipeline", to: "road-graph", label: "Construir" },
    { id: "pipeline-index", from: "map-pipeline", to: "places-index", label: "Indexar" },
  ],

  flows: [
    {
      id: "view",
      name: "Abrir o mapa",
      steps: [
        { edge: "mobile-cdn", text: "O app calcula quais tiles cobrem a tela neste nível de zoom e os requisita." },
        { edge: "cdn-tiles", text: "Quase todos os tiles já estão na borda (edge); os mais raros são buscados uma única vez no armazenamento." },
      ],
    },
    {
      id: "route",
      name: "Obter rotas",
      steps: [
        { edge: "mobile-gateway", text: "O usuário busca um destino." },
        { edge: "gateway-places", text: "O serviço de locais processa a consulta." },
        { edge: "places-index-read", text: "Ele faz a correspondência do texto e classifica pela distância até o usuário." },
        { edge: "gateway-routing", text: "O usuário solicita a rota." },
        { edge: "routing-graph", text: "O motor pesquisa o grafo particionado, saltando longas distâncias por meio de atalhos pré-computados." },
        { edge: "routing-speeds", text: "Os pesos das arestas vêm das velocidades atuais, permitindo desviar de engarrafamentos." },
        { edge: "routing-eta", text: "O modelo de ETA ajusta o tempo usando padrões históricos para aquele horário do dia." },
      ],
    },
    {
      id: "traffic",
      name: "Trânsito em tempo real",
      steps: [
        { edge: "mobile-probes", text: "Celulares em navegação enviam lotes de pontos de GPS anonimizados." },
        { edge: "probes-traffic", text: "Os pontos são associados a segmentos de via e têm sua média calculada a cada minuto." },
        { edge: "traffic-speeds", text: "As velocidades atualizadas alimentam o cálculo de rotas e a camada visual vermelha/amarela/verde." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Bilhões de requisições de tiles",
      fix: "Pré-renderizar tiles imutáveis e versionados e servi-los a partir da CDN; os clientes também fazem cache local.",
      nodes: ["cdn", "tiles"],
    },
    {
      problem: "A busca simples de caminho mínimo é lenta demais em escala continental",
      fix: "Particionar o grafo e pré-computar atalhos (contraction hierarchies) para que as consultas toquem em poucos nós.",
      nodes: ["routing-svc", "road-graph"],
    },
    {
      problem: "Milhões de pontos de GPS por segundo",
      fix: "Agrupar em lotes no dispositivo, particionar o stream por região e agregar por segmento a cada minuto.",
      nodes: ["probes", "traffic"],
    },
  ],

  scaling: [
    "Particione o roteamento e o trânsito por região geográfica; a maioria das rotas permanece dentro de uma única região.",
    "Replique o índice de locais por região priorizando dados locais.",
    "Reconstrua os tiles e o grafo de forma incremental conforme os dados do mapa mudam.",
    "Mantenha as velocidades em tempo real na memória, com sharding por segmento.",
  ],

  extensions: [
    "Roteamento de transporte público com tabelas de horários.",
    "Mapas offline baixados por região.",
    "Imagens no nível da rua (Street View).",
    "Avaliações, fotos e horários de funcionamento de locais.",
  ],
};
