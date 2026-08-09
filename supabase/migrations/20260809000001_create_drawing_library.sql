-- Migration: Create drawing library tables for completed logo drawings and votes
-- Scope: production-grade schema with RLS, indexes, and updated_at handling

-- 1. Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drawings table: stores completed logo drawings from game sessions
CREATE TABLE IF NOT EXISTS public.drawings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    logo_slug text NOT NULL,
    room_id text NOT NULL,

    -- Drawer info (anonymous or authenticated)
    drawer_id text,
    drawer_metadata jsonb NOT NULL DEFAULT '{}',

    -- Drawing data
    strokes jsonb NOT NULL DEFAULT '[]',
    preview_path text, -- optional Supabase Storage path

    -- Quality / similarity signals
    similarity_score numeric CHECK (similarity_score IS NULL OR (similarity_score >= 0 AND similarity_score <= 1)),
    quality_score numeric CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),

    -- Moderation & curation
    curation_status text NOT NULL DEFAULT 'pending',
    moderation_flags jsonb NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT drawings_curation_status_check
        CHECK (curation_status IN ('pending', 'approved', 'rejected', 'featured'))
);

-- 3. Votes table: one vote per voter per drawing (+1 or -1)
CREATE TABLE IF NOT EXISTS public.votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    drawing_id uuid NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
    voter_id text NOT NULL,

    vote_value smallint NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Uniqueness: one vote per voter per drawing
    CONSTRAINT votes_unique_per_voter UNIQUE (drawing_id, voter_id),
    CONSTRAINT votes_value_check CHECK (vote_value IN (-1, 1))
);

-- 4. Indexes for read performance
CREATE INDEX IF NOT EXISTS idx_drawings_logo_slug ON public.drawings(logo_slug);
CREATE INDEX IF NOT EXISTS idx_drawings_room_id ON public.drawings(room_id);
CREATE INDEX IF NOT EXISTS idx_drawings_curation_status ON public.drawings(curation_status);
CREATE INDEX IF NOT EXISTS idx_drawings_created_at ON public.drawings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drawings_updated_at ON public.drawings(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_drawing_id ON public.votes(drawing_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON public.votes(voter_id);

-- 5. Updated-at trigger (avoids extra extension dependency)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_drawings_updated_at ON public.drawings;
CREATE TRIGGER trg_drawings_updated_at
    BEFORE UPDATE ON public.drawings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 6. Row Level Security (RLS)
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Public read-only for approved and featured drawings
CREATE POLICY "Public read approved and featured drawings"
    ON public.drawings
    FOR SELECT
    TO anon, authenticated
    USING (curation_status IN ('approved', 'featured'));

-- Public read-only votes on approved and featured drawings (join-side safety)
CREATE POLICY "Public read votes on approved and featured drawings"
    ON public.votes
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.drawings d
            WHERE d.id = votes.drawing_id
              AND d.curation_status IN ('approved', 'featured')
        )
    );

-- No direct writes for anonymous or authenticated users (server-side service role will write later)
CREATE POLICY "No direct inserts on drawings"
    ON public.drawings
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

CREATE POLICY "No direct updates on drawings"
    ON public.drawings
    FOR UPDATE
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "No direct deletes on drawings"
    ON public.drawings
    FOR DELETE
    TO anon, authenticated
    USING (false);

CREATE POLICY "No direct inserts on votes"
    ON public.votes
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

CREATE POLICY "No direct updates on votes"
    ON public.votes
    FOR UPDATE
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "No direct deletes on votes"
    ON public.votes
    FOR DELETE
    TO anon, authenticated
    USING (false);
