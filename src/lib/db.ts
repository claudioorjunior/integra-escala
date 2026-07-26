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

export interface PlantaoDB {
  colaboradorId: string;
  dia: number;
  horarioInicio: string;
  horarioFim: string;
}

export async function buscarEscalaDoMes(userId: string, mes: number, ano: number) {
  const db = await getDB();
  
  // 1. Pegar ILPI do usuário
  const uiRes = await db.query<{ ilpi_id: string }>(
    `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
    [userId]
  );
  if (uiRes.rows.length === 0) return { escalaMesId: null, plantoes: [] };
  const ilpiId = uiRes.rows[0].ilpi_id;

  // 2. Buscar escala_meses correspondente
  const escalaMesRes = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM public.escala_meses WHERE ilpi_id = $1 AND mes = $2 AND ano = $3;`,
    [ilpiId, mes, ano]
  );

  if (escalaMesRes.rows.length === 0) {
    return { escalaMesId: null, status: "rascunho", plantoes: [] };
  }

  const escalaMesId = escalaMesRes.rows[0].id;
  const status = escalaMesRes.rows[0].status;

  // 3. Buscar escala_dias
  const diasRes = await db.query<any>(
    `SELECT colaborador_id, dia, horario_inicio, horario_fim FROM public.escala_dias
     WHERE escala_mes_id = $1;`,
    [escalaMesId]
  );

  const plantoes: PlantaoDB[] = diasRes.rows.map((row: any) => ({
    colaboradorId: row.colaborador_id,
    dia: row.dia,
    horarioInicio: row.horario_inicio,
    horarioFim: row.horario_fim,
  }));

  return { escalaMesId, status, plantoes };
}

export async function salvarEscalaDoMes(
  userId: string,
  mes: number,
  ano: number,
  plantoes: PlantaoDB[],
  status: "rascunho" | "publicada" = "rascunho"
) {
  const db = await getDB();
  
  // 1. Pegar ILPI
  const uiRes = await db.query<{ ilpi_id: string }>(
    `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
    [userId]
  );
  if (uiRes.rows.length === 0) throw new Error("Usuário não está vinculado a nenhuma ILPI.");
  const ilpiId = uiRes.rows[0].ilpi_id;

  // 2. Upsert escala_meses
  const escalaMesRes = await db.query<{ id: string }>(
    `INSERT INTO public.escala_meses (ilpi_id, mes, ano, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ilpi_id, mes, ano) DO UPDATE SET status = EXCLUDED.status
     RETURNING id;`,
    [ilpiId, mes, ano, status]
  );
  const escalaMesId = escalaMesRes.rows[0].id;

  // 3. Deletar escala_dias antigos para re-inserir todos
  await db.query(`DELETE FROM public.escala_dias WHERE escala_mes_id = $1;`, [escalaMesId]);

  // 4. Inserir escala_dias em lote
  for (const p of plantoes) {
    await db.query(
      `INSERT INTO public.escala_dias (escala_mes_id, colaborador_id, dia, horario_inicio, horario_fim)
       VALUES ($1, $2, $3, $4, $5);`,
      [escalaMesId, p.colaboradorId, p.dia, p.horarioInicio, p.horarioFim]
    );
  }

  return escalaMesId;
}

export async function excluirEscalaDoMes(userId: string, mes: number, ano: number) {
  const db = await getDB();
  const uiRes = await db.query<{ ilpi_id: string }>(
    `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
    [userId]
  );
  if (uiRes.rows.length === 0) return;
  const ilpiId = uiRes.rows[0].ilpi_id;

  await db.query(`DELETE FROM public.escala_meses WHERE ilpi_id = $1 AND mes = $2 AND ano = $3;`, [
    ilpiId,
    mes,
    ano,
  ]);
}

