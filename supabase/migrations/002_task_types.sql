-- =====================================================
-- 002: Task Types — Tabela de tipos de tarefa editáveis
-- =====================================================

CREATE TABLE IF NOT EXISTS public.task_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT '📌',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_types_name ON public.task_types(name);

-- RLS
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_types_select" ON public.task_types;
CREATE POLICY "task_types_select" ON public.task_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_types_insert" ON public.task_types;
CREATE POLICY "task_types_insert" ON public.task_types FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "task_types_update" ON public.task_types;
CREATE POLICY "task_types_update" ON public.task_types FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "task_types_delete" ON public.task_types;
CREATE POLICY "task_types_delete" ON public.task_types FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed com tipos padrão
INSERT INTO public.task_types (name, color, icon) VALUES
    ('Feature', '#22c55e', '✨'),
    ('Bug', '#ef4444', '🐛'),
    ('Melhoria', '#3b82f6', '⬆️'),
    ('Documentação', '#f59e0b', '📄'),
    ('Design', '#ec4899', '🎨'),
    ('Infraestrutura', '#8b5cf6', '⚙️'),
    ('Pesquisa', '#06b6d4', '🔍'),
    ('Outro', '#6b7280', '📌')
ON CONFLICT (name) DO NOTHING;
