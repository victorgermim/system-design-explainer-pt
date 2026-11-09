# Notas de System Design (destiladas dos 59 PDFs)

Estas notas são a fonte de conteúdo para o site explicativo. Elas substituem o leitor de PDF: o site
entrega o *conhecimento* dos PDFs, e não os PDFs em si.

---

## 1. Inventário e deduplicação

59 arquivos → **46 tópicos únicos** após a mesclagem de duplicatas e pares HLD/LLD.

| Duplicatas exatas / quase exatas | Ação |
|---|---|
| `Dropbox High Level Design.pdf` = `Dropbox High Level Design (1).pdf` (idênticos byte a byte) | manter um |
| `AstroTalk-like Platform HLD.pdf`, `... (1).pdf`, `HLD for AstroTalk.pdf` | mesclar em uma única página do AstroTalk (o "HLD for AstroTalk" de 16 mil palavras é o mais rico) |
| `Meeting Scheduler System Design.pdf` + `Designing a Meeting Scheduler System.pdf` | mesclar |
| `Parking Lot System Design.pdf` + `Parking Lot Management System HLD.pdf` | mesclar (abas HLD + LLD) |
| `Smart Vending Machine System Design.pdf` + `Design of a Vending Machine System (LLD in Go).pdf` | mesclar (abas HLD + LLD) |
| `Designing an Online Stock Brokerage System.pdf` + `High-Level System Design_ Online Stock Brokerage Platform.pdf` | mesclar |
| `Amazon-Like ... System Design.pdf` + `Amazon-Style ... in Go.pdf` | mesclar (abas HLD + LLD) |
| `High-Level Design_ Airline Management System.pdf` + `Airline Management System Design in Go.pdf` | mesclar |
| `Quora-like Q&A ... Architecture.pdf` + `Q&A Platform Design in Go.pdf` | mesclar |
| `Ride-Sharing ... (Uber-Like).pdf` + `Uber Low Level Design.pdf` | mesclar |
| `YouTube-like Video Streaming ... Design.pdf` + `Youtube Low level design.pdf` | mesclar |

## 2. Catálogo (categorias propostas para o site)

**Mídia e Social** — YouTube, Netflix, Instagram, Twitter/X, chat do Facebook Messenger, LinkedIn, Quora
**Mobilidade e Logística** — Uber, agendamento de motoristas e gestão de frota, logística Porter, Google Maps, aluguel de carros
**Comércio e Fintech** — Amazon, gateway de pagamento, pagamentos digitais (PayPal/Paytm/PhonePe), crédito BNPL (LazyPay), corretora de valores
**Reservas e Marketplaces** — BookMyShow, MakeMyTrip, gestão de companhia aérea, Airbnb, imóveis NoBroker, entrega de comida Zomato, serviços domésticos Urban Company, teleconsulta Practo, AstroTalk, agendador de reuniões, esportes em tempo real
**Blocos de construção / Infra** — Encurtador de URL, Pastebin, rate limiter de API, Typeahead, web crawler, sincronização de arquivos Dropbox, WebSocket em escala, WebRTC em escala
**Design de baixo nível (Go, OOP)** — Caixa eletrônico (ATM), máquina de vendas, elevador, estacionamento, biblioteca, xadrez, Ludo, Blackjack, quebra-cabeça, reserva de ingressos de cinema
**Preparação para entrevistas** — Perguntas de entrevistas técnicas (concorrência em Go, AWS e multi-cloud, DevOps, microsserviços, gerenciais, fit cultural)

## 3. O modelo que todo PDF de HLD segue

Quase todo documento de HLD usa os mesmos 9 passos. O site deve usar isso como esqueleto de página:

1. **Requisitos** – funcionais + não funcionais (latência, disponibilidade, consistência, escala)
2. **Definições de API** – endpoints REST/gRPC/WebSocket
3. **Estimativas de envelope (back-of-the-envelope)** – DAU, QPS, armazenamento/dia, largura de banda
4. **Modelo de dados** – tabelas/coleções, chaves de partição, qual armazenamento usar e por quê
5. **Componentes de alto nível** – o diagrama de blocos
6. **Fluxos detalhados** – upload, feed, pareamento, checkout, etc. (sequência de saltos)
7. **Gargalos e soluções**
8. **Escalabilidade** – sharding, replicação, balanceamento de carga, multi-região
9. **Recursos opcionais / extensões**

Os PDFs de LLD seguem um modelo diferente: requisitos → entidades/classes → padrões de projeto
(State, Strategy, Observer, Factory, Singleton) → concorrência → esboços de código em Go.

## 4. Frequência de tecnologias nos PDFs

Contabilizado em todos os documentos (quantos PDFs mencionam ≥2 vezes):

- **Redis** – em quase todo HLD (cache, sessões, contadores, índice geográfico, pub/sub, locks distribuídos, reserva temporária de assentos)
- **Kafka** – espinha dorsal de eventos em ~30 designs (upload→transcodificação, eventos de corrida, eventos de pedido, fan-out, analytics)
- **Elasticsearch / OpenSearch** – busca para catálogos, anúncios, restaurantes, vídeos, usuários
- **CDN** – todo sistema de mídia/consumidor; Netflix/YouTube/Maps/Airbnb dependem fortemente dela
- **WebSocket** – chat, rastreamento de corrida, cotações de ações, placares esportivos, mapas de assentos em reservas
- **Cassandra / Bigtable / HBase / DynamoDB** – feeds com alta carga de escrita, mensagens, metadados, timelines
- **PostgreSQL / MySQL** – núcleo transacional (pedidos, pagamentos, reservas, usuários)
- **S3 / armazenamento de objetos** – mídia, documentos, pastes, backups
- **JWT / OAuth** – autenticação no gateway
- **Kubernetes, Prometheus, Grafana, ELK, Jaeger** – camada de operações
- **Stripe / Razorpay / Twilio / FCM / APNs** – pagamentos de terceiros, SMS/voz, notificações push

## 5. Padrões transversais (biblioteca de conceitos)

Eles aparecem repetidamente e merecem suas próprias páginas explicativas vinculadas a cada sistema que os utiliza:

| Conceito | Onde aparece |
|---|---|
| Caching (cache-aside, write-through, TTL, tratamento de hot-keys) | quase todos |
| Read replicas e sharding (hash/range, chaves de partição) | ~30 designs |
| Rate limiting (token bucket, janela deslizante; contadores no Redis) | ~30 designs, PDF próprio |
| Circuit breakers, retentativas, timeouts | ~24 designs |
| Multi-região / ativo-ativo, geo-DNS | ~24 designs |
| Chaves de idempotência (pagamentos, reservas, retentativas) | ~23 designs |
| Locks distribuídos / reservas temporárias de assentos e horários com TTL | BookMyShow, Companhia aérea, MakeMyTrip, Urban Company, Agendador de reuniões |
| Fan-out na escrita vs na leitura (problema da celebridade) | Twitter, Instagram, Quora, LinkedIn |
| Livro-razão de partidas dobradas (double-entry ledger), conciliação | Pagamentos, BNPL, Corretora, Gateway de pagamento |
| Saga / transações compensatórias | Amazon, MakeMyTrip |
| CQRS / modelos de leitura orientados a eventos | Pagamentos, NoBroker |
| Indexação geoespacial (S2, Geohash, QuadTree, H3) | Uber, Frota de motoristas, Porter, Maps, Zomato |
| Streaming de bitrate adaptativo (HLS/DASH), pipeline de transcodificação | YouTube, Netflix |
| Upload em partes/retomável, URLs pré-assinadas, deduplicação por hash | Dropbox, YouTube, Instagram |
| Consistent hashing | Gateway WebSocket, Rate limiter, clusters de cache |
| Geração de IDs (Snowflake, Base62) | Twitter, Encurtador de URL, Pastebin |
| Trie / índice de prefixos | Typeahead |
| Filtros de Bloom, fronteira de URLs, políticas de cortesia (politeness) | Web crawler |
| Back-pressure, filas de mensagens mortas (dead-letter queues) | WebSocket, Crawler, Pagamentos |
| Sinalização + STUN/TURN + SFU | WebRTC, Practo, AstroTalk |
| Eleição de líder (ZooKeeper/etcd) | Crawler, Quora, Rate limiter |

## 6. Notas principais por sistema (componentes que o site deve mostrar)

**YouTube** – Clientes → DNS/LB → API gateway → serviços (Upload, Vídeo, Usuário, Comentário, Curtida, Busca, Recomendação) · upload em partes para armazenamento de objetos → job no Kafka → workers de transcodificação FFmpeg (240p–1080p) → armazenamento de objetos → CDN com HLS/DASH · metadados no Bigtable/NoSQL, busca no Elasticsearch, Redis para contadores quentes · Estimativas: ~500 h enviadas/min, ~250 TB/dia de vídeos novos, ~30k QPS médio. Gargalos: CPU de transcodificação (autoscale/GPU), vídeos quentes (contadores em cache, write-back assíncrono), saturação da CDN.
**Netflix** – CDN estilo Open Connect, matrizes no S3, codificação por título, Cassandra para histórico de visualização, MySQL para faturamento, Spark/Kafka para recomendações.
**Instagram** – Upload pré-assinado para o S3, workers de redimensionamento de imagem, PostgreSQL (usuários/metadados de mídia, com sharding), feeds no Cassandra, Redis/Memcached, fan-out híbrido para feeds, Elasticsearch para busca.
**Twitter** – IDs Snowflake, fan-out na escrita para timelines no Redis com fan-out na leitura para celebridades, armazenamento de tweets estilo Cassandra/Manhattan, busca no Elasticsearch, tendências no Kafka.
**Chat do Messenger** – Gateways WebSocket com registro de sessão no Redis, armazenamento de mensagens no Cassandra particionado por conversa, Kafka para entrega, FCM/APNs para offline, S3 para mídia, confirmações de leitura/presença.
**Uber** – Pings de localização do motorista via WebSocket a cada poucos segundos → serviço de localização (Redis geo / células S2) → serviço de pareamento → serviço de viagem (máquina de estados) → preços/surge → pagamentos (Stripe) → Kafka → analytics com Flink/Spark.
**Google Maps** – Serviço de tiles + CDN, roteamento (particionamento de grafos, contraction hierarchies), ingestão de tráfego via Kafka, geocodificação + busca de locais no Elasticsearch, serviço de ETA.
**Amazon** – Catálogo (Elasticsearch), carrinho (Redis/DynamoDB), serviço de pedidos com Saga entre estoque/pagamento/envio, eventos no Kafka, gRPC internamente, JWT na borda.
**Pagamentos / Gateway de pagamento / BNPL** – Chaves de idempotência, livro-razão de partidas dobradas em RDBMS, eventos no Kafka, modelos de leitura CQRS, pontuação de fraude/risco, jobs em lote de conciliação, cofre de tokenização PCI.
**Corretora de valores** – Gestão de ordens + verificações de risco, gateway de bolsa (FIX), fan-out de dados de mercado via WebSocket, Kafka, livro-razão.
**BookMyShow / Companhia aérea / MakeMyTrip** – Estoque com reserva temporária de assentos (locks com TTL no Redis ou `SELECT … FOR UPDATE`), pagamento e depois confirmação, Saga para reservas multi-fornecedor, busca no Elasticsearch, cache agressivo de disponibilidade.
**Zomato / Urban Company / Porter / Frota de motoristas** – Busca geográfica, despacho/pareamento, rastreamento ao vivo via WebSocket, eventos de pedido no Kafka, notificações via FCM/Twilio.
**Airbnb / NoBroker** – Busca de anúncios (Elasticsearch + geo), calendário de disponibilidade, reserva com bloqueio temporário, mensagens, avaliações, pagamentos, CDN de imagens.
**Practo / AstroTalk** – Descoberta de profissionais, reserva de horários, chat/voz/vídeo via WebRTC (TURN) ou Twilio, carteira/cobrança por minuto, armazenamento de receitas/prontuários.
**Encurtador de URL / Pastebin** – IDs Base62 ou serviço de geração de chaves, armazenamento KV (DynamoDB/Cassandra), cache Redis, redirecionamento 301, limpeza de expirados, S3 para blobs de paste.
**Rate limiter** – Contadores de token bucket / janela deslizante no Redis (Lua para atomicidade), regras em armazenamento de configuração (etcd), implantação como sidecar ou no gateway.
**Typeahead** – Trie construída offline (Spark sobre logs de consulta), dividida em shards por prefixo, cache Redis dos top-k por prefixo, ZooKeeper para mapa de shards.
**Web crawler** – Fronteira de URLs (Kafka), cortesia/robots, deduplicação com filtro de Bloom, coletores (fetchers), parser, armazenamento bruto em HDFS/S3, índice em HBase/Bigtable.
**Dropbox** – Divisão em chunks + deduplicação por hash de conteúdo, BD de metadados, armazenamento de blocos no S3, sincronização via notificações WebSocket/long-poll, resolução de conflitos.
**WebSocket em escala (Go na AWS)** – EKS, NLB, consistent hashing de conexões, Redis pub/sub + Kafka para fan-out entre nós, JWT, Prometheus/Grafana.
**WebRTC em escala (Go na AWS)** – Sinalização via WebSocket, STUN/TURN (coturn), SFU (Pion), EKS, gravação via FFmpeg para o S3.

## 7. Notas de "Perguntas de Entrevistas Técnicas"

Útil como seção de barra lateral/FAQ em vez de um sistema: concorrência em Go (goroutines vs threads, canais,
tratamento de erros), otimização de custos na AWS e multi-cloud, CI/CD e DevOps, quando microsserviços *não* são
a escolha certa, além de perguntas gerenciais e de fit cultural.
