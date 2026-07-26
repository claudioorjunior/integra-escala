import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "./migrations";

// Ponytail: Usamos IndexedDB no browser e banco em memória no server
// Upgrade path: Persistir em SQLite no backend se formos usar server-side actions
let dbInstance: PGlite | null = null;

export async function getDB(): Promise<PGlite> {
  if (dbInstance) return dbInstance;

  const isBrowser = typeof window !== "undefined";
  const db = new PGlite(isBrowser ? "idb://integra-escala-db" : undefined);
  
  // 1. Criar estrutura básica do Supabase Auth para evitar erros nas migrations
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END
    $$;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claim.sub', true),
        '00000000-0000-0000-0000-000000000000'
      )::uuid;
    $$ LANGUAGE sql STABLE;

    -- Mock do digest de pgcrypto para rodar offline sem precisar de pgcrypto no PGlite
    CREATE OR REPLACE FUNCTION public.digest(data text, type text) RETURNS bytea AS $$
      SELECT data::bytea;
    $$ LANGUAGE sql IMMUTABLE;
  `);

  // 2. Executar migrations se necessário (indempotentes)
  for (const migration of MIGRATIONS) {
    try {
      // Ponytail: Evita falhas no PGlite com extensões não compiladas/disponíveis no WASM
      const cleanSql = migration.sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "");
      await db.exec(cleanSql);
    } catch (err) {
      console.error(`Erro ao rodar migration ${migration.name}:`, err);
    }
  }

  dbInstance = db;
  return db;
}

// Helper para definir o usuário atual na sessão do PGlite
export async function setSessionUser(db: PGlite, userId: string | null) {
  if (userId) {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false);`);
  } else {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
  }
}
