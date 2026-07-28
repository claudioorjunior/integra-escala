import { getDB, setSessionUser } from "./db";
import type { PGlite } from "@electric-sql/pglite";

const PBKDF2_ITERATIONS = 600_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt.buffer)}$${toHex(bits)}`;
}

function parsePwHash(stored: string) {
  const parts = stored.split("$");
  return {
    iterations: parseInt(parts[1], 10),
    salt: new Uint8Array(parts[2].match(/.{2}/g)!.map((h) => parseInt(h, 16))),
    hash: parts[3],
  };
}

export interface LocalUser {
  id: string;
  email: string;
  nome: string;
}

const SESSION_KEY = "integra_escala_user_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function validateLocalUser(obj: unknown): LocalUser | null {
  if (!obj || typeof obj !== "object") return null;
  const u = obj as Record<string, unknown>;
  if (typeof u.id !== "string" || !isValidUUID(u.id)) return null;
  if (typeof u.email !== "string" || u.email.length === 0) return null;
  if (typeof u.nome !== "string" || u.nome.length === 0) return null;
  return { id: u.id, email: u.email, nome: u.nome };
}

export async function signUp(
  email: string,
  password: string,
  nome: string
) {
  const db = await getDB();
  const pwdHash = await hashPassword(password);
  const cleanEmail = email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const meta = JSON.stringify({ nome });
    const result = await tx.query<{ id: string }>(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data)
       VALUES ($1, $2, $3) RETURNING id;`,
      [cleanEmail, pwdHash, meta]
    );

    const userId = result.rows[0].id;

    const slug = `ilpi-${userId.slice(0, 8)}`;
    const ilpiResult = await tx.query<{ id: string }>(
      `INSERT INTO public.ilpis (nome, slug) VALUES ($1, $2) RETURNING id;`,
      [`Residencial Norteza`, slug]
    );
    const ilpiId = ilpiResult.rows[0].id;

    await tx.query(
      `INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel) VALUES ($1, $2, $3);`,
      [userId, ilpiId, "admin"]
    );

    const cargos = [
      { nome: "Cuidador", regime: "24/72" },
      { nome: "Técnica de Enfermagem", regime: "5x2" },
      { nome: "Noturnista", regime: "12x36" },
      { nome: "Diarista", regime: "5x2" },
    ];

    const cargoIds: Record<string, string> = {};
    for (const cargo of cargos) {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO public.cargos (ilpi_id, nome, regime) VALUES ($1, $2, $3) RETURNING id;`,
        [ilpiId, cargo.nome, cargo.regime]
      );
      cargoIds[cargo.nome] = res.rows[0].id;
    }

    const colaboradores = [
      { nome: "Fátima Silva", cargo: "Cuidador", regime: "24/72", ativo: true },
      { nome: "Maria Souza", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: true },
      { nome: "João Costa", cargo: "Noturnista", regime: "12x36", ativo: true },
      { nome: "Carlos Pereira", cargo: "Cuidador", regime: "24/72", ativo: true },
      { nome: "Ana Oliveira", cargo: "Noturnista", regime: "12x36", ativo: true },
      { nome: "José Santos", cargo: "Diarista", regime: "5x2", ativo: true },
      { nome: "Rita Lima", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: true },
      { nome: "Lúcia Mendes", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: false },
    ];

    for (const colab of colaboradores) {
      const cargoId = cargoIds[colab.cargo];
      await tx.query(
        `INSERT INTO public.colaboradores (ilpi_id, cargo_id, nome, regime, ativo)
         VALUES ($1, $2, $3, $4, $5);`,
        [ilpiId, cargoId || null, colab.nome, colab.regime, colab.ativo]
      );
    }

    return { id: userId, email: cleanEmail, nome };
  });
}

export async function signIn(email: string, password: string): Promise<LocalUser> {
  const db = await getDB();
  const cleanEmail = email.trim().toLowerCase();
  const isDev = process.env.NODE_ENV === 'development';

  const result = await db.query<{ id: string; email: string; password_hash: string; raw_user_meta_data: any }>(
    `SELECT id, email, password_hash, raw_user_meta_data FROM auth.users
     WHERE email = $1;`,
    [cleanEmail]
  );

  if (result.rows.length > 0) {
    const userRow = result.rows[0];
    if (!isDev) {
      if (!userRow.password_hash.startsWith("pbkdf2$")) {
        throw new Error("Credenciais inválidas");
      }
      const { iterations, salt, hash } = parsePwHash(userRow.password_hash);
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        key,
        256
      );
      if (toHex(bits) !== hash) throw new Error("Credenciais inválidas");
    }

    const meta = userRow.raw_user_meta_data as { nome?: string; name?: string } || {};
    const nome = meta.nome || meta.name || cleanEmail.split("@")[0];
    const userSession: LocalUser = { id: userRow.id, email: userRow.email, nome };
    await completeSignIn(db, userSession);
    return userSession;
  }

  if (isDev) {
    return signUp(cleanEmail, password, cleanEmail.split("@")[0]).then(async (user) => {
      await completeSignIn(db, user);
      return user;
    });
  }

  throw new Error("Credenciais inválidas");
}

async function completeSignIn(db: PGlite, userSession: LocalUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...userSession, expiresAt: Date.now() + SESSION_TTL_MS }));
  if (typeof document !== "undefined") {
    // Cookie é apenas hint de UX/routing — NÃO é autenticação real.
    // O gate real é getLocalUser() em cada página.
    document.cookie = "integra_escala_logged_in=true; path=/; max-age=31536000; SameSite=Lax";
  }
  await setSessionUser(db, userSession.id);
}

export async function getLocalUser(): Promise<LocalUser | null> {
  if (typeof localStorage === "undefined") return null;
  const isDev = process.env.NODE_ENV === "development";
  const sessionStr = localStorage.getItem(SESSION_KEY);

  if (sessionStr) {
    try {
      const parsed = JSON.parse(sessionStr) as Record<string, unknown>;
      const user = validateLocalUser(parsed);
      if (!user) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      const expiresAt = parsed.expiresAt;
      if (typeof expiresAt !== "number" || Date.now() > expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      const db = await getDB();
      const res = await db.query<{ id: string }>(
        `SELECT id FROM auth.users WHERE id = $1;`,
        [user.id]
      );
      if (res.rows.length === 0) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      await setSessionUser(db, user.id);
      return user;
    } catch {
      return null;
    }
  }

  if (isDev) {
    const db = await getDB();
    const devUser = await db.query<{ id: string; email: string; raw_user_meta_data: any }>(
      `SELECT id, email, raw_user_meta_data FROM auth.users LIMIT 1;`
    );
    if (devUser.rows.length > 0) {
      const row = devUser.rows[0];
      const meta = row.raw_user_meta_data as { nome?: string; name?: string } || {};
      const nome = meta.nome || meta.name || row.email.split("@")[0];
      const userSession: LocalUser = { id: row.id, email: row.email, nome };
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ ...userSession, expiresAt: Date.now() + SESSION_TTL_MS })
      );
      await setSessionUser(db, userSession.id);
      return userSession;
    }
  }

  return null;
}

export async function signOut() {
  localStorage.removeItem(SESSION_KEY);
  if (typeof document !== "undefined") {
    document.cookie = "integra_escala_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
  const db = await getDB();
  await setSessionUser(db, null);
}
