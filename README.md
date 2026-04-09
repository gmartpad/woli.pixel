# Woli Pixel — Curadoria Digital de Imagens com IA

> **Hackathon IA — Woli TI 2026** | 01/04 a 08/04/2026

Plataforma inteligente de curadoria, processamento e geração de imagens para o ecossistema Woli. O Woli Pixel resolve um problema real da operação: a plataforma Woli possui **19 tipos de imagem** diferentes (logos, fundos, ícones, avatares, badges, banners, etc.), cada um com dimensões, formatos e tamanhos específicos. Hoje, preparar essas imagens é um processo manual, repetitivo e propenso a erros.

O Woli Pixel automatiza todo esse fluxo com **validação por IA, processamento inteligente com Sharp e geração de imagens por modelos de IA**, entregando imagens prontas para uso na plataforma com um clique.

---

## Funcionalidades

### 1. Processar Imagem (Upload + Análise IA + Processamento)

Pipeline completo de validação e otimização de imagens:

- **Upload** com validação de formato, tamanho e dimensões
- **Análise por IA** (GPT-4.1-mini vision) — avalia qualidade, composição, adequação ao contexto educacional e atribui uma nota de 0-10
- **Classificação automática** (GPT-4.1-nano) — identifica qual dos 19 presets a imagem melhor se encaixa
- **Processamento com Sharp** — redimensionamento inteligente, conversão de formato, otimização de tamanho, remoção de fundo (quando necessário)
- **Download** no formato desejado (JPEG, PNG, WebP)

### 2. Processamento em Lote (Batch)

- Upload de múltiplas imagens de uma vez
- Análise IA individual para cada imagem do lote
- Processamento paralelo com `Promise.allSettled`
- Download em ZIP de todas as imagens processadas
- Suporte a recorte individual de imagens antes do processamento

### 3. Geração de Imagens por IA

- **2 modelos especializados**:
  - **Recraft V3** — design assets, logos, ícones (via Fal AI)
  - **FLUX.2 Pro** — fundos, capas, conteúdo fotorrealista (via Fal AI)
- **3 tiers de qualidade**: Rascunho, Padrão e Alta Qualidade
- Seleção automática de modelo com base no preset
- **Resolução personalizada** com dimensões livres
- **Presets customizados** salvos pelo usuário
- **Moderação de prompts** — prompts são analisados antes da geração; quando rejeitados, o sistema sugere uma versão adequada
- Download com conversão de formato em tempo real

### 4. Recorte Inteligente

- Ferramenta de recorte com aspect ratio livre ou fixo por preset
- Preview em tempo real
- Histórico de recortes salvo no servidor

### 5. Histórico Unificado

- Linha do tempo de todos os uploads, gerações e recortes
- **Filtros avançados**: por modo (Upload/Geração/Recorte), período, categoria, modelo, qualidade, busca textual
- **Agrupamento por data** (Hoje, Ontem, datas anteriores)
- Lightbox com zoom e comparação lado a lado
- **Ações em lote**: seleção múltipla, exclusão em massa, download em ZIP
- Renomear itens diretamente na interface

### 6. Perfis de Marca (Brand Profiles)

- Cadastro de paleta de cores da marca
- Validação automática de aderência de imagens à identidade visual

### 7. Autenticação Completa

- Cadastro, login e logout com **Better Auth**
- Verificação de email (via Resend)
- Recuperação de senha
- Gerenciamento de avatar com histórico de versões
- Página de configurações do perfil e segurança

---

## Arquitetura

```
woli.pixel/
├── apps/
│   ├── api/                 # Backend — Bun + Hono + Drizzle + PostgreSQL
│   │   └── src/
│   │       ├── db/          # Schema Drizzle (14 tabelas) + migrations + seed
│   │       ├── routes/      # 13 módulos de rotas (REST API)
│   │       ├── services/    # Lógica de negócio (IA, Sharp, S3, validadores)
│   │       │   └── providers/  # Provedores de geração (Flux, Recraft)
│   │       ├── middleware/  # Auth, CORS, webhooks
│   │       └── lib/         # Utilitários (S3 client, ZIP, auth config)
│   └── web/                 # Frontend — React 19 + Vite 6 + TailwindCSS 4
│       └── src/
│           ├── components/  # Componentes por feature (12 domínios)
│           ├── stores/      # Zustand stores (7 domínios)
│           ├── hooks/       # Custom hooks reutilizáveis
│           ├── lib/         # API client, utilitários, auth
│           └── test/        # Setup e helpers de teste
└── plans/                   # Documentos de design de features
```

### Pipeline de IA (Duas Etapas)

```
Imagem do Usuário
       │
       ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  GPT-4.1-mini    │────▶│  GPT-4.1-nano    │────▶│     Sharp        │
│  (Vision)        │     │  (Classificação) │     │  (Processamento) │
│                  │     │                  │     │                  │
│ Analisa:         │     │ Classifica em    │     │ Redimensiona,    │
│ - Qualidade      │     │ 1 dos 19 presets │     │ converte formato,│
│ - Composição     │     │ com nota de      │     │ otimiza tamanho, │
│ - Adequação      │     │ confiança        │     │ remove fundo     │
│ - Nota 0-10      │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Pipeline de Geração

```
Prompt do Usuário
       │
       ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Moderação       │────▶│  Recraft V3 ou   │────▶│     Sharp        │
│  (Validação do   │     │  FLUX.2 Pro      │     │  (Pós-process.)  │
│   prompt)        │     │  (via Fal AI)    │     │                  │
│                  │     │                  │     │ Resize para      │
│ Rejeita prompts  │     │ Gera imagem na   │     │ dimensões do     │
│ inadequados e    │     │ resolução OpenAI │     │ preset alvo      │
│ sugere correção  │     │ mais próxima     │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## Stack Tecnológica

### Backend

| Tecnologia | Versão | Função |
|---|---|---|
| **Bun** | Runtime | Runtime JavaScript/TypeScript, 2-3x mais rápido que Node.js |
| **Hono** | ^4.7 | Framework web type-safe, WebStandard API |
| **Drizzle ORM** | ^0.40 | ORM SQL-first com tipagem forte |
| **PostgreSQL** | 16 | Banco de dados relacional |
| **Sharp** | ^0.33 | Processamento de imagens (resize, crop, conversão) |
| **OpenAI SDK** | ^5.0 | Análise de imagens (GPT-4.1-mini vision) e classificação (GPT-4.1-nano) |
| **Anthropic SDK** | ^0.39 | Integração com Claude para análise de qualidade |
| **Fal AI** | ^1.9 | Provedores de geração (Recraft V3, FLUX.2 Pro) |
| **AWS S3** | ^3.1024 | Armazenamento de imagens |
| **Better Auth** | ^1.5 | Autenticação (signup, login, email verification, password reset) |
| **Resend** | ^6.10 | Envio de emails transacionais |
| **Zod** | ^3.24 | Validação de schemas |

### Frontend

| Tecnologia | Versão | Função |
|---|---|---|
| **React** | ^19.0 | Framework de UI com React Compiler |
| **Vite** | 6 | Build tool e dev server |
| **TailwindCSS** | 4 | CSS-first utility framework com `@theme` |
| **Zustand** | ^5.0 | State management (7 stores por domínio) |
| **TanStack Query** | ^5.62 | Gerenciamento de estado de servidor |
| **TypeScript** | ^5.7 | Tipagem estrita com `strict: true` |
| **react-easy-crop** | ^5.5 | Componente de recorte de imagem |
| **Sonner** | ^2.0 | Toasts/notificações |

### Testes

| Ferramenta | Escopo | Arquivos |
|---|---|---|
| **bun:test** | Backend (routes, services, middleware) | 25 arquivos |
| **Vitest** + **React Testing Library** | Frontend (components, stores, hooks) | 75 arquivos |
| **PGlite** | PostgreSQL in-process para testes de DB | — |
| **aws-sdk-client-mock** | Mock de operações S3 | — |

**Total: ~100 arquivos de teste colocados junto ao código-fonte (TDD)**

---

## 19 Presets de Imagem

| Categoria | Preset | Dimensões | Formato |
|---|---|---|---|
| **Admin/Branding** | Logo Topo (Desktop) | Variável | PNG |
| | Logo Relatórios | Variável | PNG |
| | Fundo Login Desktop | 1600×900 | JPEG/PNG |
| | Fundo Login Mobile | 375×820 | JPEG/PNG |
| | Ícone Pílula (Notificação) | 72×72 | PNG |
| | Favicon | 128×128 | PNG |
| | Testeira de Email | 600×100 | PNG |
| | Logo App (Interna) | Variável | PNG |
| | Logo Dispersão | 27×27 | PNG |
| **Conteúdo** | Imagem de Conteúdo | 1920×1080 | JPEG/PNG/WebP |
| | Capa Workspace | 300×300 | JPEG/PNG |
| | Fundo Workspace | 1920×1080 | JPEG/PNG |
| | Ícone de Curso | 256×256 | JPEG |
| **Usuário** | Foto do Aluno | 256×256 | JPEG/PNG |
| **Gamificação** | Badge de Conquista | 128×128 | PNG |
| | Medalha de Ranking | 96×96 | PNG |
| | Ícone de Recompensa | 200×200 | PNG |
| | Banner de Campanha | 1200×300 | JPEG/PNG |
| | Avatar Personagem | 256×256 | PNG |

---

## Como Executar

### Pré-requisitos

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL 16+ (local ou container)
- Chaves de API: OpenAI, Fal AI, AWS S3, Resend

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd woli.pixel
```

### 2. Instalar dependências

```bash
cd apps/api && bun install
cd ../web && bun install
```

### 3. Configurar variáveis de ambiente

**Backend** (`apps/api/.env`):

```env
PORT=3000
DATABASE_URL=postgresql://woli:woli_pixel_2026@localhost:5433/woli_pixel
OPENAI_API_KEY=sk-proj-...
FAL_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_REGION=...
RESEND_API_KEY=re_...
BETTER_AUTH_SECRET=...
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`apps/web/.env`):

```env
VITE_API_URL=http://localhost:3000/api/v1
```

### 4. Preparar o banco de dados

```bash
cd apps/api
bun run db:push        # Cria as tabelas
bun run db:seed        # Popula os 19 presets de imagem
```

### 5. Iniciar os servidores

```bash
# Terminal 1 — Backend (porta 3000)
cd apps/api && bun run dev

# Terminal 2 — Frontend (porta 5173)
cd apps/web && bun run dev
```

Acesse **http://localhost:5173** no navegador.

### 6. Executar os testes

```bash
# Backend
cd apps/api && bun test

# Frontend
cd apps/web && bunx vitest run
```

---

## Deploy em Produção

A aplicação está hospedada no **Railway**:

- **Frontend:** https://wolipixelweb.up.railway.app
- **Backend:** https://wolipixel-production.up.railway.app

---

## Screenshots

> As capturas abaixo demonstram o protótipo funcional em ambos os temas (claro e escuro).

### Tela de Histórico — Tema Escuro

![Histórico Dark](docs/screenshots/historico-dark.png)

### Tela de Histórico — Tema Claro

![Histórico Light](docs/screenshots/historico-light.png)

### Geração de Imagens — Seleção de Preset e Qualidade

![Geração](docs/screenshots/geracao.png)

### Processamento de Imagem — Análise IA

![Processamento](docs/screenshots/processamento.png)

> **Nota:** Adicione screenshots reais na pasta `docs/screenshots/` para substituir os placeholders acima.

---

## Uso de IA no Projeto

A Inteligência Artificial é usada em **três dimensões** neste projeto:

### 1. IA no Produto (Core da Solução)

- **Análise de qualidade de imagens** — GPT-4.1-mini (vision) avalia composição, resolução, adequação e atribui score
- **Classificação automática de preset** — GPT-4.1-nano identifica o tipo correto entre 19 possibilidades
- **Geração de imagens** — Recraft V3 e FLUX.2 Pro criam imagens otimizadas por preset
- **Moderação de prompts** — Análise de conteúdo antes da geração, com sugestão de prompt alternativo
- **Validação de marca** — Análise de aderência de cores à identidade visual

### 2. IA no Desenvolvimento

- **Claude Code** como assistente de programação durante toda a sprint de 7 dias
- **TDD assistido por IA** — Claude auxiliou na escrita de testes e implementação seguindo Red-Green-Refactor
- **Debug e otimização** — Resolução de problemas cross-browser (Safari ITP, CORS S3) com assistência de IA

### 3. IA na Arquitetura de Decisões

- **Pipeline de dois modelos** — usar GPT-4.1-mini apenas para vision e GPT-4.1-nano para texto reduz custos em ~60%
- **Seleção automática de modelo de geração** — Recraft V3 para assets vetoriais, FLUX.2 Pro para fotorrealismo
- **Structured outputs com Zod** — Respostas de IA sempre validadas contra schema tipado

---

## Equipe

| Integrante | Setor |
|---|---|
| **Gabriel Martins Padoin** | TI (Desenvolvimento) |
| **Anna Claudia de Carvalho** | Woli Labs |

---

## Problema e Impacto

### O Problema

A plataforma Woli utiliza 19 tipos de imagem com especificações diferentes. Hoje, a equipe de conteúdo:

1. Recebe ou cria a imagem no tamanho errado
2. Abre um editor (Photoshop, Canva) para redimensionar manualmente
3. Não tem certeza se a qualidade é adequada
4. Exporta no formato incorreto
5. Precisa refazer quando a imagem não se encaixa no layout

**Resultado:** Horas desperdiçadas por semana em tarefas repetitivas, imagens inconsistentes na plataforma e gargalo na produção de conteúdo.

### A Solução

O Woli Pixel elimina todo o trabalho manual:

- **Upload → Análise → Processamento → Download** em segundos
- **Geração por IA** quando não há imagem disponível
- **Qualidade garantida** por validação automatizada
- **Batch processing** para volumes grandes
- **Histórico completo** para rastreabilidade

### Impacto Mensurável

- Redução de **~80% do tempo** gasto em preparação de imagens
- **Zero erros de especificação** — o sistema garante dimensões, formato e tamanho corretos
- **Padronização visual** da plataforma inteira
- **Autonomia** para equipe de conteúdo sem depender de TI para ajustes de imagem
