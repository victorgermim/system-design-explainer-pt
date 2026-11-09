# Plano de Melhorias de Profundidade

Transforma as dez melhorias sugeridas (arquitetura mais profunda, capacidade interativa, design de banco de dados,
configurações de nuvem, segurança, confiabilidade, custo, observabilidade, preparação para entrevistas, implementação) em um
plano de construção que se encaixa na base de código atual.

---

## 0. A ideia principal: definir profundidade uma vez por tipo de componente

O site possui **36 sistemas → 529 nós de diagrama → apenas 36 tipos de componentes**. Escrever modos de falha,
controles de segurança, métricas e preços para 529 nós manualmente não é realista; escrevê-los para 36
tipos é. Portanto, cada nova funcionalidade tem duas camadas:

1. **Padrões por tipo (kind-level)** em `src/content/components.ts` — como um *cache* falha, o que deve ser monitorado em um *BD relacional*, como um *API gateway* é protegido, como o *armazenamento de objetos* é precificado. Todo
   sistema recebe isso automaticamente.
2. **Sobrescritas por sistema (system-level)** em `src/content/systems/*.ts` — apenas onde um sistema é especial (o índice geográfico do Uber, o livro-razão de pagamentos). Escrito em profundidade primeiro para os 10 sistemas principais.

Todos os novos campos são **opcionais** no schema Zod, para que as seções apareçam conforme o conteúdo é adicionado e o
site nunca quebre durante a implementação gradual. `npm run validate` ganha verificações para cada novo campo.

---

## 1. Calculadora de capacidade interativa ★ construir primeiro

Base para custo, dimensionamento e simulação de falhas.

**Schema** — `estimates` se torna um pequeno modelo:

```ts
capacity: {
  inputs: [
    { id: "dau", label: "Daily active users", default: 500e6, unit: "users", min: 1e3, max: 5e9, scale: "log" },
    { id: "actionsPerUser", label: "Requests per user per day", default: 5 },
    { id: "payloadKB", label: "Average payload", default: 2, unit: "KB" },
    { id: "readRatio", label: "Reads per write", default: 100 },
    { id: "retentionDays", label: "Retention", default: 1825, unit: "days" },
    { id: "replication", label: "Replication factor", default: 3 },
    { id: "peakFactor", label: "Peak / average", default: 3 },
  ],
  outputs: [
    { id: "qps", label: "Average requests/s", formula: "dau * actionsPerUser / 86400", unit: "req/s" },
    { id: "peakQps", label: "Peak requests/s", formula: "qps * peakFactor" },
    { id: "storage", label: "Storage", formula: "writesPerDay * payloadKB * retentionDays * replication", unit: "KB" },
    …
  ],
  sizing: [  // turns outputs into infrastructure
    { node: "api", per: "peakQps", capacityPerInstance: 2000, label: "API instances" },
    { node: "cache", per: "hotDataGB", capacityPerInstance: 50, label: "Cache nodes" },
  ],
}
```

**Interface (UI)**
- Controles deslizantes (sliders) e campos numéricos com escala logarítmica para números grandes; predefinições: *Startup · Crescimento · Hiperescala*.
- Cada saída mostra sua fórmula com os números ao vivo substituídos, mantendo o valor didático.
- Uma tabela de dimensionamento (instâncias, shards, nós de cache, largura de banda); os nós do diagrama ganham um pequeno selo "×12".
- Entradas armazenadas na URL, para que um cenário possa ser compartilhado.

**Engenharia**
- Um pequeno avaliador de expressões seguro (sem `eval`), como `expr-eval`, ou um parser de 100 linhas.
- O validador avalia cada modelo com seus valores padrão: todas as saídas devem ser finitas, as fórmulas só podem
  referenciar IDs declarados e os padrões devem reproduzir os números publicados atualmente.

---

## 2. Design de banco de dados mais profundo

Estender cada entrada de `dataModel`:

```ts
{
  entity: "Message",
  store: "wide-column-db",
  partitionKey: "conversationId",
  sortKey: "messageId (time-ordered)",
  indexes: [{ name: "by_sender", keys: ["senderId", "createdAt"], why: "Moderation lookups" }],
  queryPatterns: [
    { query: "Latest 50 messages in a conversation", uses: "partition + sort desc", cost: "1 partition read" },
    { query: "Unread count per user", uses: "counter in cache", cost: "O(1)" },
  ],
  consistency: "Quorum writes, local-quorum reads",
  ttl: "None (user-deletable)",
  sizePerRow: "≈ 500 B",
}
```

- Uma **matriz "consulta → índice"** por sistema mostra qual padrão de acesso atinge qual chave ou índice. Esta
  é a lacuna mais comum em entrevistas.
- Avisos de partição quente (hot-partition) calculados a partir do modelo de capacidade (por exemplo, a partição de uma celebridade excedendo
  a vazão por partição).
- Definições opcionais de DDL / tabelas geradas por armazenamento (`CREATE TABLE` do PostgreSQL, schema de chaves do DynamoDB,
  CQL do Cassandra).

---

## 3. Mapeamento de nuvem com configurações reais e trade-offs

Estender cada opção de provedor em `components.ts`:

```ts
{ name: "Amazon DynamoDB",
  configs: [
    { name: "On-demand", whenToUse: "Spiky or unknown traffic", tradeoff: "≈ 6–7× cost at steady load" },
    { name: "Provisioned + auto-scaling", whenToUse: "Predictable load", tradeoff: "Throttling on sudden spikes" },
  ],
  limits: ["400 KB item size", "3,000 RCU / 1,000 WCU per partition"],
  example: "terraform snippet or console settings",
  lastVerified: "2026-10" }
```

- **Visualização comparativa:** escolha um componente e veja AWS, GCP, Azure e OSS lado a lado (configurações, limites,
  carga operacional gerenciada vs auto-hospedada, nível de lock-in).
- Notas de **"por que esta escolha"** por sistema nos nós onde a escolha importa.
- Cada linha recebe um carimbo `lastVerified`, e o validador sinaliza linhas com mais de 12 meses.

---

## 4. Arquitetura de segurança

**Controles por tipo** (escritos uma vez): por exemplo, *API gateway* → autenticação, rate limiting,
WAF, validação de requisição; *BD relacional* → criptografia em repouso, TLS, papéis de menor privilégio, sub-rede
privada; *armazenamento de objetos* → bloquear acesso público, URLs pré-assinadas, políticas de bucket, chaves KMS.

**Seção por sistema** — nova seção na página *Segurança*:
- Identidade: fluxos OAuth 2.0 / OIDC, tempos de vida de tokens, autenticação serviço a serviço (mTLS ou workload
  identity).
- Autorização: modelo RBAC/ABAC, por exemplo, proprietário/editor/leitor para pastas do Dropbox, escopos de lojista para
  pagamentos.
- Classificação de dados por armazenamento (público / interno / PII / pagamento), com regras de criptografia e retenção.
- Gerenciamento e rotação de segredos.
- Estratégia de isolamento de locatários (multi-tenant) onde relevante (nível de linha, schema por locatário, conta por locatário).
- Ameaças: um mini modelo de ameaças com 3–5 ameaças no estilo STRIDE e suas mitigações.

**Sobreposição de segurança no diagrama**: um alternador desenha fronteiras de confiança (internet / DMZ / privada / zona PCI),
ícones de cadeado em conexões criptografadas e selos de classificação de dados nos armazenamentos.

**Mapeamento de provedores** para identidade: AWS IAM roles · GCP service accounts / Workload Identity · Azure
Managed Identities · OSS SPIFFE/SPIRE; segredos: Secrets Manager · Secret Manager · Key Vault ·
OpenBao/Vault. A maioria desses tipos já existe no catálogo.

**Novos conceitos**: OAuth/OIDC, IAM de menor privilégio, RBAC vs ABAC, criptografia de envelope, mTLS / zero
trust, isolamento de locatários, rotação de segredos.

---

## 5. Confiabilidade: SLOs e o simulador de falhas

**Seção de confiabilidade por sistema**
```ts
reliability: {
  slos: [{ sli: "Playback start success", target: "99.95%", window: "30d" },
         { sli: "p99 start latency", target: "< 2 s" }],
  rto: "15 min", rpo: "≤ 1 min (async cross-region replication)",
  deployment: "Multi-AZ; active-passive region",
}
```
- Explicador de orçamento de erros (error budget) (99,95% ≈ 21,6 min/mês), calculado a partir da meta.

**Simulador de falhas** — a funcionalidade de destaque:
- **Modelos de falha por tipo:** *cache fora do ar* → chamadores caem direto no BD, carga × (1/taxa de miss);
  *primário do BD fora do ar* → escritas falham até o failover (RTO), leituras continuam nas réplicas; *atraso no event-stream*
  → consumidores assíncronos atrasados, produtores não afetados; *tempestade de misses na CDN* → tráfego de saída na origem dispara;
  *falha de AZ* → nós naquela zona são perdidos; *partição de rede* → divide o grafo.
- **Propagação** calculada no grafo existente: percorrer a montante (upstream) a partir do nó com falha ao longo das
  arestas síncronas (`https`, `grpc`, `ws`) para encontrar o impacto visível ao usuário; arestas assíncronas (`async`, `stream`)
  interrompem a cascata e mostram "fila crescendo" em vez disso. Nenhuma cascata escrita à mão é necessária por sistema.
- **Interface (UI):** um menu "Quebrar algo" no diagrama. Nós com falha ficam vermelhos, caminhos afetados ficam âmbar,
  filas pulsam e um painel lateral lista o impacto para o usuário, quais SLOs são consumidos e as mitigações recomendadas
  (circuit breaker, réplica, fallback, multi-AZ), cada uma apontando para uma página de conceito.
- **Alternador "Corrigir":** aplique uma mitigação e execute novamente a simulação para mostrar a melhoria.
- Usa as saídas de capacidade para quantificar o impacto ("o BD recebe 120 mil req/s em vez de 6 mil").

---

## 6. Estimador de custos em nuvem

- **Unidades de preço por tipo:** computação por vCPU-hora, armazenamento por GB-mês, requisições por milhão,
  tráfego de saída (egress) por GB, BD gerenciado por instância-hora, e assim por diante, para AWS, GCP e Azure, além de um modelo OSS
  (computação bruta + armazenamento + um fator de "sobrecarga operacional" em horas de engenheiro).
- **Estimativa mensal** = dimensionamento de capacidade × preços unitários, mostrada por componente e por provedor, como uma
  **faixa** (mínimo/máximo), nunca um valor único exato.
- Gráficos: barra empilhada por provedor; os 3 maiores geradores de custo destacados (geralmente egress/CDN,
  armazenamento, computação).
- Dicas de economia por tipo: uso reservado ou comprometido, armazenamento em camadas (tiered storage), offload para CDN, right-sizing, workers
  spot para transcodificação.
- **Fonte de dados:** primeiro um snapshot curado em `pricing.ts` com uma data `lastVerified`. Posteriormente, um script em tempo de build
  o atualiza a partir das APIs públicas de preços (AWS Price List, Azure Retail Prices, GCP Cloud
  Billing Catalog), mantendo o site estático.
- Aviso claro: região, descontos e transferência de dados variam; os números servem para comparar designs,
  não para fazer orçamento.

---

## 7. Observabilidade

- **Golden signals por tipo:** por exemplo, *serviço* → latência, tráfego, erros, saturação;
  *event stream* → atraso do consumidor (consumer lag), desequilíbrio de partição; *cache* → taxa de acerto (hit ratio), remoções (evictions), memória;
  *BD relacional* → atraso de replicação, conexões, consultas lentas.
- **Seção por sistema:** painéis principais, top 5 alertas (baseados em sintomas, vinculados aos SLOs), campos de log para
  capturar e uma estratégia de correlation-id.
- **Visualização de trace dos fluxos passo a passo:** cada passo do fluxo ganha um orçamento de latência, e o passo a passo também
  é renderizado como uma cascata de trace distribuído (waterfall), o que ensina tracing e mostra para onde vai o tempo.
- O mapeamento de provedores já existe (CloudWatch/X-Ray · Cloud Monitoring/Trace · Azure Monitor ·
  Prometheus/Grafana/OpenTelemetry/Jaeger); adicionar exemplos de regras de alerta e trechos de configuração do OTel.

---

## 8. Preparação para entrevistas

Por sistema:
```ts
interview: {
  questions: [
    { q: "How do you avoid double-booking a seat?",
      followUps: ["What if the cache holding the lock fails?"],
      goodAnswer: ["Short TTL hold", "DB unique constraint as final guard", "Idempotent confirm"],
      redFlags: ["Only a DB transaction under 250k concurrent users"] },
  ],
  rubric: { requirements: …, estimates: …, dataModel: …, scaling: …, tradeoffs: … },
}
```
- **Modo de entrevista simulada:** um cronômetro de 45 minutos com as fases padrão (esclarecer → estimar → API →
  dados → design → aprofundamento → conclusão), dicas reveladas progressivamente e uma rubrica de autoavaliação.
- **Flashcards** gerados a partir de conceitos e gargalos; exercícios de "explique este diagrama em 2 minutos".
- Progresso (perguntas tentadas, pontuações) armazenado localmente no navegador.

---

## 9. Modo de implementação

Não tente fazer 36 sistemas × 4 linguagens. Em vez disso:

- **Um repositório separado `system-design-labs`**, vinculado a partir do site, com **implementações de referência para
  4–5 sistemas principais** escolhidos para cobrir diferentes padrões:
  | Sistema | Padrão que ensina | Stack principal |
  |---|---|---|
  | Encurtador de URL | IDs, caching, armazenamento KV | Go |
  | Rate limiter | Redis + Lua, middleware | Node.js (TypeScript) |
  | Chat (WhatsApp) | WebSockets, pub/sub, entrega offline | Go |
  | Saga de checkout (Amazon) | Saga, idempotência, outbox | Java/Spring Boot |
  | Livro-razão de pagamentos | Partidas dobradas, APIs idempotentes | Python/FastAPI |
- Cada laboratório inclui `docker-compose.yml` (Postgres, Redis, Redpanda/Kafka, MinIO), testes, manifestos k8s
  ou um gráfico Helm, e módulos Terraform opcionais por nuvem que reutilizam o mapeamento componente →
  provedor.
- **Exercícios:** "adicione um cache e meça o p99", "derrube o Redis e observe o fallback", "faça sharding da
  tabela" — vinculados a partir do simulador de falhas e da calculadora de capacidade.
- No site: uma **aba de Código** em cada passo do fluxo mostrando o trecho relevante na linguagem escolhida,
  extraído do repositório de laboratórios em tempo de build para que nunca fique defasado.

---

## 10. Arquitetura mais profunda (transversal)

- **Diagramas com zoom:** uma visualização de alto nível (atual) com "expandir" em um nó para mostrar seu funcionamento interno
  (por exemplo, o pipeline de busca de candidatos → ranqueamento por ETA → lock → oferta do serviço de pareamento).
- **Diagramas de sequência** gerados a partir de cada fluxo (Mermaid), ao lado do passo a passo animado.
- **Registros de decisão (ADRs):** 2–3 cards de ADR "escolhemos X em vez de Y porque…" para cada sistema principal.
- **Visualização de evolução:** v1 (monólito + um BD) → v2 (cache + réplicas) → v3 (com sharding, multi-região), para que
  os estudantes vejam *por que* cada componente existe.

---

## Roteiro priorizado

| # | Funcionalidade | Por que agora | Esforço (10 principais + padrões por tipo) |
|---|---|---|---|
| 1 | Calculadora de capacidade | Base para custo, dimensionamento e simulação; alto engajamento | 4–5 dias |
| 2 | Profundidade em design de BD + campos de confiabilidade/SLO | Profundidade de conteúdo que entrevistadores mais exploram | 4–6 dias |
| 3 | Simulador de falhas | Funcionalidade de destaque; reutiliza grafo + capacidade | 6–8 dias |
| 4 | Seções e sobreposições de segurança + observabilidade | Fecha as maiores lacunas de conteúdo | 6–8 dias |
| 5 | Modo de entrevista | Forte valor de aprendizado, majoritariamente conteúdo | 4–5 dias |
| 6 | Estimador de custos | Precisa de capacidade + dimensionamento; dados de preços precisam ser mantidos | 5–7 dias |
| 7 | Configurações de nuvem e trade-offs, visualização comparativa | Constrói sobre o catálogo | 3–4 dias |
| 8 | Repositório de laboratórios de implementação | Maior escopo; executar em paralelo com os itens acima | 2–3 semanas para 5 labs |
| 9 | Diagramas com zoom, diagramas de sequência, visualização de evolução | Refinamento sobre a profundidade | 5–7 dias |

Lançamento: cada funcionalidade é entregue primeiro para os 10 sistemas principais mais os padrões por tipo para todos os 36,
e depois se aprofunda sistema por sistema. Combinar com as Fases 1–3 de `REDESIGN_PLAN.md` para que os novos painéis entrem
no espaço de trabalho do sistema redesenhado, em vez de serem adicionados à página longa atual.

## Riscos e como lidar com eles

| Risco | Mitigação |
|---|---|
| Números de custo parecem precisos, mas estão errados | Mostrar faixas, datar os preços, adicionar aviso de isenção, apresentar como comparação |
| Volume de conteúdo explode | Padrões por tipo primeiro; sistemas principais profundos, outros superficiais porém corretos |
| Simulador simplifica demais | Rotulá-lo como um modelo; mostrar a regra usada ("aresta síncrona → o impacto se propaga") |
| Fatos da nuvem ficam desatualizados | `lastVerified` em cada linha de provedor e preço; validador avisa após 12 meses |
| Laboratórios se distanciam do site | Extrair trechos do repositório de labs em tempo de build; CI executa os testes dos labs |
