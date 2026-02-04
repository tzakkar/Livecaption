-- ============================================
-- Complete Database Migration Script
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Migration 1: Create events table
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on uid for fast lookups
CREATE INDEX IF NOT EXISTS idx_events_uid ON events(uid);

-- Create index on creator_id for user's events
CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all events
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Policy: Users can insert their own events
DROP POLICY IF EXISTS "Users can create events" ON events;
CREATE POLICY "Users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Policy: Users can update their own events
DROP POLICY IF EXISTS "Users can update their own events" ON events;
CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (auth.uid() = creator_id);

-- Policy: Users can delete their own events
DROP POLICY IF EXISTS "Users can delete their own events" ON events;
CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (auth.uid() = creator_id);

-- Migration 2: Create captions table
-- ============================================
CREATE TABLE IF NOT EXISTS captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sequence_number INTEGER NOT NULL,
  is_final BOOLEAN DEFAULT false
);

-- Create index on event_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_captions_event_id ON captions(event_id);

-- Create index on timestamp for ordering
CREATE INDEX IF NOT EXISTS idx_captions_timestamp ON captions(timestamp);

-- Enable Row Level Security
ALTER TABLE captions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view captions
DROP POLICY IF EXISTS "Captions are viewable by everyone" ON captions;
CREATE POLICY "Captions are viewable by everyone"
  ON captions FOR SELECT
  USING (true);

-- Policy: Only event creators can insert captions
DROP POLICY IF EXISTS "Event creators can add captions" ON captions;
CREATE POLICY "Event creators can add captions"
  ON captions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND events.creator_id = auth.uid()
    )
  );

-- Turn on realtime for the captions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'captions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE captions;
  END IF;
END $$;

-- Migration 3: Add language_code column
-- ============================================
ALTER TABLE captions ADD COLUMN IF NOT EXISTS language_code TEXT;

-- Create index on language_code for potential filtering/grouping
CREATE INDEX IF NOT EXISTS idx_captions_language_code ON captions(language_code);

-- ============================================
-- Migration Complete!
-- ============================================
