import { getDB, setSessionUser } from "./db";

const PBKDF2_ITERATIONS = 210_000;

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

  const result = await db.query<{ id: string; email: string; password_hash: string; raw_user_meta_data: any }>(
    `SELECT id, email, password_hash, raw_user_meta_data FROM auth.users
     WHERE email = $1;`,
    [cleanEmail]
  );

  if (result.rows.length === 0) {
    throw new Error("Credenciais inválidas");
  }

  const userRow = result.rows[0];

  if (userRow.password_hash.startsWith("pbkdf2$")) {
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
  } else {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );
    if (toHex(hashBuffer) !== userRow.password_hash) {
      throw new Error("Credenciais inválidas");
    }
  }

  const meta = userRow.raw_user_meta_data as { nome?: string; name?: string } || {};
  const nome = meta.nome || meta.name || cleanEmail.split("@")[0];

  const userSession: LocalUser = {
    id: userRow.id,
    email: userRow.email,
    nome,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(userSession));
  if (typeof document !== "undefined") {
    // Cookie é apenas hint de UX/routing — NÃO é autenticação real.
    // O gate real é getLocalUser() em cada página.
    document.cookie = "integra_escala_logged_in=true; path=/; max-age=31536000; SameSite=Lax";
  }
  await setSessionUser(db, userSession.id);

  return userSession;
}

export async function getLocalUser(): Promise<LocalUser | null> {
  if (typeof localStorage === "undefined") return null;
  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;

  try {
    const user = JSON.parse(sessionStr) as LocalUser;
    const db = await getDB();
    await setSessionUser(db, user.id);
    return user;
  } catch {
    return null;
  }
}

export async function signOut() {
  localStorage.removeItem(SESSION_KEY);
  if (typeof document !== "undefined") {
    document.cookie = "integra_escala_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
  const db = await getDB();
  await setSessionUser(db, null);
}
