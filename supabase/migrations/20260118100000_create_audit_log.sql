-- Create Audit Log Table
-- Created: 2026-01-18

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,         -- e.g. 'delete_board', 'update_role'
    target_id TEXT,               -- e.g. Board ID or User ID affected
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT               -- Optional, set by backend if available
);

-- 2. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 4. Policies

-- Policy: Authenticated users can INSERT (log their own actions)
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = actor_id);

-- Policy: Only Admins can VIEW logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: NO ONE can DATE or DELETE logs (Immutable Audit Trail)
-- (No policies for UPDATE or DELETE effectively denies these actions)

-- 5. Notify Reload
NOTIFY pgrst, 'reload schema';
