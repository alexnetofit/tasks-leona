-- =====================================================
-- 003: Adicionar campo color nas tasks
-- =====================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS color TEXT;
