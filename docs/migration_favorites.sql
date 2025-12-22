-- Create table for storing user favorites
create table if not exists public.board_favorites (
    user_id uuid not null references auth.users(id) on delete cascade,
    board_id uuid not null references public.kanban_boards(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, board_id)
);

-- Enable RLS
alter table public.board_favorites enable row level security;

-- Policies
create policy "Users can view their own favorites"
    on public.board_favorites for select
    using (auth.uid() = user_id);

create policy "Users can add their own favorites"
    on public.board_favorites for insert
    with check (auth.uid() = user_id);

create policy "Users can remove their own favorites"
    on public.board_favorites for delete
    using (auth.uid() = user_id);
