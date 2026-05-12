'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { prosAPI } from '@/lib/api';

const SPECS = ['Relaxamento','Terapêutica','Shiatsu','Hot Stone','Drenagem','Esportiva','Gestante','Reflexologia'];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get('q') || '',
    specialty: searchParams.get('especialidade') || '',
    city: '',
    home_service: false,
    min_price: '',
    max_price: '',
  });

  const fetchPros = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.specialty) params.specialty = filters.specialty;
      if (filters.city) params.city = filters.city;
      if (filters.home_service) params.home_service = 'true';
      if (filters.min_price) params.min_price = filters.min_price;
      if (filters.max_price) params.max_price = filters.max_price;
      const res = await prosAPI.list(params);
      setProfessionals(res.data.professionals || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPros();
  }, [fetchPros]);

  const set = (k: string, v: any) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-6 h-14 flex items-center justify-between sticky top-0 z-10" style={{ borderColor: 'var(--cream3)' }}>
        <Link href="/" className="font-display text-xl font-light" style={{ color: 'var(--brown)' }}>
          Serenus<span style={{ color: 'var(--sage)' }}>.</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/login" className="btn-outline text-sm py-1.5 px-3">Entrar</Link>
          <Link href="/register" className="btn-primary text-sm py-1.5 px-3">Cadastrar</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar filters */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="card p-5 sticky top-20">
            <h2 className="font-medium mb-4" style={{ color: 'var(--brown)' }}>Filtros</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Busca</label>
              <input className="form-input text-sm" placeholder="Nome ou especialidade..."
                value={filters.search} onChange={e => set('search', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPros()} />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Especialidade</label>
              <div className="space-y-1">
                <button onClick={() => set('specialty', '')}
                  className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${!filters.specialty ? 'font-medium' : ''}`}
                  style={{ background: !filters.specialty ? 'var(--sage4)' : 'transparent', color: !filters.specialty ? 'var(--sage)' : 'var(--brown2)' }}>
                  Todas
                </button>
                {SPECS.map(s => (
                  <button key={s} onClick={() => set('specialty', filters.specialty === s ? '' : s)}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${filters.specialty === s ? 'font-medium' : ''}`}
                    style={{ background: filters.specialty === s ? 'var(--sage4)' : 'transparent', color: filters.specialty === s ? 'var(--sage)' : 'var(--brown2)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Cidade</label>
              <input className="form-input text-sm" placeholder="Ex: Natal, Fortaleza..."
                value={filters.city} onChange={e => set('city', e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Preço (R$)</label>
              <div className="flex gap-2">
                <input className="form-input text-sm" placeholder="Mín" type="number"
                  value={filters.min_price} onChange={e => set('min_price', e.target.value)} />
                <input className="form-input text-sm" placeholder="Máx" type="number"
                  value={filters.max_price} onChange={e => set('max_price', e.target.value)} />
              </div>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.home_service} onChange={e => set('home_service', e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: 'var(--brown)' }}>🏠 Atende domicílio</span>
              </label>
            </div>

            <button onClick={fetchPros} className="btn-primary w-full justify-center flex text-sm">
              Aplicar filtros
            </button>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm" style={{ color: 'var(--brown2)' }}>
              {loading ? 'Buscando...' : `${total} profissional${total !== 1 ? 'is' : ''} encontrado${total !== 1 ? 's' : ''}`}
            </p>
            {/* Mobile filter toggle */}
            <button className="lg:hidden btn-outline text-xs py-1.5 px-3">⚙ Filtros</button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="card h-64 animate-pulse" style={{ background: 'var(--cream2)' }} />
              ))}
            </div>
          ) : professionals.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {professionals.map(pro => (
                <Link key={pro.id} href={`/profissional/${pro.id}`}
                  className="card overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer block">
                  {/* Card image area */}
                  <div className="h-44 flex items-center justify-center text-6xl relative"
                    style={{ background: 'linear-gradient(135deg, var(--sage4), var(--cream3))' }}>
                    {pro.avatar_url
                      ? <img src={pro.avatar_url} alt={pro.name} className="w-full h-full object-cover" />
                      : <span>{['🌿','💆','🧘','✨','💐','🌸'][Math.abs(pro.name.charCodeAt(0)) % 6]}</span>
                    }
                    {pro.plan === 'pro' && (
                      <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: 'white', color: 'var(--sage)' }}>✓ Pro</span>
                    )}
                    {pro.home_service && (
                      <span className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full"
                        style={{ background: 'white', color: 'var(--brown2)' }}>🏠</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium" style={{ color: 'var(--brown)' }}>{pro.name} {pro.surname}</h3>
                    <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brown3)' }}>
                      {pro.specialties?.slice(0,2).join(' · ')} — {pro.city}, {pro.state}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <StarRating rating={pro.rating_avg || 0} />
                        <span className="text-xs" style={{ color: 'var(--brown3)' }}>
                          {pro.rating_avg ? `${parseFloat(pro.rating_avg).toFixed(1)}` : 'Novo'} ({pro.rating_count || 0})
                        </span>
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--brown)' }}>
                        R${parseFloat(pro.base_price || 0).toFixed(0)}/h
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="font-display text-xl font-light mb-2" style={{ color: 'var(--brown)' }}>Nenhum resultado</h3>
              <p className="text-sm" style={{ color: 'var(--brown2)' }}>Tente ajustar os filtros de busca</p>
              <button onClick={() => setFilters({ search:'', specialty:'', city:'', home_service:false, min_price:'', max_price:'' })}
                className="btn-outline mt-4 text-sm">Limpar filtros</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
