# PSFPREDICT — Decisões, mudanças e tasks

Este documento é o registro vivo das decisões técnicas/produto tomadas até aqui, das mudanças aplicadas no projeto e das próximas tasks. Sempre que uma nova decisão ou task surgir, registre aqui para manter histórico e contexto.

## Como manter este documento

- Adicione novas decisões em **Decisões registradas** com data, contexto e consequência.
- Adicione mudanças relevantes em **Mudanças implementadas** com arquivos/áreas afetadas.
- Adicione novas pendências em **Backlog de tasks** com prioridade, status e critério de aceite.
- Ao concluir uma task, mova o status para `Concluída` e registre a evidência: PR, commit, comando ou observação.

## Decisões registradas

### 2026-07-04 — Arquitetura Cloudflare-first em vez de Next.js

**Decisão:** usar Vite + React + TypeScript para o frontend estático e Hono + TypeScript em Cloudflare Workers para a API/cron.

**Motivo:** o deploy principal é Cloudflare. Next.js adicionaria complexidade de SSR/adapters para uma V1 que pode ser entregue como SPA estática consumindo API Worker.

**Consequência:**

- Frontend publicado via Cloudflare Pages.
- API, cron ESPN, ranking, feed e salvamento de palpites publicados via Cloudflare Workers.
- TypeScript é a linguagem única do projeto.

### 2026-07-04 — Frontend e API separados

**Decisão:** manter dois deploys:

- `https://app.psfes.space` para o frontend.
- `https://api.psfes.space` para a API.

**Consequência:** o frontend precisa de uma URL explícita para a API em produção via `VITE_API_BASE_URL=https://api.psfes.space`.

### 2026-07-04 — V1 sem login de participante

**Decisão:** participante comum usa apenas `displayName` + `username` para salvar e editar palpites.

**Consequência:** `username` é a identidade lógica do participante. A V1 aceita o risco de outra pessoa digitar o mesmo username e sobrescrever os palpites.

### 2026-07-04 — Admin único, mas ainda não implementado

**Decisão:** o app terá admin único para sync/recalculate, mas a implementação atual ainda não protege endpoints administrativos.

**Consequência:** antes de divulgar amplamente, endpoints como resync/recalculate devem ser protegidos com token, Cloudflare Access ou outro mecanismo.

### 2026-07-04 — ESPN Scoreboard como fonte de dados

**Decisão:** usar o endpoint hidden da ESPN:

```txt
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

com range:

```txt
20260628-20260719
```

**Consequência:** o parser em `shared/espn/parser.ts` normaliza times, status, placeholders e placares para o domínio interno.

### 2026-07-04 — Pontuação simples: placar exato

**Decisão:** apenas placar exato vale 1 ponto. Qualquer outro resultado vale 0.

**Consequência:** a lógica central fica em `shared/scoring/exact-score.ts` e o ranking soma `points` dos palpites.

### 2026-07-04 — Persistência em memória só para protótipo

**Decisão:** iniciar com `worker/src/lib/memory-store.ts` para validar fluxo ponta a ponta.

**Consequência:** dados não são confiáveis em produção. Antes de divulgar para uso real, trocar por PostgreSQL/Drizzle.

### 2026-07-08 — Frontend chama API final diretamente

**Decisão:** o React usa `VITE_API_BASE_URL` com fallback para `https://api.psfes.space`, em vez de depender apenas do `_redirects` do Cloudflare Pages.

**Motivo:** o app quebrou em produção exibindo erro de carregamento de dados públicos; depender apenas do proxy `/api/*` dificultava diagnosticar e podia falhar se o redirect/Worker custom domain não estivesse alinhado.

**Consequência:** todas as chamadas do frontend passam por `apiUrl()`, incluindo matches, ranking, feed, participante, revelação e salvamento de palpites.


### 2026-07-09 — API usa PostgreSQL/Drizzle no runtime

**Decisão:** substituir o `memory-store` por um repositório Drizzle/PostgreSQL usando o driver Neon/serverless compatível com Cloudflare Workers.

**Motivo:** dados de produção precisam sobreviver a redeploy/restart do Worker e múltiplos isolates.

**Consequência:** `DATABASE_URL` passa a ser obrigatório no Worker, e as rotas públicas preservam os contratos existentes consumidos pelo frontend.

## Mudanças implementadas

### Fundação do projeto

- Criado `package.json` com scripts de desenvolvimento, build, lint, typecheck, Drizzle e deploy.
- Criado `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js` e `eslint.config.js`.
- Criada documentação inicial em `docs/architecture.md` e `docs/deploy.md`.

### Frontend

- Criado frontend React/Vite em `web/`.
- Implementada SPA com páginas:
  - `/`
  - `/palpites`
  - `/ranking`
  - `/feed`
- Implementada navegação client-side com `history.pushState`.
- Implementada Home com CTA, próximo jogo, ranking snapshot, feed recente e campeão após final.
- Implementada tela única de palpites com:
  - nome de exibição;
  - username;
  - busca por username;
  - pré-preenchimento;
  - agrupamento por rodada;
  - cards de partida;
  - validação de placar;
  - botão fixo de salvar;
  - revelação de palpites após kickoff.
- Implementadas páginas de ranking e feed.
- Adicionado `VITE_API_BASE_URL` para apontar o frontend para `https://api.psfes.space`.

### Worker/API

- Criado Worker Hono em `worker/src/index.ts`.
- Criadas rotas:
  - `GET /api/health`
  - `GET /api/matches`
  - `GET /api/sync/preview`
  - `GET /api/participants/:username`
  - `POST /api/predictions`
  - `GET /api/matches/:matchExternalId/predictions`
  - `GET /api/ranking`
  - `POST /api/ranking/recalculate`
  - `GET /api/feed`
- Criado cron via `scheduled()` para sync ESPN.
- Configurado custom domain `api.psfes.space` em `wrangler.toml`.

### Shared libs

- Criados tipos de domínio em `shared/types/domain.ts`.
- Criado parser ESPN em `shared/espn/parser.ts`.
- Criada lógica de pontuação em `shared/scoring/exact-score.ts`.
- Criados validators em `shared/validators/prediction.ts`.

### Banco de dados

- Criado schema Drizzle em `drizzle/schema.ts` com tabelas:
  - `participants`
  - `matches`
  - `predictions`
  - `feed_events`
- Criado `drizzle.config.ts` lendo `DATABASE_URL`.
- Runtime conectado ao banco via `worker/src/lib/db-store.ts`; `memory-store.ts` foi removido.

## Backlog de tasks

### P0 — Conectar PostgreSQL/Drizzle ao runtime

**Status:** Concluída.

**Objetivo:** substituir `worker/src/lib/memory-store.ts` por repositório persistente usando PostgreSQL/Drizzle.

**Critério de aceite:** palpites, participantes, partidas, ranking e feed sobrevivem a redeploy/restart do Worker.

**Evidência:** `worker/src/lib/db.ts` e `worker/src/lib/db-store.ts` implementam acesso PostgreSQL/Drizzle; `memory-store.ts` foi removido.

### P0 — Proteger endpoints administrativos

**Status:** Pendente.

**Objetivo:** proteger rotas administrativas como sync preview e recálculo manual.

**Critério de aceite:** chamadas não autenticadas para endpoints administrativos retornam `401` ou `403`.

### P0 — Configurar rate limit confiável

**Status:** Pendente.

**Objetivo:** substituir rate limit em memória por Cloudflare Rate Limiting, KV, Durable Object ou Redis.

**Critério de aceite:** `POST /api/predictions` limita salvamentos repetidos por IP sem depender de memória local do Worker.

### P0 — Corrigir responsividade mobile-first

**Status:** Pendente.

**Objetivo:** ajustar UI para funcionar sem overflow em 320px, 360px, 375px, 390px e 430px.

**Critério de aceite:** `/`, `/palpites`, `/ranking` e `/feed` não quebram em mobile, e o footer fixo não cobre ações/conteúdo.

### P1 — Separar `web/src/App.tsx` em componentes e páginas

**Status:** Pendente.

**Objetivo:** reduzir risco de regressão e facilitar ajustes visuais.

**Critério de aceite:** `App.tsx` fica responsável principalmente por roteamento/estado global; páginas e componentes ficam em arquivos próprios.

### P1 — Adicionar testes automatizados mínimos

**Status:** Pendente.

**Objetivo:** cobrir parser ESPN, validação de palpite, bloqueio por kickoff, scoring e ranking.

**Critério de aceite:** `npm run test:run` existe e passa em CI.

### P1 — Criar CI básico

**Status:** Pendente.

**Objetivo:** rodar typecheck, lint e build em PR/push.

**Critério de aceite:** GitHub Actions bloqueia merge quando `npm run typecheck`, `npm run lint` ou `npm run build` falham.

### P1 — Melhorar observabilidade de sync

**Status:** Pendente.

**Objetivo:** expor último sync, erro de sync, quantidade de jogos e status operacional.

**Critério de aceite:** `/api/health` ou endpoint admin mostra `lastSyncAt`, `lastSyncStatus` e `lastSyncError`.

### P1 — Criar checklist mobile/manual de QA

**Status:** Pendente.

**Objetivo:** documentar verificação manual antes de divulgar.

**Critério de aceite:** `docs/mobile-qa.md` existe com checklist por largura e página.

### P2 — Exibir versão/build no app

**Status:** Pendente.

**Objetivo:** facilitar validação de deploy em produção.

**Critério de aceite:** app mostra de forma discreta commit/build version ou expõe isso em uma área de diagnóstico.

## Registro de incidentes

### 2026-07-08 — Home exibindo erro de dados públicos

**Sintoma:** Home carregava, mas mostrava `Não foi possível carregar os dados públicos.`

**Causa provável:** frontend dependia de `/api/*` e do proxy do Pages/Worker. A integração com domínio final da API não estava suficientemente explícita.

**Correção aplicada:** frontend passou a usar `VITE_API_BASE_URL`, com fallback para `https://api.psfes.space`.

**Follow-up:** confirmar que Cloudflare Pages tem `VITE_API_BASE_URL=https://api.psfes.space` e que `https://api.psfes.space/api/health` responde corretamente.

## Comandos de validação usados até aqui

```bash
npm run typecheck
npm run build
npm run lint
npx wrangler deploy --dry-run
```

### 2026-07-09 — API captura o mata-mata completo a partir do Round of 32

**Decisão:** ampliar o escopo operacional da sincronização ESPN para incluir também o Round of 32, usando `ESPN_KNOCKOUT_DATES=20260628-20260719`.

**Motivo:** o app precisa conseguir capturar o histórico completo do mata-mata, não apenas Oitavas até Final. O escopo inicial filtrava `round_of_32` no parser e buscava somente `20260704-20260719`, então jogos anteriores do mata-mata não entravam no banco.

**Mudanças aplicadas:**

- `shared/types/domain.ts` agora inclui `round_of_32` em `MatchRound`.
- `shared/espn/parser.ts` agora reconhece `Round of 32` como rodada válida.
- `drizzle/schema.ts` e a migration `0001_sleepy_vapor.sql` adicionam o valor `round_of_32` ao enum `match_round`.
- `wrangler.toml` e `.env.example` passam a usar `20260628-20260719`.
- `web/src/App.tsx` exibe e ordena o Round of 32 antes das Oitavas.

**Nova task registrada:** validar em produção se `GET /api/sync/preview` retorna todos os jogos esperados do range `20260628-20260719` e se `GET /api/matches` persiste também os jogos do Round of 32.

### 2026-07-09 — Cloudflare Pages build não deve compilar testes/unit configs

**Decisão:** o `tsconfig.json` usado por `npm run build` passa a excluir arquivos `*.test.ts`, `*.test.tsx`, `vitest.config.ts` e o artefato legado `worker/src/lib/repository.ts`.

**Motivo:** o deploy do Cloudflare Pages roda `tsc -p tsconfig.json --noEmit` antes do Vite build. Esse comando estava tentando compilar testes e arquivos legados que não fazem parte do runtime de produção, gerando erros de tipos de Vitest e de código antigo.

**Mudanças aplicadas:**

- `tsconfig.json` ganhou `exclude` para testes/config de Vitest e repository legado.
- `worker/src/lib/db.ts` exporta `Database` como alias de compatibilidade para código legado que ainda importe esse tipo.
- `worker/src/lib/env.ts` declara `ADMIN_TOKEN` opcional para middleware/admin legado não quebrar typecheck se presente no deploy.

**Nova task registrada:** separar futuramente `tsconfig.app.json` e `tsconfig.test.json`, para manter build de produção e typecheck de testes com responsabilidades claras.
