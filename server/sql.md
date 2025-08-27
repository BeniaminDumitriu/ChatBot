-- Rulează aceste comenzi în SQL editorul Supabase

-- 1) Tabelul conversations (dacă nu există)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_message text not null,
  ai_reply text not null,
  timestamp timestamptz not null default now(),
  ip text,
  session_id text
);

-- 2) Indexuri pentru rate limit (IP + lună)
create index if not exists conversations_ip_idx on public.conversations (ip);
create index if not exists conversations_timestamp_idx on public.conversations (timestamp);
create index if not exists conversations_session_idx on public.conversations (session_id);



-- 3) RAG: documente + embeddings + funcție RPC pentru similaritate
create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  url text not null,
  content text not null,
  embedding vector(384),
  created_at timestamptz not null default now()
);

create index if not exists documents_site_idx on public.documents (site_id);
create index if not exists documents_url_idx on public.documents (url);
create index if not exists documents_created_idx on public.documents (created_at);

-- RPC: match_documents(query_embedding, match_count, filter_site_id)
create or replace function public.match_documents(
  query_embedding vector(384),
  match_count int,
  filter_site_id text
) returns table (
  id uuid,
  site_id text,
  url text,
  content text,
  similarity float
) language sql stable as $$
  select d.id, d.site_id, d.url, d.content,
         1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where (filter_site_id is null or d.site_id = filter_site_id)
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

