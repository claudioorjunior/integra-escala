import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { getDB, closeDB } from "../db";
import { signUp, signIn, getLocalUser } from "../auth";
import { buscarEscalaDoMes, salvarEscalaDoMes, excluirEscalaDoMes, atualizarCargo, excluirCargo, criarCargo } from "../db";

const mockLocalStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; },
  length: 0,
  key: () => null,
};

// Fechar o PGlite e limpar o localStorage entre testes para isolamento
afterEach(async () => {
  await closeDB();
  globalThis.localStorage.clear();
});

test("PGlite + Auth Local Flow", async (t) => {
  await t.test("cadastrar usuário cria ILPI padrão e colaboradores seed", async () => {
    const db = await getDB();
    const user = await signUp("teste@norteza.com", "senha123", "Claudio Teste");
    assert.ok(user.id);
    assert.equal(user.email, "teste@norteza.com");
    assert.equal(user.nome, "Claudio Teste");

    const ilpiRes = await db.query<{ nome: string }>("SELECT nome FROM public.ilpis;");
    assert.equal(ilpiRes.rows.length, 1);
    assert.equal(ilpiRes.rows[0].nome, "Residencial Norteza");

    const colabsRes = await db.query<{ id: string }>("SELECT id FROM public.colaboradores;");
    assert.equal(colabsRes.rows.length, 8);
  });

  await t.test("login com credenciais válidas retorna sessão", async () => {
    const user = await signUp("login@norteza.com", "senha123", "Login Test");
    const session = await signIn("login@norteza.com", "senha123");
    assert.equal(session.id, user.id);
    assert.equal(session.nome, "Login Test");
  });

  await t.test("login com credenciais inválidas lança erro", async () => {
    await signUp("badlogin@norteza.com", "senha123", "Bad Login");
    await assert.rejects(
      signIn("badlogin@norteza.com", "senha_errada"),
      /Credenciais inválidas/
    );
  });

  await t.test("login com email inexistente lança erro", async () => {
    await assert.rejects(
      signIn("naoexiste@norteza.com", "qualquer"),
      /Credenciais inválidas/
    );
  });

  await t.test("salvar e buscar escala do mês", async () => {
    const user = await signUp("escala@norteza.com", "senha123", "Escala Test");
    await signIn("escala@norteza.com", "senha123");

    const db = await getDB();
    const colabsRes = await db.query<{ id: string }>("SELECT id FROM public.colaboradores LIMIT 1;");
    const colabId = colabsRes.rows[0].id;

    const plantoesMock = [
      { colaboradorId: colabId, dia: 15, horarioInicio: "07:00", horarioFim: "19:00" },
      { colaboradorId: colabId, dia: 16, horarioInicio: "19:00", horarioFim: "07:00" },
    ];
    await salvarEscalaDoMes(user.id, 7, 2026, plantoesMock, "rascunho");

    const escala = await buscarEscalaDoMes(user.id, 7, 2026);
    assert.ok(escala.escalaMesId);
    assert.equal(escala.status, "rascunho");
    assert.equal(escala.plantoes.length, 2);
    assert.equal(escala.plantoes[0].dia, 15);
    assert.equal(escala.plantoes[0].horarioInicio, "07:00:00");

    await excluirEscalaDoMes(user.id, 7, 2026);
    const escalaExcluida = await buscarEscalaDoMes(user.id, 7, 2026);
    assert.equal(escalaExcluida.escalaMesId, null);
    assert.equal(escalaExcluida.plantoes.length, 0);
  });

  await t.test("getLocalUser recupera sessão do localStorage", async () => {
    await signUp("session@norteza.com", "senha123", "Session Test");
    await signIn("session@norteza.com", "senha123");
    const loadedUser = await getLocalUser();
    assert.ok(loadedUser);
    assert.equal(loadedUser?.nome, "Session Test");
  });
});

test("atualizarCargo throws when cargo does not exist", async () => {
  const user = await signUp("updater@norteza.com", "senha123", "Update Test");

  await assert.rejects(
    atualizarCargo(user.id, "00000000-0000-0000-0000-000000000000", {
      nome: "Cargo Inexistente",
      regime: "5x2",
    }),
    /Cargo não encontrado/
  );
});

test("excluirCargo throws when cargo does not exist", async () => {
  const user = await signUp("deleter@norteza.com", "senha123", "Delete Test");

  await assert.rejects(
    excluirCargo(user.id, "00000000-0000-0000-0000-000000000000"),
    /Cargo não encontrado/
  );
});

test("getLocalUser returns null for expired session", async () => {
  const user = await signUp("expired@norteza.com", "senha123", "Expired Test");
  await signIn("expired@norteza.com", "senha123");

  const sessionStr = mockLocalStorage["integra_escala_user_session"];
  const session = JSON.parse(sessionStr);
  session.expiresAt = Date.now() - 1;
  mockLocalStorage["integra_escala_user_session"] = JSON.stringify(session);

  const result = await getLocalUser();
  assert.equal(result, null);
});

test("getLocalUser returns null for malformed localStorage data", async () => {
  mockLocalStorage["integra_escala_user_session"] = "not valid json";

  const result = await getLocalUser();
  assert.equal(result, null);
});

test("getLocalUser returns null for session with invalid shape", async () => {
  mockLocalStorage["integra_escala_user_session"] = JSON.stringify({
    id: "not-a-uuid",
    email: "bad@example.com",
    nome: "Bad User",
    expiresAt: Date.now() + 999999,
  });

  const result = await getLocalUser();
  assert.equal(result, null);

});

test("atualizarCargo throws when cargo does not exist", async () => {
  const user = await signUp("updater@norteza.com", "senha123", "Update Test");

  await assert.rejects(
    atualizarCargo(user.id, "00000000-0000-0000-0000-000000000000", {
      nome: "Cargo Inexistente",
      regime: "5x2",
    }),
    /Cargo não encontrado/
  );
});

test("excluirCargo throws when cargo does not exist", async () => {
  const user = await signUp("deleter@norteza.com", "senha123", "Delete Test");

  await assert.rejects(
    excluirCargo(user.id, "00000000-0000-0000-0000-000000000000"),
    /Cargo não encontrado/
  );
});

test("getLocalUser returns null for expired session", async () => {
  const user = await signUp("expired@norteza.com", "senha123", "Expired Test");
  await signIn("expired@norteza.com", "senha123");

  // Manually expire the session
  const sessionStr = mockLocalStorage["integra_escala_user_session"];
  const session = JSON.parse(sessionStr);
  session.expiresAt = Date.now() - 1; // expired 1ms ago
  mockLocalStorage["integra_escala_user_session"] = JSON.stringify(session);

  const result = await getLocalUser();
  assert.equal(result, null);
});

test("getLocalUser returns null for malformed localStorage data", async () => {
  mockLocalStorage["integra_escala_user_session"] = "not valid json";

  const result = await getLocalUser();
  assert.equal(result, null);
});

test("getLocalUser returns null for session with invalid shape", async () => {
  mockLocalStorage["integra_escala_user_session"] = JSON.stringify({
    id: "not-a-uuid",
    email: "bad@example.com",
    nome: "Bad User",
    expiresAt: Date.now() + 999999,
  });

  const result = await getLocalUser();
  assert.equal(result, null);
});
