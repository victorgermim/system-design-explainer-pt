import type { SystemDesignInput } from "@/types/schema";

export const airbnb: SystemDesignInput = {
  slug: "airbnb",
  name: "Airbnb",
  tagline: "Busca, reserva e mensagens para aluguéis de temporada",
  description:
    "A busca combina um índice geoespacial de anúncios com o calendário de disponibilidade de cada um, de modo que os resultados mostram apenas locais livres nas suas datas. A reserva bloqueia essas noites com uma escrita condicional no calendário, autoriza o pagamento e repassa o valor ao anfitrião após o check-in. Hóspedes e anfitriões trocam mensagens em tempo real, e as fotos são servidas por uma CDN.",
  category: "bookings",
  difficulty: 3,
  concepts: ["geospatial-indexing", "search-indexing", "distributed-locks", "idempotency", "caching", "presigned-urls"],

  requirements: {
    functional: [
      "Anfitriões criam anúncios com fotos, preços, regras e um calendário de disponibilidade",
      "Hóspedes buscam por local, datas, número de hóspedes, preço e comodidades, em um mapa",
      "Reserva instantânea ou solicitação de reserva com aprovação do anfitrião",
      "Pagamentos retidos até o check-in e depois repassados ao anfitrião",
      "Mensagens entre hóspede e anfitrião e avaliações nos dois sentidos",
    ],
    nonFunctional: [
      "Nunca reservar as mesmas noites duas vezes (overbooking)",
      "A busca responde em menos de um segundo",
      "Alta disponibilidade para navegação; a reserva pode ser estritamente consistente",
      "Pagamentos e repasses em várias moedas",
    ],
  },

  apis: [
    { method: "GET", path: "/search?bbox=&checkIn=&checkOut=&guests=&filters=", purpose: "Anúncios disponíveis em uma área do mapa" },
    { method: "GET", path: "/listings/{id}", purpose: "Detalhes do anúncio, fotos, regras e preço para as datas" },
    { method: "POST", path: "/reservations", purpose: "Reserva as datas (Idempotency-Key); instantânea ou pendente de aprovação do anfitrião" },
    { method: "PUT", path: "/listings/{id}/calendar", purpose: "Anfitrião bloqueia datas ou altera preços" },
    { method: "WS", path: "/messages", purpose: "Mensagens em tempo real entre hóspede e anfitrião" },
  ],

  estimates: [
    { label: "Anúncios", value: "≈ 7 M", derivation: "Suposição baseada em números públicos" },
    { label: "Buscas", value: "≈ 2–5 mil/s no pico", derivation: "Navegação com muitas leituras" },
    { label: "Noites de calendário", value: "≈ 2,5 bi de linhas", derivation: "7 M de anúncios × 365 dias à frente" },
    { label: "Reservas", value: "≈ 1–2 M/dia", derivation: "Suposição; ~20/s em média" },
  ],

  dataModel: [
    {
      entity: "Anúncio",
      store: "Banco relacional + índice de busca",
      key: "listingId",
      fields: ["hostId", "location", "type", "amenities", "basePrice", "rules", "photoUrls"],
      why: "Editado por anfitriões, pesquisado por hóspedes",
    },
    {
      entity: "Noite do calendário",
      store: "Banco relacional, sharding por listingId",
      key: "listingId + date",
      fields: ["status (open/blocked/booked)", "price", "reservationId"],
      why: "Reservar = atualização condicional de um intervalo de noites em uma única transação",
    },
    {
      entity: "Reserva",
      store: "Banco relacional",
      key: "reservationId",
      fields: ["guestId", "listingId", "dates", "total", "status", "paymentId"],
      why: "Valores e datas precisam estar de acordo",
    },
    {
      entity: "Mensagem",
      store: "Banco wide-column",
      key: "threadId + time",
      fields: ["senderId", "text"],
      why: "Muitas escritas por acréscimo, leitura por conversa",
    },
  ],

  nodes: [
    { id: "guest", kind: "web-client", label: "Web / app do hóspede", role: "Buscar, reservar, enviar mensagens" },
    { id: "host", kind: "mobile-client", label: "App do anfitrião", role: "Gerenciar anúncios, calendário e solicitações" },
    { id: "cdn", kind: "cdn", label: "CDN de fotos", role: "Fotos dos anúncios em vários tamanhos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Autenticação, rate limits, roteamento" },
    { id: "search-svc", kind: "service", label: "Serviço de busca", role: "Consulta geo + filtros, depois verificação de disponibilidade e ranqueamento" },
    { id: "listing-index", kind: "search", label: "Índice de anúncios", role: "Anúncios com ponto geográfico e comodidades" },
    { id: "ranking", kind: "ml-platform", label: "Modelos de ranqueamento e preço", role: "Ordena os resultados; sugere preços aos anfitriões" },
    { id: "listing-svc", kind: "service", label: "Serviço de anúncios", role: "CRUD de anúncios e upload de fotos" },
    { id: "availability-svc", kind: "service", label: "Serviço de disponibilidade", role: "Calendários e reservas de datas" },
    { id: "booking-svc", kind: "service", label: "Serviço de reservas", role: "Ciclo de vida da reserva" },
    { id: "payment-svc", kind: "service", label: "Pagamentos e repasses", role: "Autoriza na reserva, captura e repassa aos anfitriões após o check-in" },
    { id: "psp", kind: "payments", label: "Provedor de pagamento", role: "Cartões e repasses em várias moedas" },
    { id: "messaging", kind: "realtime-gateway", label: "Mensagens", role: "Chat entre hóspede e anfitrião" },
    { id: "main-db", kind: "relational-db", label: "Anúncios, calendários e reservas", role: "Sharding por anúncio" },
    { id: "photos", kind: "object-storage", label: "Fotos", role: "Imagens originais e redimensionadas" },
    { id: "events", kind: "event-stream", label: "Eventos do marketplace", role: "Alterações de anúncios, reservas" },
    { id: "notify", kind: "notifications", label: "E-mail e push", role: "Confirmações e lembretes de reserva" },
  ],

  edges: [
    { id: "guest-cdn", from: "guest", to: "cdn", label: "Fotos" },
    { id: "cdn-photos", from: "cdn", to: "photos" },
    { id: "guest-gateway", from: "guest", to: "gateway" },
    { id: "host-gateway", from: "host", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index", from: "search-svc", to: "listing-index", label: "Geo + filtros" },
    { id: "search-availability", from: "search-svc", to: "availability-svc", label: "Livre nessas datas?", protocol: "grpc" },
    { id: "search-ranking", from: "search-svc", to: "ranking" },
    { id: "gateway-listing", from: "gateway", to: "listing-svc", protocol: "grpc" },
    { id: "listing-db", from: "listing-svc", to: "main-db" },
    { id: "host-photos", from: "host", to: "photos", label: "Upload (pré-assinado)" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-availability", from: "booking-svc", to: "availability-svc", label: "Reservar noites", protocol: "grpc" },
    { id: "availability-db", from: "availability-svc", to: "main-db" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "listing-events", from: "listing-svc", to: "events", protocol: "stream" },
    { id: "events-index", from: "events", to: "listing-index", label: "Reindexar", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "guest-messaging", from: "guest", to: "messaging", protocol: "ws" },
    { id: "host-messaging", from: "host", to: "messaging", protocol: "ws" },
  ],

  flows: [
    {
      id: "search",
      name: "Buscar hospedagens",
      steps: [
        { edge: "guest-gateway", text: "O hóspede busca uma área do mapa para 3 noites." },
        { edge: "gateway-search", text: "O serviço de busca executa a consulta." },
        { edge: "search-index", text: "O índice retorna os anúncios dentro da área do mapa que atendem aos filtros." },
        { edge: "search-availability", text: "Os candidatos são conferidos nos calendários para essas noites exatas." },
        { edge: "search-ranking", text: "Os anúncios disponíveis são ranqueados por relevância, qualidade e preço." },
        { edge: "guest-cdn", text: "As fotos são carregadas pela CDN." },
      ],
    },
    {
      id: "book",
      name: "Reserva instantânea",
      steps: [
        { edge: "guest-gateway", text: "O hóspede reserva com uma chave de idempotência." },
        { edge: "gateway-booking", text: "O serviço de reservas inicia a reserva." },
        { edge: "booking-availability", text: "O serviço de disponibilidade reserva as noites." },
        { edge: "availability-db", text: "Todas as noites passam de livres para reservadas em uma única transação — somente se todas ainda estiverem livres." },
        { edge: "booking-payment", text: "O pagamento é autorizado (capturado no check-in)." },
        { edge: "payment-psp", text: "O cartão é autorizado." },
        { edge: "booking-events", text: "'Reserva confirmada' é publicado." },
        { edge: "events-notify", text: "Hóspede e anfitrião recebem confirmações." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Combinar busca geográfica com disponibilidade de datas",
      fix: "Filtrar por localização no índice e depois conferir em lote os calendários dos melhores candidatos; manter no índice um indicador grosseiro de 'disponível' para ganhar velocidade.",
      nodes: ["search-svc", "listing-index", "availability-svc"],
    },
    {
      problem: "Dois hóspedes reservando as mesmas datas",
      fix: "Atualização condicional sobre todo o intervalo de datas dentro de uma única transação no shard do anúncio.",
      nodes: ["availability-svc", "main-db"],
    },
    {
      problem: "Grande volume de fotos",
      fix: "Uploads diretos, redimensionamento assíncrono e entrega via CDN com formatos modernos.",
      nodes: ["photos", "cdn"],
    },
  ],

  scaling: [
    "Aplicar sharding em anúncios, calendários e reservas por listingId, para que uma reserva fique em um único shard.",
    "Replicar o índice de busca por região.",
    "Manter as mensagens em uma camada de tempo real própria.",
  ],

  extensions: [
    "Experiências e atividades junto com as hospedagens.",
    "Sugestões de preço inteligentes para anfitriões.",
    "Confiança e segurança: verificação de identidade e pontuação de fraude.",
  ],
};
