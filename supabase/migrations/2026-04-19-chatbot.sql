-- Chatbot Multiwex — mode FAQ gratuit (sans API IA)
-- Tables : chat_faq, chat_conversations, chat_messages
-- Phase 1 : FAQ-only matching (keywords + fuzzy). Pas de pgvector ni IA.

create table if not exists chat_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  keywords text[] not null default '{}',
  answer text not null,
  category text,
  enabled boolean not null default true,
  hits int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chat_faq_enabled on chat_faq(enabled);
create index if not exists idx_chat_faq_category on chat_faq(category);

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  visitor_email text,
  visitor_name text,
  page_url text,
  user_agent text,
  message_count int not null default 0,
  used_ai boolean not null default false,
  satisfaction int,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists idx_chat_conv_session on chat_conversations(session_id);
create index if not exists idx_chat_conv_created on chat_conversations(created_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  content text not null,
  source text, -- 'faq' | 'ai' | 'fallback'
  faq_id uuid references chat_faq(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_msg_conv on chat_messages(conversation_id, created_at);
