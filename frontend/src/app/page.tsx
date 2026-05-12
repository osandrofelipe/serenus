import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur border-b px-6 h-16 flex items-center justify-between sticky top-0 z-10" style={{ borderColor: 'var(--cream3)' }}>
        <div className="font-display text-2xl font-light" style={{ color: 'var(--brown)' }}>
          Serenus<span style={{ color: 'var(--sage)' }}>.</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/buscar" className="text-sm px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--brown2)' }}>
            Encontrar profissional
          </Link>
          <Link href="/login" className="btn-outline text-sm py-1.5 px-4">Entrar</Link>
          <Link href="/register" className="btn-primary text-sm py-1.5 px-4">Cadastrar</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 text-center" style={{ background: 'linear-gradient(135deg, var(--cream) 0%, var(--cream2) 100%)' }}>
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-40 -translate-y-1/2 translate-x-1/3" style={{ background: 'var(--sage4)' }} />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-30 translate-y-1/2 -translate-x-1/4" style={{ background: 'var(--cream3)' }} />
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-block text-xs font-medium uppercase tracking-widest px-4 py-1.5 rounded-full mb-8" style={{ background: 'var(--sage4)', color: 'var(--sage)' }}>
            ✦ Bem-estar sob demanda
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-light leading-tight mb-6" style={{ color: 'var(--brown)', letterSpacing: '-0.02em' }}>
            Encontre seu massoterapeuta <em className="not-italic" style={{ color: 'var(--sage2)' }}>ideal</em>
          </h1>
          <p className="text-lg font-light mb-10 max-w-xl mx-auto" style={{ color: 'var(--brown2)' }}>
            Profissionais verificados, agenda transparente e pagamento seguro. Do sofá para suas mãos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/buscar" className="btn-primary text-base px-8 py-3.5">
              Encontrar profissional →
            </Link>
            <Link href="/register?tipo=profissional" className="btn-outline text-base px-8 py-3.5">
              Sou massoterapeuta
            </Link>
          </div>

          {/* Search pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-8">
            {['💆 Relaxamento','🌿 Shiatsu','🔥 Hot Stone','💧 Drenagem','🏃 Esportiva','🤰 Gestante'].map(s => (
              <Link key={s} href={`/buscar?especialidade=${encodeURIComponent(s.split(' ')[1])}`}
                className="text-sm px-4 py-2 rounded-full border transition-all hover:border-[var(--sage3)] hover:text-[var(--sage)] hover:bg-[var(--sage4)]"
                style={{ background: 'white', borderColor: 'var(--cream3)', color: 'var(--brown2)' }}>
                {s}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-y" style={{ background: 'white', borderColor: 'var(--cream3)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--brown3)' }}>Como funciona</p>
          <h2 className="font-display text-4xl font-light mb-16" style={{ color: 'var(--brown)' }}>Simples assim</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num:'1', title:'Busque', text:'Filtre por especialidade, localização, preço e disponibilidade' },
              { num:'2', title:'Escolha', text:'Veja perfis, avaliações e selecione o horário ideal para você' },
              { num:'3', title:'Reserve', text:'Pague com segurança e receba confirmação imediata por e-mail' },
              { num:'4', title:'Relaxe', text:'Aproveite sua sessão e depois avalie o profissional' },
            ].map(s => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-light mx-auto mb-4"
                  style={{ background: 'var(--sage4)', color: 'var(--sage)' }}>{s.num}</div>
                <h3 className="font-medium mb-2" style={{ color: 'var(--brown)' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--brown2)' }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon:'🛡️', title:'Profissionais verificados', text:'Todos passam por análise de certificações e documentos antes de serem aprovados.' },
              { icon:'💳', title:'Pagamento seguro', text:'Pré-pagamento com proteção total. Reembolso garantido com mais de 24h de antecedência.' },
              { icon:'⭐', title:'Avaliações reais', text:'Só clientes que realizaram a sessão podem avaliar. Transparência total.' },
            ].map(b => (
              <div key={b.title} className="card p-6">
                <div className="text-3xl mb-4">{b.icon}</div>
                <h3 className="font-medium mb-2" style={{ color: 'var(--brown)' }}>{b.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--brown2)' }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA profissional */}
      <section className="py-20 px-6 text-center" style={{ background: 'var(--brown)' }}>
        <p className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: 'var(--sage3)' }}>Para profissionais</p>
        <h2 className="font-display text-4xl font-light mb-4" style={{ color: 'white', letterSpacing: '-0.02em' }}>
          Expanda sua clientela <em className="not-italic" style={{ color: 'var(--gold2)' }}>sem esforço</em>
        </h2>
        <p className="max-w-md mx-auto mb-8 font-light" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Cadastre seu perfil, defina sua agenda e comece a receber clientes ainda esta semana. Planos a partir de R$0.
        </p>
        <Link href="/register" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-medium text-white transition-colors"
          style={{ background: 'var(--sage)' }}>
          Quero cadastrar meu perfil →
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t text-center" style={{ background: 'var(--cream2)', borderColor: 'var(--cream3)' }}>
        <div className="font-display text-xl font-light mb-2" style={{ color: 'var(--brown)' }}>
          Serenus<span style={{ color: 'var(--sage)' }}>.</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--brown3)' }}>
          © {new Date().getFullYear()} Serenus · <a href="mailto:suporte@serenus.com.br" style={{ color: 'var(--sage)' }}>suporte@serenus.com.br</a>
        </p>
      </footer>
    </div>
  );
}
