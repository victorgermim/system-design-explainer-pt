import type { SystemDesignInput } from "@/types/schema";

export const rateLimiter: SystemDesignInput = {
  slug: "rate-limiter",
  name: "Rate limiter de API",
  tagline: "Limites de uso justo verificados em cada requisição em menos de um milissegundo",
  description:
    "Toda requisição de API passa por um limiter no gateway, que atualiza atomicamente um contador (ou token bucket) daquele cliente em um store em memória compartilhado e retorna permitir ou negar. As regras ficam em um banco de configuração e são enviadas a todas as instâncias do limiter, de modo que as mudanças valem em segundos, sem redeploy. Se o store de contadores cair, o limiter faz fail open em vez de derrubar a API junto.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["rate-limiting", "consistent-hashing", "caching", "leader-election"],

  requirements: {
    functional: [
      "Limitar requisições por identidade de cliente (usuário, chave de API ou IP), por exemplo 100 por minuto",
      "Limites diferentes por endpoint, plano ou nível",
      "Retornar HTTP 429 com Retry-After e headers X-RateLimit-* quando o limite for excedido",
      "Administradores podem adicionar ou alterar regras sem redeploy",
      "Reportar uso e bloqueios para monitoramento e cobrança",
    ],
    nonFunctional: [
      "Adiciona menos de ~1–2 ms a cada requisição",
      "Os limites valem entre várias instâncias de gateway (distribuído, não por servidor)",
      "Alta disponibilidade; se o limiter falhar, o tráfego continua fluindo (fail open)",
      "Pequenas contagens a mais ou a menos nas bordas da janela são aceitáveis",
    ],
  },

  apis: [
    { method: "GRPC", path: "Check(clientId, route) → allow, remaining, resetAt", purpose: "Chamado pelo gateway em cada requisição" },
    { method: "GET", path: "/v1/usage?client=&route=", purpose: "Uso atual e cota restante" },
    { method: "POST", path: "/v1/rules", purpose: "Cria uma regra: { scope, match, limit, window, algorithm }" },
    { method: "PUT", path: "/v1/rules/{ruleId}", purpose: "Altera um limite; propaga para todos os limiters em segundos" },
  ],

  estimates: [
    { label: "Verificações (pior caso)", value: "≈ 1,7 M/s", derivation: "1 M clientes × 100 req/min ÷ 60 s" },
    { label: "Contadores ativos", value: "≈ 5 M", derivation: "Um por cliente ativo × regra" },
    { label: "Memória dos contadores", value: "≈ 0,5–1 GB", derivation: "5 M × ~100–200 bytes por chave" },
    { label: "Shards do store de contadores", value: "≈ 20", derivation: "1,7 M ops/s ÷ ~100 k ops/s por shard Redis" },
    { label: "Orçamento de latência", value: "< 1 ms", derivation: "Um round trip a um store em memória na mesma zona" },
  ],

  dataModel: [
    {
      entity: "Regra",
      store: "Relational DB (source of truth)",
      key: "ruleId",
      fields: ["scope (key/user/ip)", "match (route, plan)", "limit", "windowSec", "algorithm", "priority"],
      why: "Pequena, editada raramente, precisa de histórico e validação",
    },
    {
      entity: "Token bucket",
      store: "In-memory store (Redis hash)",
      key: "rl:{clientId}:{ruleId}",
      fields: ["tokens", "lastRefill"],
      why: "Reposição e consumo em um único script atômico; permite rajadas curtas até o tamanho do bucket",
    },
    {
      entity: "Contador de janela fixa / deslizante",
      store: "In-memory store (Redis)",
      key: "rl:{clientId}:{ruleId}:{windowStart}",
      fields: ["count (TTL = window)"],
      why: "INCR + EXPIRE; a janela deslizante combina as contagens da janela atual e da anterior",
    },
  ],

  nodes: [
    { id: "clients", kind: "web-client", label: "Clientes da API", role: "Apps e integrações que chamam a API" },
    { id: "admin", kind: "web-client", label: "Console de administração", role: "Editar limites por plano ou cliente" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Ponto de enforcement: consulta o limiter, retorna 429 ou encaminha" },
    { id: "limiter", kind: "service", label: "Rate limiter", role: "Associa a requisição às regras e executa o algoritmo (plugin do gateway ou sidecar)" },
    { id: "counters", kind: "cache", label: "Store de contadores", role: "Contadores e token buckets compartilhados, atualizados atomicamente com scripts Lua" },
    { id: "backend", kind: "service", label: "APIs de backend", role: "Os serviços que estão sendo protegidos" },
    { id: "rules-svc", kind: "service", label: "Serviço de regras", role: "Valida e armazena as alterações de regras" },
    { id: "rules-db", kind: "relational-db", label: "Banco de regras", role: "Todas as regras de rate limit" },
    { id: "config", kind: "coordination", label: "Distribuição de configuração", role: "Envia atualizações de regras a todos os limiters (watch)" },
    { id: "metrics", kind: "observability", label: "Métricas e alertas", role: "Contagens de permitidas/negadas por cliente e rota" },
  ],

  edges: [
    { id: "clients-gateway", from: "clients", to: "gateway", label: "Requisição da API" },
    { id: "gateway-limiter", from: "gateway", to: "limiter", label: "Permitir?", protocol: "grpc" },
    { id: "limiter-counters", from: "limiter", to: "counters", label: "Verificação + atualização atômica" },
    { id: "gateway-backend", from: "gateway", to: "backend", label: "Requisições permitidas" },
    { id: "admin-rules", from: "admin", to: "rules-svc", label: "Editar regra" },
    { id: "rules-db-write", from: "rules-svc", to: "rules-db" },
    { id: "rules-config", from: "rules-svc", to: "config", label: "Publicar" },
    { id: "config-limiter", from: "config", to: "limiter", label: "Atualizações de regras", protocol: "async" },
    { id: "limiter-metrics", from: "limiter", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "check",
      name: "Verificar uma requisição",
      steps: [
        { edge: "clients-gateway", text: "Uma requisição chega com uma chave de API." },
        { edge: "gateway-limiter", text: "O gateway consulta o limiter; o limiter encontra a regra mais específica na sua cópia local em memória." },
        { edge: "limiter-counters", text: "Um script Lua repõe o bucket com base no tempo decorrido, retira um token se houver disponível e retorna o que sobrou — atômico, então gateways concorrentes não conseguem admitir além do limite." },
        { edge: "gateway-backend", text: "Permitida: a requisição é encaminhada com headers X-RateLimit-Remaining. Negada: o gateway retorna 429 com Retry-After." },
        { edge: "limiter-metrics", text: "As contagens de permitidas/negadas são emitidas de forma assíncrona." },
      ],
    },
    {
      id: "rule",
      name: "Alterar um limite",
      steps: [
        { edge: "admin-rules", text: "Um administrador aumenta o limite de um cliente para 1.000 por minuto." },
        { edge: "rules-db-write", text: "A regra é validada e armazenada." },
        { edge: "rules-config", text: "A nova versão é publicada no store de configuração." },
        { edge: "config-limiter", text: "Todos os limiters estão observando e trocam para as novas regras em segundos — sem redeploy." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Race conditions entre instâncias do gateway",
      fix: "Read-modify-write dentro de um único script Lua (ou INCR), para que cada verificação seja atômica no store.",
      nodes: ["limiter", "counters"],
    },
    {
      problem: "O store de contadores adiciona latência a cada requisição",
      fix: "Mantê-lo na mesma zona, usar pipeline nas chamadas e, para limites muito altos, manter um contador local que sincroniza em lotes.",
      nodes: ["counters", "limiter"],
    },
    {
      problem: "Um único cliente barulhento vira uma hot key",
      fix: "Hot keys são toleráveis em um shard até ~100 k ops/s; acima disso, dividir o bucket em subchaves ou contar localmente primeiro.",
      nodes: ["counters"],
    },
    {
      problem: "Queda do store de contadores",
      fix: "Fail open (permitir) com um timeout curto, recorrer a limites locais por instância e alertar.",
      nodes: ["limiter", "metrics"],
    },
    {
      problem: "Limites globais entre regiões",
      fix: "Dar a cada região uma fatia do limite e reequilibrar periodicamente — contagens globais exatas exigiriam chamadas lentas entre regiões.",
      nodes: ["counters"],
    },
  ],

  scaling: [
    "Fazer sharding dos contadores por clientId com consistent hashing em um cluster Redis.",
    "Executar o limiter dentro do processo do gateway ou como sidecar, para não haver hop de rede extra.",
    "Manter as regras em cache local em cada limiter; o store de configuração apenas envia as mudanças.",
    "Adicionar shards ao store de contadores conforme o volume de requisições cresce; o limiter em si é stateless.",
  ],

  extensions: [
    "Limites de concorrência (requisições em andamento) além dos limites de taxa.",
    "Limites adaptativos que se tornam mais restritos automaticamente quando os backends estão sobrecarregados.",
    "Cotas cobradas por plano, com o uso exportado para o faturamento.",
    "Limites por IP na camada de CDN/WAF para absorver inundações antes que cheguem ao gateway.",
  ],
};
