-- =====================================================
-- Leona Projetos — Migration Consolidada
-- Cria toda a estrutura do banco de dados
-- =====================================================

-- 1. Profiles (membros da equipe)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp TEXT,
    cargo TEXT,
    role TEXT NOT NULL DEFAULT 'operacao' CHECK (role IN ('admin', 'operacao')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Boards (projetos)
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    created_by UUID REFERENCES public.profiles(id),
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Board Columns (colunas do Kanban)
CREATE TABLE IF NOT EXISTS public.board_columns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT DEFAULT '#7c3aed',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tasks (tarefas)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
    column_id UUID REFERENCES public.board_columns(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
    task_type TEXT,
    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    position INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Task Attachments (anexos/imagens)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Task Comments (comentários)
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON public.tasks(board_id, column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_board_columns_board ON public.board_columns(board_id);

-- =====================================================
-- TRIGGERS: Auto-create profile on auth.users insert
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGERS: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at
    BEFORE UPDATE ON public.boards
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER update_task_comments_updated_at
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: todos autenticados podem ler
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);

-- Boards: todos autenticados podem ler e criar
DROP POLICY IF EXISTS "boards_select" ON public.boards;
CREATE POLICY "boards_select" ON public.boards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boards_insert" ON public.boards;
CREATE POLICY "boards_insert" ON public.boards FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "boards_update" ON public.boards;
CREATE POLICY "boards_update" ON public.boards FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "boards_delete" ON public.boards;
CREATE POLICY "boards_delete" ON public.boards FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Board Columns: todos autenticados
DROP POLICY IF EXISTS "columns_select" ON public.board_columns;
CREATE POLICY "columns_select" ON public.board_columns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "columns_insert" ON public.board_columns;
CREATE POLICY "columns_insert" ON public.board_columns FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "columns_update" ON public.board_columns;
CREATE POLICY "columns_update" ON public.board_columns FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "columns_delete" ON public.board_columns;
CREATE POLICY "columns_delete" ON public.board_columns FOR DELETE TO authenticated USING (true);

-- Tasks: todos autenticados
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Task Attachments
DROP POLICY IF EXISTS "attachments_select" ON public.task_attachments;
CREATE POLICY "attachments_select" ON public.task_attachments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attachments_insert" ON public.task_attachments;
CREATE POLICY "attachments_insert" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attachments_delete" ON public.task_attachments;
CREATE POLICY "attachments_delete" ON public.task_attachments FOR DELETE TO authenticated USING (true);

-- Task Comments
DROP POLICY IF EXISTS "comments_select" ON public.task_comments;
CREATE POLICY "comments_select" ON public.task_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert" ON public.task_comments;
CREATE POLICY "comments_insert" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "comments_update" ON public.task_comments;
CREATE POLICY "comments_update" ON public.task_comments FOR UPDATE TO authenticated
    USING (author_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete" ON public.task_comments;
CREATE POLICY "comments_delete" ON public.task_comments FOR DELETE TO authenticated
    USING (author_id = auth.uid());

-- =====================================================
-- STORAGE: Criar bucket task-attachments
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'task-attachments',
    'task-attachments',
    true,
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
CREATE POLICY "storage_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
CREATE POLICY "storage_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'task-attachments');
