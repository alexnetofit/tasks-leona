# Leona Projetos — Contexto & Boas Práticas

## Visão Geral
Plataforma de gestão de tarefas PWA inspirada no Notion, com tema 100% dark e cor primária roxo.

## Stack Tecnológica
- **Frontend**: React 19 + Vite + TypeScript
- **UI Library**: Mantine v8 (dark theme)
- **Editor de Texto**: TipTap (com extensão de imagem)
- **Drag & Drop**: dnd-kit (Kanban)
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime, Edge Functions)
- **PWA**: vite-plugin-pwa

## Supabase Project
- **URL**: https://hxunmqqexdvjocpnphqq.supabase.co
- **Project Ref**: hxunmqqexdvjocpnphqq
- **Region**: (verificar no dashboard)

## Padrões de Desenvolvimento

### 1. Código
- TypeScript estrito (sem `any` quando possível)
- Componentes < 300 linhas
- Hooks < 150 linhas
- Services < 400 linhas
- Naming: PascalCase (componentes), camelCase (hooks/services), UPPER_SNAKE_CASE (constantes)

### 2. Banco de Dados
- Migrations sequenciais em `supabase/migrations/`
- RLS obrigatório em todas as tabelas
- Triggers para `updated_at` automático
- UUID como primary key (`gen_random_uuid()`)
- Soft-delete (campo `is_active`) ao invés de hard-delete

### 3. Supabase Patterns
- `.maybeSingle()` ao invés de `.single()` para queries que podem não retornar resultado
- Silent Delete mitigation: `.delete().select('id')` para verificar se a deleção ocorreu
- Bridge Cast Pattern para joins: `(item as unknown) as TargetType`
- Date handling: `new Date(isoString)` para Mantine, `.toISOString()` para Supabase

### 4. Design
- Tema 100% dark (#191919 background)
- Cor primária: Violet/Roxo (#7c3aed)
- Fonte: Inter (Google Fonts)
- Border-radius suave (8px padrão)
- Transições suaves (200ms ease)
- Contraste acessível (WCAG AA)

### 5. Deploy
- **NUNCA** deploy automático
- Sempre verificar build antes: `npm run build`
- Solicitar autorização explícita do usuário

### 6. Supabase CLI
- Login: `npx supabase login`
- Link: `npx supabase link --project-ref hxunmqqexdvjocpnphqq`
- Migrations: `npx supabase db push`
- Edge Functions: `npx supabase functions deploy <name>`
- Secrets: `npx supabase secrets set KEY=value`

## Features Supabase em Uso
- **Auth**: Email/password login (sem self-registration)
- **Storage**: Bucket `task-attachments` para imagens do editor
- **Realtime**: Sync do Kanban entre usuários
- **RLS**: Segurança por role (admin/operacao)
- **Triggers**: Auto-create profile, auto-update timestamps
- **Edge Functions**: (Futuro) Notificações, webhooks
- **pg_cron**: (Futuro) Alertas de prazo, limpeza de dados
