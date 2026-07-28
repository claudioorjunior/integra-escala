import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { getDB, closeDB } from "../db";
import { signUp, signIn, getLocalUser } from "../auth";
import { buscarEscalaDoMes, salvarEscalaDoMes, excluirEscalaDoMes, atualizarCargo, excluirCargo, criarCargo } from "../db";

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

// Fechar o PGlite e limpar o localStorage entre testes para isolamento
afterEach(async () => {
  await closeDB();
  globalThis.localStorage.clear();
});

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

  // 4. Buscar colaboradores criados no seed
  const colabsRes = await db.query<{ id: string }>("SELECT id FROM public.colaboradores;");
  assert.equal(colabsRes.rows.length, 8);
  const colabId = colabsRes.rows[0].id;

  // 5. Salvar uma escala para o mês 7 de 2026
  const plantoesMock = [
    { colaboradorId: colabId, dia: 15, horarioInicio: "07:00", horarioFim: "19:00" },
    { colaboradorId: colabId, dia: 16, horarioInicio: "19:00", horarioFim: "07:00" },
  ];
  await salvarEscalaDoMes(user.id, 7, 2026, plantoesMock, "rascunho");

  // 6. Buscar a escala salva e validar os registros
  const escala = await buscarEscalaDoMes(user.id, 7, 2026);
  assert.ok(escala.escalaMesId);
  assert.equal(escala.status, "rascunho");
  assert.equal(escala.plantoes.length, 2);
  assert.equal(escala.plantoes[0].dia, 15);
  assert.equal(escala.plantoes[0].horarioInicio, "07:00:00"); // Postgres TIME formata como hh:mm:ss

  // 7. Excluir a escala e validar a deleção
  await excluirEscalaDoMes(user.id, 7, 2026);
  const escalaExcluida = await buscarEscalaDoMes(user.id, 7, 2026);
  assert.equal(escalaExcluida.escalaMesId, null);
  assert.equal(escalaExcluida.plantoes.length, 0);

  // 8. Buscar do Storage simulado
  const loadedUser = await getLocalUser();
  assert.ok(loadedUser);
  assert.equal(loadedUser?.nome, "Claudio Teste");
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
