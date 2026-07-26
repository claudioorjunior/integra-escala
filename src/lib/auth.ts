import { getDB, setSessionUser } from "./db";

// Helper nativo para hash de senha usando Web Crypto API (Ponytail: sem bcryptjs dependency)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export interface LocalUser {
  id: string;
  email: string;
  nome: string;
}

const SESSION_KEY = "integra_escala_user_session";

export async function signUp(email: string, password: string, nome: string) {
  const db = await getDB();
  const pwdHash = await hashPassword(password);
  
  // Limpar inputs
  const cleanEmail = email.trim().toLowerCase();
  
  // Criar usuário no auth.users do PGlite
  const meta = JSON.stringify({ nome });
  const result = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
     VALUES ($1, $2, $3) RETURNING id;`,
    [cleanEmail, pwdHash, meta]
  );
  
  const userId = result.rows[0].id;

  // Criar uma ILPI padrão para o usuário de forma automática (YAGNI / Bootstrap)
  const slug = `ilpi-${userId.slice(0, 8)}`;
  const ilpiResult = await db.query<{ id: string }>(
    `INSERT INTO public.ilpis (nome, slug) VALUES ($1, $2) RETURNING id;`,
    [`Residencial Norteza`, slug]
  );
  const ilpiId = ilpiResult.rows[0].id;

  // Vincular usuário como admin da ILPI criada
  await db.query(
    `INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel) VALUES ($1, $2, $3);`,
    [userId, ilpiId, "admin"]
  );

  // Criar cargos padrões
  const cargos = [
    { nome: "Cuidador", regime: "24/72" },
    { nome: "Técnica de Enfermagem", regime: "5x2" },
    { nome: "Noturnista", regime: "12x36" },
    { nome: "Diarista", regime: "5x2" },
  ];

  const cargoIds: Record<string, string> = {};
  for (const cargo of cargos) {
    const res = await db.query<{ id: string }>(
      `INSERT INTO public.cargos (ilpi_id, nome, regime) VALUES ($1, $2, $3) RETURNING id;`,
      [ilpiId, cargo.nome, cargo.regime]
    );
    cargoIds[cargo.nome] = res.rows[0].id;
  }

  // Criar colaboradores padrões (seeding inicial da DB local)
  const colaboradores = [
    { nome: "Fátima Silva", email: "fatima@integra.com", telefone: "(21) 99999-1111", cargo: "Cuidador", regime: "24/72", ativo: true },
    { nome: "Maria Souza", email: "maria@integra.com", telefone: "(21) 99999-2222", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: true },
    { nome: "João Costa", email: "joao@integra.com", telefone: "(21) 99999-3333", cargo: "Noturnista", regime: "12x36", ativo: true },
    { nome: "Carlos Pereira", email: "carlos@integra.com", telefone: "(21) 99999-4444", cargo: "Cuidador", regime: "24/72", ativo: true },
    { nome: "Ana Oliveira", email: "ana@integra.com", telefone: "(21) 99999-5555", cargo: "Noturnista", regime: "12x36", ativo: true },
    { nome: "José Santos", email: "jose@integra.com", telefone: "(21) 99999-6666", cargo: "Diarista", regime: "5x2", ativo: true },
    { nome: "Rita Lima", email: "rita@integra.com", telefone: "(21) 99999-7777", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: true },
    { nome: "Lúcia Mendes", email: "lucia@integra.com", telefone: "(21) 99999-8888", cargo: "Técnica de Enfermagem", regime: "5x2", ativo: false }
  ];

  for (const colab of colaboradores) {
    const cargoId = cargoIds[colab.cargo];
    await db.query(
      `INSERT INTO public.colaboradores (ilpi_id, cargo_id, nome, regime, ativo) 
       VALUES ($1, $2, $3, $4, $5);`,
      [ilpiId, cargoId || null, colab.nome, colab.regime, colab.ativo]
    );
  }

  return { id: userId, email: cleanEmail, nome };
}

export async function signIn(email: string, password: string): Promise<LocalUser> {
  const db = await getDB();
  const pwdHash = await hashPassword(password);
  const cleanEmail = email.trim().toLowerCase();

  const result = await db.query<{ id: string; email: string; raw_user_meta_data: any }>(
    `SELECT id, email, raw_user_meta_data FROM auth.users 
     WHERE email = $1 AND password_hash = $2;`,
    [cleanEmail, pwdHash]
  );

  if (result.rows.length === 0) {
    throw new Error("Credenciais inválidas");
  }

  const userRow = result.rows[0];
  const meta = userRow.raw_user_meta_data as { nome?: string; name?: string } || {};
  const nome = meta.nome || meta.name || cleanEmail.split("@")[0];

  const userSession: LocalUser = {
    id: userRow.id,
    email: userRow.email,
    nome,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(userSession));
  if (typeof document !== "undefined") {
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
