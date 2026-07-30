import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "./migrations";
import { normalizarRegime } from "./scheduling";

// Helper reutilizável: pega o ilpi_id do usuário logado a partir do db
export async function getIlpiIdDoUsuario(db: PGlite, userId: string): Promise<string | null> {
  const res = await db.query<{ ilpi_id: string }>(
    `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 ORDER BY ilpi_id LIMIT 1;`,
    [userId]
  );
  return res.rows.length > 0 ? res.rows[0].ilpi_id : null;
}

// Ponytail: Usamos IndexedDB no browser e banco em memória no server
// Upgrade path: Persistir em SQLite no backend se formos usar server-side actions
let dbPromise: Promise<PGlite> | null = null;

export async function getDB(): Promise<PGlite> {
  if (dbPromise) return dbPromise;
  const promise = initDB();
  dbPromise = promise;
  return promise.catch((err) => {
    // Reset cache only if it still references this failed initialization
    if (dbPromise === promise) dbPromise = null;
    throw err;
  });
}

export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.close();
    dbPromise = null;
  }
}

async function initDB(): Promise<PGlite> {
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
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;
  `);

  // 2. Executar migrations se necessário (idempotentes, com controle de ordem)
  const mRes = await db.query<{ name: string }>(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);`
  );
  await mRes;

  for (const migration of MIGRATIONS) {
    const recorded = await db.query<{ name: string }>(
      `SELECT name FROM schema_migrations WHERE name = $1;`,
      [migration.name]
    );
    if (recorded.rows.length > 0) continue;

    try {
      await db.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query(
          `INSERT INTO schema_migrations (name) VALUES ($1);`,
          [migration.name]
        );
      });
    } catch (err) {
      console.error(`Erro ao rodar migration ${migration.name}:`, err);
      throw new Error(`Falha na migration ${migration.name}`, { cause: err });
    }
  }

  return db;
}

// Helper para definir o usuário atual na sessão do PGlite
export async function setSessionUser(db: PGlite, userId: string | null) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [userId ?? ""]);
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
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) {
    return { escalaMesId: null, status: "rascunho", plantoes: [] as PlantaoDB[] };
  }

  // 2. Buscar escala_meses correspondente
  const escalaMesRes = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM public.escala_meses WHERE ilpi_id = $1 AND mes = $2 AND ano = $3;`,
    [ilpiId, mes, ano]
  );

  if (escalaMesRes.rows.length === 0) {
    return { escalaMesId: null, status: "rascunho", plantoes: [] as PlantaoDB[] };
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
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não está vinculado a nenhuma ILPI.");

  return db.transaction(async (tx) => {
    // 2. Upsert escala_meses
    const escalaMesRes = await tx.query<{ id: string }>(
      `INSERT INTO public.escala_meses (ilpi_id, mes, ano, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ilpi_id, mes, ano) DO UPDATE SET status = EXCLUDED.status
       RETURNING id;`,
      [ilpiId, mes, ano, status]
    );
    const escalaMesId = escalaMesRes.rows[0].id;

    // 3. Deletar escala_dias antigos para re-inserir todos
    await tx.query(`DELETE FROM public.escala_dias WHERE escala_mes_id = $1;`, [escalaMesId]);

    // 4. Inserir escala_dias em lote (multi-row INSERT)
    if (plantoes.length > 0) {
      const values: unknown[] = [];
      const tuples = plantoes.map((p, i) => {
        const b = i * 5;
        values.push(escalaMesId, p.colaboradorId, p.dia, p.horarioInicio, p.horarioFim);
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
      });
      await tx.query(
        `INSERT INTO public.escala_dias
           (escala_mes_id, colaborador_id, dia, horario_inicio, horario_fim)
         VALUES ${tuples.join(", ")};`,
        values
      );
    }

    return escalaMesId;
  });
}

// ─── Cargos CRUD ────────────────────────────────────────────────

function validarRegimeOuLancar(regime: string): void {
  if (!normalizarRegime(regime)) {
    throw new Error(
      `Regime inválido: "${regime}". Use um regime nomeado (24/72, 12x36, 5x2, noturnista, diarista) ou padrão NxM (ex: 12x72, 12x24, 24x72).`
    );
  }
}

export async function criarCargo(
  userId: string,
  dados: { nome: string; regime: string; descricao?: string }
) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  validarRegimeOuLancar(dados.regime);

  const res = await db.query<{ id: string }>(
    `INSERT INTO public.cargos (ilpi_id, nome, regime, descricao)
     VALUES ($1, $2, $3, $4) RETURNING id;`,
    [ilpiId, dados.nome, dados.regime, dados.descricao ?? null]
  );
  return res.rows[0].id;
}

export async function atualizarCargo(
  userId: string,
  cargoId: string,
  dados: { nome: string; regime: string; descricao?: string }
) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  validarRegimeOuLancar(dados.regime);

  const res = await db.query(
    `UPDATE public.cargos SET nome = $1, regime = $2, descricao = $3
     WHERE id = $4 AND ilpi_id = $5;`,
    [dados.nome, dados.regime, dados.descricao ?? null, cargoId, ilpiId]
  );
  if ((res.affectedRows ?? 0) === 0) throw new Error("Cargo não encontrado ou não pertence à sua ILPI.");
}

export async function excluirCargo(userId: string, cargoId: string) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  const res = await db.query(
    `DELETE FROM public.cargos WHERE id = $1 AND ilpi_id = $2;`,
    [cargoId, ilpiId]
  );
  if ((res.affectedRows ?? 0) === 0) throw new Error("Cargo não encontrado ou não pertence à sua ILPI.");
}

// ─── Colaboradores CRUD ──────────────────────────────────────────

export interface ColaboradorDados {
  nome: string;
  cargoId: string | null;
  regime: string;
  ativo: boolean;
}

async function validarCargoDaIlpi(
  db: PGlite,
  cargoId: string | null,
  ilpiId: string
): Promise<void> {
  if (!cargoId) return;
  const res = await db.query(
    `SELECT 1 FROM public.cargos WHERE id = $1 AND ilpi_id = $2;`,
    [cargoId, ilpiId]
  );
  if (res.rows.length === 0)
    throw new Error("Cargo não encontrado ou não pertence à sua ILPI.");
}

export async function criarColaborador(
  userId: string,
  dados: ColaboradorDados
) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  validarRegimeOuLancar(dados.regime);
  await validarCargoDaIlpi(db, dados.cargoId, ilpiId);

  const res = await db.query<{ id: string }>(
    `INSERT INTO public.colaboradores (ilpi_id, cargo_id, nome, regime, ativo)
     VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
    [ilpiId, dados.cargoId, dados.nome, dados.regime, dados.ativo]
  );
  return res.rows[0].id;
}

export async function atualizarColaborador(
  userId: string,
  colaboradorId: string,
  dados: ColaboradorDados
) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  validarRegimeOuLancar(dados.regime);

  await validarCargoDaIlpi(db, dados.cargoId, ilpiId);

  const res = await db.query(
    `UPDATE public.colaboradores
       SET nome = $1, cargo_id = $2, regime = $3, ativo = $4
     WHERE id = $5 AND ilpi_id = $6;`,
    [dados.nome, dados.cargoId, dados.regime, dados.ativo, colaboradorId, ilpiId]
  );
  if ((res.affectedRows ?? 0) === 0)
    throw new Error("Colaborador não encontrado ou não pertence à sua ILPI.");
}

export async function excluirColaborador(userId: string, colaboradorId: string) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

  const res = await db.query(
    `DELETE FROM public.colaboradores WHERE id = $1 AND ilpi_id = $2;`,
    [colaboradorId, ilpiId]
  );
  if ((res.affectedRows ?? 0) === 0)
    throw new Error("Colaborador não encontrado ou não pertence à sua ILPI.");
}

export async function excluirEscalaDoMes(userId: string, mes: number, ano: number) {
  const db = await getDB();
  const ilpiId = await getIlpiIdDoUsuario(db, userId);
  if (!ilpiId) return;

  await db.query(`DELETE FROM public.escala_meses WHERE ilpi_id = $1 AND mes = $2 AND ano = $3;`, [
    ilpiId,
    mes,
    ano,
  ]);
}
