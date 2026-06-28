-- eBingo Database Schema
-- Run this in the Supabase SQL Editor

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code CHAR(6) NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  max_winners INTEGER NOT NULL DEFAULT 3,
  entry_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  card JSONB NOT NULL DEFAULT '[]',
  opened_numbers JSONB NOT NULL DEFAULT '[]',
  is_reach BOOLEAN NOT NULL DEFAULT FALSE,
  is_bingo BOOLEAN NOT NULL DEFAULT FALSE,
  bingo_rank INTEGER,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drawn numbers table
CREATE TABLE IF NOT EXISTS drawn_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1 AND number <= 75),
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_drawn_numbers_room_id ON drawn_numbers(room_id);

-- Disable RLS for MVP simplicity
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE drawn_numbers DISABLE ROW LEVEL SECURITY;

-- Enable Realtime for all three tables
-- Run these in the Supabase Dashboard under Database > Replication
-- or use the SQL below (may require superuser in some Supabase plans):

BEGIN;
  -- Add tables to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
  ALTER PUBLICATION supabase_realtime ADD TABLE drawn_numbers;
COMMIT;
