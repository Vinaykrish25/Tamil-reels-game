
-- Enums
create type public.room_status as enum ('lobby','clue','discussion','voting','results');
create type public.movie_source as enum ('builtin','custom');
create type public.chat_phase as enum ('lobby','game','voting','postgame');

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  clue text not null,
  source public.movie_source not null default 'custom',
  room_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.movies to anon, authenticated;
grant insert, update, delete on public.movies to authenticated;
grant all on public.movies to service_role;
alter table public.movies enable row level security;
create policy "movies readable" on public.movies for select using (true);
create policy "movies insert" on public.movies for insert to authenticated with check (created_by = auth.uid());
create policy "movies update" on public.movies for update to authenticated using (created_by = auth.uid());
create policy "movies delete" on public.movies for delete to authenticated using (created_by = auth.uid());

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_player_id uuid,
  status public.room_status not null default 'lobby',
  current_round int not null default 0,
  current_game_id uuid,
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.rooms to anon, authenticated;
grant insert, update on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms readable" on public.rooms for select using (true);
create policy "rooms insert" on public.rooms for insert to authenticated with check (true);
create policy "rooms update" on public.rooms for update to authenticated using (true);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  avatar_seed text not null,
  is_host boolean not null default false,
  kicked boolean not null default false,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now()
);
create index players_room_idx on public.players(room_id);
create index players_user_idx on public.players(user_id);
grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "players readable" on public.players for select using (true);
create policy "players self insert" on public.players for insert to authenticated with check (user_id = auth.uid());
create policy "players self update" on public.players for update to authenticated using (user_id = auth.uid());
create policy "players self delete" on public.players for delete to authenticated using (user_id = auth.uid());

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  revealed_movie_id uuid,
  revealed_imposter_player_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index games_room_idx on public.games(room_id);
grant select on public.games to anon, authenticated;
grant insert, update on public.games to authenticated;
grant all on public.games to service_role;
alter table public.games enable row level security;
create policy "games readable" on public.games for select using (true);
create policy "games insert" on public.games for insert to authenticated with check (true);
create policy "games update" on public.games for update to authenticated using (true);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  user_id uuid not null,
  is_imposter boolean not null,
  secret_text text not null,
  clue_hint text,
  created_at timestamptz not null default now(),
  unique(game_id, player_id)
);
create index assignments_game_idx on public.assignments(game_id);
grant select on public.assignments to authenticated;
grant insert on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "assignments owner reads" on public.assignments for select to authenticated using (user_id = auth.uid());
create policy "assignments insert" on public.assignments for insert to authenticated with check (true);

create table public.clues (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  round int not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index clues_game_idx on public.clues(game_id);
grant select on public.clues to anon, authenticated;
grant insert on public.clues to authenticated;
grant all on public.clues to service_role;
alter table public.clues enable row level security;
create policy "clues readable" on public.clues for select using (true);
create policy "clues insert" on public.clues for insert to authenticated with check (true);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(game_id, voter_player_id)
);
grant select on public.votes to anon, authenticated;
grant insert, update on public.votes to authenticated;
grant all on public.votes to service_role;
alter table public.votes enable row level security;
create policy "votes readable" on public.votes for select using (true);
create policy "votes insert" on public.votes for insert to authenticated with check (true);
create policy "votes update" on public.votes for update to authenticated using (true);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  phase public.chat_phase not null default 'lobby',
  text text not null,
  created_at timestamptz not null default now()
);
create index chat_room_idx on public.chat_messages(room_id, created_at);
grant select on public.chat_messages to anon, authenticated;
grant insert on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "chat readable" on public.chat_messages for select using (true);
create policy "chat insert" on public.chat_messages for insert to authenticated with check (true);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);
create index reactions_room_idx on public.reactions(room_id, created_at);
grant select on public.reactions to anon, authenticated;
grant insert on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "reactions readable" on public.reactions for select using (true);
create policy "reactions insert" on public.reactions for insert to authenticated with check (true);

create table public.play_again (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(game_id, player_id)
);
grant select on public.play_again to anon, authenticated;
grant insert, delete on public.play_again to authenticated;
grant all on public.play_again to service_role;
alter table public.play_again enable row level security;
create policy "pa readable" on public.play_again for select using (true);
create policy "pa insert" on public.play_again for insert to authenticated with check (true);
create policy "pa delete" on public.play_again for delete to authenticated using (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.clues;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.play_again;
alter publication supabase_realtime add table public.assignments;
