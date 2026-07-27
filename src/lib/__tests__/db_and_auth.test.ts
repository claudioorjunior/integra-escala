import test from "node:test";
import assert from "node:assert/strict";
import { getDB } from "../db";
import { signUp, signIn, getLocalUser } from "../auth";
import { buscarEscalaDoMes, salvarEscalaDoMes, excluirEscalaDoMes } from "../db";

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
