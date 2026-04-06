# Woli Pixel — Guia de Deploy

> Deploy completo do Woli Pixel (API + Web + PostgreSQL) no Railway em ~30 minutos.

## Pré-requisitos

- Conta no [Railway](https://railway.app) (plano gratuito funciona para o hackathon)
- Repositório GitHub com o código do Woli Pixel
- Conta AWS com um bucket S3 criado (região recomendada: `sa-east-1`)
- Chave da API OpenAI com acesso ao `gpt-4.1-mini` e `gpt-image-1`
- (Opcional) Conta no Resend para e-mails transacionais
- (Opcional) Projeto no Google Cloud para login via OAuth

---

## Visão Geral da Arquitetura

```
+-------------+     +-------------+     +--------------+
|  Web (SPA)  |---->|  API (Bun)  |---->|  PostgreSQL  |
|  Vite build |     |  Hono + S3  |     |  (Railway)   |
+-------------+     +-------------+     +--------------+
    Estatico             :3000              :5432
```

- **API**: Runtime Bun + framework Hono. Exporta `{ port, fetch }` — Railway detecta automaticamente via `bun.lock`.
- **Web**: SPA Vite. `bun run build` gera arquivos estáticos em `dist/`.
- **Banco**: PostgreSQL gerenciado no Railway. `DATABASE_URL` é injetado automaticamente.

---

## Passo 1: Deploy do PostgreSQL

1. Abra o painel do seu projeto no Railway
2. Clique em **"New"** > **"Database"** > **"PostgreSQL"**
3. O Railway provisiona o banco e gera a `DATABASE_URL`
4. Nota: o Railway injeta automaticamente a `DATABASE_URL` nos serviços conectados ao mesmo projeto

---

## Passo 2: Deploy do Serviço API

1. Clique em **"New"** > **"GitHub Repo"** > selecione o repositório
2. Configure o serviço:
   - **Root Directory**: `apps/api`
   - **Build Command**: `bun install`
   - **Start Command**: `bun run start`
3. O Railway detecta o `bun.lock` e usa o runtime Bun automaticamente
4. Configure as variáveis de ambiente (veja o [Passo 4](#passo-4-configurar-variáveis-de-ambiente))
5. Endpoint de health check: `GET /api/v1/health` — retorna `{ "status": "ok", "timestamp": "...", "version": "0.1.0" }`

### Comando de Start alternativo

Se o Railway não detectar o entry point, configure:

```
bun run src/index.ts
```

O servidor usa a porta de `process.env.PORT` (injetada automaticamente pelo Railway).

---

## Passo 3: Deploy do Frontend Web

### Opção A: Site Estático (Recomendado)

1. Clique em **"New"** > **"GitHub Repo"** > selecione o repositório
2. Configure:
   - **Root Directory**: `apps/web`
   - **Build Command**: `bun install && bun run build`
   - **Output Directory**: `dist`
3. Defina a variável de ambiente:
   - `VITE_API_URL` = URL do serviço API + `/api/v1` (ex: `https://woli-pixel-api.up.railway.app/api/v1`)

> **Importante**: Variáveis `VITE_` são incorporadas no build, não em runtime. Defina-as antes do build rodar.

### Opção B: Nixpacks (serve com preview server)

1. Mesma configuração da Opção A, mas defina:
   - **Start Command**: `bun run preview -- --host 0.0.0.0 --port $PORT`
2. Usa o preview server do Vite — adequado para demo do hackathon, não recomendado para produção

---

## Passo 4: Configurar Variáveis de Ambiente

Configure estas variáveis nas configurações do **serviço API** no Railway.

> **Nota**: `DATABASE_URL` e `PORT` são injetadas automaticamente pelo Railway ao vincular o Postgres. Não configure manualmente.

**Variáveis obrigatórias (você deve configurar):**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Definir como `production` | `production` |
| `OPENAI_API_KEY` | Chave da API OpenAI | `sk-proj-...` |
| `AWS_REGION` | Região do S3 na AWS | `sa-east-1` |
| `AWS_ACCESS_KEY_ID` | Chave de acesso IAM da AWS | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Chave secreta IAM da AWS | `wJal...` |
| `S3_BUCKET` | Nome do bucket S3 | `woli-pixel-uploads` |
| `BETTER_AUTH_SECRET` | Segredo de autenticação (gere com `npx @better-auth/cli secret`) | String aleatória de 32+ caracteres |
| `BETTER_AUTH_URL` | URL pública da API | `https://woli-pixel-api.up.railway.app` |
| `CORS_ORIGIN` | URL(s) do frontend, separadas por vírgula | `https://woli-pixel-web.up.railway.app` |
| `TRUSTED_ORIGINS` | Igual ao CORS_ORIGIN — usado pelo better-auth | `https://woli-pixel-web.up.railway.app` |

**Variáveis opcionais:**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `UPLOAD_DIR` | Diretório de upload local (fallback, S3 é primário) | `./uploads` |
| `MAX_FILE_SIZE_MB` | Tamanho máximo de upload (padrão: 10) | `10` |
| `ANTHROPIC_API_KEY` | Chave de API Anthropic (fallback) | `sk-ant-api03-...` |
| `BFL_API_KEY` | Chave da API do provedor Flux (geração de imagens) | `bfl-...` |
| `RECRAFT_API_KEY` | Chave da API do provedor Recraft (geração de imagens) | `recraft-...` |
| `GOOGLE_CLIENT_ID` | ID do cliente Google OAuth | `123...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente Google OAuth | `GOCSPX-...` |
| `RESEND_API_KEY` | Chave da API Resend (e-mail) | `re_...` |
| `RESEND_FROM_EMAIL` | Endereço de e-mail remetente | `noreply@woli.com.br` |

Configure esta variável nas configurações do **serviço Web**:

| Variável | Obrigatória | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `VITE_API_URL` | Sim | URL base da API com sufixo `/api/v1` | `https://woli-pixel-api.up.railway.app/api/v1` |

---

## Passo 5: Executar Migrations e Seed

Após o serviço API ser deployado com sucesso:

1. Abra o serviço API no Railway
2. Vá para a aba **"Settings"** > seção **"Deploy"**
3. Use o executor de comandos do Railway ou conecte via Railway CLI:

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Vincular ao seu projeto
railway link

# Executar migrations
railway run --service api bun run db:migrate

# Semear os 19 presets de tipos de imagem
railway run --service api bun run db:seed
```

Alternativamente, adicione um hook de deploy no Railway:

- **Deploy Command**: `bun run db:migrate && bun run db:seed && bun run start`

> **Nota**: `db:seed` é idempotente — seguro executar a cada deploy.

---

## Passo 6: Verificar

1. **Health check**: `curl https://sua-api-url.up.railway.app/api/v1/health`
   ```json
   { "status": "ok", "timestamp": "2026-04-07T...", "version": "0.1.0" }
   ```

2. **Tipos de imagem**: `curl https://sua-api-url.up.railway.app/api/v1/image-types`
   - Deve retornar 19 presets em 4 categorias

3. **App web**: Abra a URL do frontend no navegador
   - Registro e login devem funcionar
   - Pipeline de upload e análise de imagens deve funcionar de ponta a ponta

4. **Conectividade S3**: Faça upload de uma imagem pelo app — verifique se aparece no seu bucket S3

---

## Resolução de Problemas

| Problema | Solução |
|----------|---------|
| `bun: command not found` | Verifique se o Railway detecta o `bun.lock` no diretório raiz/serviço |
| Erros de CORS no navegador | Verifique se `CORS_ORIGIN` corresponde à URL exata do frontend (sem barra final) |
| Cookies de auth não funcionam | Verifique se `BETTER_AUTH_URL` e `TRUSTED_ORIGINS` correspondem ao domínio da API |
| Upload S3 falha | Verifique permissões IAM: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` no bucket |
| Migrations falham | Verifique se `DATABASE_URL` está definida e o Postgres está rodando |
| Erro de redirect Google OAuth | Adicione a URL da API no Railway às URIs de redirecionamento no Google Cloud Console |

---

## Alternativa: Render.com

Se o Railway não estiver disponível, [Render](https://render.com) é uma boa alternativa:

1. **PostgreSQL**: Crie uma instância gerenciada (plano gratuito: 90 dias)
2. **API**: Crie um **Web Service**
   - Runtime: **Docker** (Render não suporta Bun nativamente — use um `Dockerfile`)
   - Adicione um `Dockerfile` em `apps/api/`:
     ```dockerfile
     FROM oven/bun:1
     WORKDIR /app
     COPY package.json bun.lock ./
     RUN bun install --production
     COPY . .
     EXPOSE 3000
     CMD ["bun", "run", "start"]
     ```
   - Adicione um `.dockerignore` em `apps/api/` com: `node_modules`, `uploads/`, `.env`, `*.test.ts`
3. **Web**: Crie um **Static Site**
   - Build Command: `cd apps/web && bun install && bun run build`
   - Publish Directory: `apps/web/dist`
4. Variáveis de ambiente: mesmas do Railway (configure manualmente no painel do Render)
5. Migrations: execute via Render Shell ou adicione ao comando de build da API

### Diferenças-chave do Railway

| Recurso | Railway | Render |
|---------|---------|--------|
| Suporte Bun | Nativo (auto-detectado) | Docker necessário |
| Postgres | Gerenciado, `DATABASE_URL` auto-injetada | Gerenciado, string de conexão manual |
| Velocidade de deploy | ~1-2 min | ~3-5 min |
| Plano gratuito | $5 crédito/mês | 750 horas/mês + 90 dias Postgres |
| Sites estáticos | Integrado | Integrado |

---

## Checklist de Segurança

Antes da demo do hackathon:

- [ ] `BETTER_AUTH_SECRET` é um valor aleatório forte (não o padrão)
- [ ] `NODE_ENV=production` está configurado
- [ ] Bucket S3 não é acessível publicamente (usa URLs pré-assinadas)
- [ ] `CORS_ORIGIN` está restrito apenas ao domínio do frontend
- [ ] Chaves de API OpenAI/Anthropic têm limites de billing configurados
- [ ] URIs de redirecionamento Google OAuth estão restritas ao seu domínio
