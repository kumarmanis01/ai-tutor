-- Create pgvector extension required by prisma migrations that use the `vector` type
-- This migration ensures the extension exists on both the main and shadow DBs.
CREATE EXTENSION IF NOT EXISTS vector;
