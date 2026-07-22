import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f3ee] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#e8e2d4] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img
            src="/logo-integra-escala.png"
            alt="Integra Escala"
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-[#555] hover:text-[#1a3c34] transition px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="text-sm font-medium bg-[#1a3c34] text-white rounded-lg px-5 py-2 hover:bg-[#143028] transition"
            >
              Experimente grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 w-full">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-[clamp(2rem,4vw,3.2rem)] font-medium text-[#1a3c34] leading-tight mb-6">
                Escala da sua ILPI<br />em minutos, não em horas
              </h1>
              <p className="text-[#666] text-lg leading-relaxed mb-8 max-w-md">
                Gere escalas automáticas respeitando regimes de trabalho,
                evite conflitos de horário e tenha visão clara do mês inteiro
                — direto do seu navegador.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/cadastro"
                  className="bg-[#1a3c34] text-white font-medium rounded-lg px-8 py-3 text-center hover:bg-[#143028] transition"
                >
                  Criar conta gratuita
                </Link>
                <Link
                  href="/login"
                  className="border border-[#d4cdc0] text-[#555] font-medium rounded-lg px-8 py-3 text-center hover:border-[#1a3c34] hover:text-[#1a3c34] transition"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
            <div className="relative hidden md:block">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{ backgroundImage: "url('/bg-login.jpg')" }}
              />
              <div className="relative bg-white/80 backdrop-blur rounded-2xl shadow-lg p-8 border border-[#e8e2d4]">
                <div className="text-center">
                  <div className="text-4xl mb-4">📅</div>
                  <h3 className="font-medium text-[#1a3c34] mb-2">
                    Julho 2026
                  </h3>
                  <div className="grid grid-cols-7 gap-1 text-[10px] text-[#8b7d6b] uppercase mt-4 mb-2">
                    <span>Dom</span>
                    <span>Seg</span>
                    <span>Ter</span>
                    <span>Qua</span>
                    <span>Qui</span>
                    <span>Sex</span>
                    <span>Sáb</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-left">
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6].map(d => (
                        <div key={d} className="flex-1 bg-[#f0ede5] rounded p-1 h-8">
                          <span className="text-[9px] text-[#8b7d6b]">{d}</span>
                        </div>
                      ))}
                      <div className="flex-1 bg-[#e8e2d4] rounded p-1 h-8">
                        <span className="text-[9px] text-[#8b7d6b]">7</span>
                      </div>
                    </div>
                    <div className="text-center py-3 text-[#8b7d6b] text-xs">
                      Maria — 07h às 17h · Fátima — 24h · João — 19h às 07h
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-24">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e8e2d4]">
              <div className="text-2xl mb-3">⚡</div>
              <h3 className="font-medium text-[#1a3c34] mb-2">Geração em 1 clique</h3>
              <p className="text-sm text-[#666] leading-relaxed">
                O algoritmo distribui sua equipe respeitando 24/72, 12x36, 5x2 e regimes mistos.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e8e2d4]">
              <div className="text-2xl mb-3">🔄</div>
              <h3 className="font-medium text-[#1a3c34] mb-2">Ajuste manual</h3>
              <p className="text-sm text-[#666] leading-relaxed">
                Arraste, troque, adicione ou remova pessoas. O sistema valida conflitos em tempo real.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e8e2d4]">
              <div className="text-2xl mb-3">🖨️</div>
              <h3 className="font-medium text-[#1a3c34] mb-2">Impressão profissional</h3>
              <p className="text-sm text-[#666] leading-relaxed">
                Escala formatada com logo e cores da sua ILPI, pronta para imprimir e afixar.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e2d4] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#8b7d6b]">
          <span>© 2026 Integra Escala — Uma ferramenta do grupo Norteza</span>
          <span>Feito para ILPIs brasileiras</span>
        </div>
      </footer>
    </div>
  );
}