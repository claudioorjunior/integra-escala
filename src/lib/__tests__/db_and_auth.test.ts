import test from "node:test";
import assert from "node:assert/strict";
import { getDB } from "../db";
import { signUp, signIn, getLocalUser } from "../auth";

// Ponytail: Simulamos o localStorage sem simular o window/document completo
// Isso evita que o PGlite se confunda achando que está no browser
const mockLocalStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; },
  length: 0,
  key: () => null,
};

test("PGlite + Auth Local Flow", async () => {
  const db = await getDB();
  
  // 1. Cadastrar usuário
  const user = await signUp("teste@norteza.com", "senha123", "Claudio Teste");
  assert.ok(user.id);
  assert.equal(user.email, "teste@norteza.com");
  assert.equal(user.nome, "Claudio Teste");

  // 2. Verificar se a ILPI padrão foi criada
  const ilpiRes = await db.query<{ nome: string }>("SELECT nome FROM public.ilpis;");
  assert.equal(ilpiRes.rows.length, 1);
  assert.equal(ilpiRes.rows[0].nome, "Residencial Norteza");

  // 3. Fazer Login
  const session = await signIn("teste@norteza.com", "senha123");
  assert.equal(session.id, user.id);

  // 4. Buscar do Storage simulado
  const loadedUser = await getLocalUser();
  assert.ok(loadedUser);
  assert.equal(loadedUser?.nome, "Claudio Teste");
});
