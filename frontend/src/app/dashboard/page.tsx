'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { bookingsAPI, adminAPI, prosAPI } from '@/lib/api';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('overview');
  const [data, setData] = useState<any>({});
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchSection(activeSection);
  }, [user, activeSection]);

  async function fetchSection(section: string) {
    setFetching(true);
    try {
      if (section === 'overview' || section === 'bookings') {
        const res = await bookingsAPI.list();
        setData((d: any) => ({ ...d, bookings: res.data.bookings || [] }));
      }
      if (user?.role === 'admin' && (section === 'overview' || section === 'stats')) {
        const res = await adminAPI.stats();
        setData((d: any) => ({ ...d, stats: res.data }));
      }
      if (user?.role === 'admin' && section === 'approvals') {
        const res = await prosAPI.getPending();
        setData((d: any) => ({ ...d, pending: res.data }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/');
    toast.success('Até logo!');
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      const res = await bookingsAPI.cancel(id);
      toast.success(res.data.message);
      fetchSection('bookings');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao cancelar');
    }
  }

  async function handleComplete(id: string) {
    try {
      await bookingsAPI.complete(id);
      toast.success('Sessão concluída!');
      fetchSection('overview');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro');
    }
  }

  async function handleApprove(id: string) {
    try {
      await prosAPI.approve(id);
      toast.success('Profissional aprovado!');
      fetchSection('approvals');
    } catch (err: any) {
      toast.error('Erro ao aprovar');
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
      <div className="text-center">
        <div className="text-4xl mb-4">🌿</div>
        <p style={{ color: 'var(--brown2)' }}>Carregando...</p>
      </div>
    </div>
  );

  if (!user) return null;

  const navItems = {
    client: [
      { id: 'overview', icon: '📊', label: 'Visão geral' },
      { id: 'bookings', icon: '📅', label: 'Minhas reservas' },
      { id: 'profile', icon: '👤', label: 'Meu perfil' },
    ],
    professional: [
      { id: 'overview', icon: '📊', label: 'Visão geral' },
      { id: 'bookings', icon: '📅', label: 'Agenda' },
      { id: 'profile', icon: '🧑‍⚕️', label: 'Meu perfil' },
    ],
    admin: [
      { id: 'overview', icon: '📊', label: 'Dashboard' },
      { id: 'approvals', icon: '✅', label: 'Aprovações' },
      { id: 'bookings', icon: '📅', label: 'Reservas' },
      { id: 'stats', icon: '📈', label: 'Estatísticas' },
    ],
  };

  const items = navItems[user.role] || navItems.client;
  const bookings = data.bookings || [];
  const stats = data.stats || {};
  const pending = data.pending || [];

  const statusMap: any = {
    confirmed: { label: 'Confirmado', cls: 'bg-green-50 text-green-700' },
    pending: { label: 'Pendente', cls: 'bg-yellow-50 text-yellow-700' },
    completed: { label: 'Concluído', cls: 'bg-gray-100 text-gray-600' },
    cancelled_client: { label: 'Cancelado', cls: 'bg-red-50 text-red-600' },
    cancelled_pro: { label: 'Cancelado pelo prof.', cls: 'bg-red-50 text-red-600' },
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
      {/* Top nav */}
      <nav className="bg-white border-b px-6 h-16 flex items-center justify-between sticky top-0 z-10" style={{ borderColor: 'var(--cream3)' }}>
        <a href="/" className="font-display text-xl font-light" style={{ color: 'var(--brown)' }}>
          Serenus<span style={{ color: 'var(--sage)' }}>.</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/buscar" className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--cream)]" style={{ color: 'var(--brown2)' }}>🔍 Buscar</a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--sage3)] flex items-center justify-center text-sm font-medium" style={{ color: 'var(--sage)' }}>
              {user.name[0]}{user.surname[0]}
            </div>
            <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--brown)' }}>{user.name}</span>
          </div>
          <button onClick={handleLogout} className="btn-outline text-xs py-1.5 px-3">Sair</button>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r hidden md:block" style={{ borderColor: 'var(--cream3)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--cream3)' }}>
            <p className="font-medium text-sm" style={{ color: 'var(--brown)' }}>{user.name} {user.surname}</p>
            <p className="text-xs capitalize" style={{ color: 'var(--brown3)' }}>
              {user.role === 'professional' ? 'Massoterapeuta' : user.role === 'admin' ? 'Administrador' : 'Cliente'}
            </p>
          </div>
          <nav className="py-2">
            {items.map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 text-sm transition-all ${activeSection === item.id ? 'font-medium border-r-2' : ''}`}
                style={{
                  color: activeSection === item.id ? 'var(--brown)' : 'var(--brown2)',
                  background: activeSection === item.id ? 'var(--cream)' : 'transparent',
                  borderColor: activeSection === item.id ? 'var(--brown)' : 'transparent',
                }}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 md:p-8">
          {/* OVERVIEW */}
          {activeSection === 'overview' && (
            <div>
              <h1 className="font-display text-2xl font-light mb-1" style={{ color: 'var(--brown)' }}>
                Olá, {user.name}! 🌿
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--brown2)' }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>

              {user.role === 'admin' && stats.users && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Usuários', value: stats.users?.total || 0 },
                    { label: 'Profissionais', value: stats.professionals?.approved || 0 },
                    { label: 'Reservas', value: stats.bookings?.total || 0 },
                    { label: 'Receita (taxa)', value: `R$${parseFloat(stats.revenue?.fees || 0).toFixed(2)}` },
                  ].map(s => (
                    <div key={s.label} className="card p-5">
                      <div className="font-display text-2xl font-light" style={{ color: 'var(--brown)' }}>{s.value}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--brown2)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--cream3)' }}>
                  <h2 className="font-medium" style={{ color: 'var(--brown)' }}>
                    {user.role === 'professional' ? 'Próximas sessões' : 'Minhas reservas'}
                  </h2>
                  <a href="/buscar" className="btn-sage text-xs py-1.5 px-3">+ Agendar</a>
                </div>
                {fetching ? (
                  <div className="p-8 text-center text-sm" style={{ color: 'var(--brown2)' }}>Carregando...</div>
                ) : bookings.length ? (
                  bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="px-5 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--cream3)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--sage3)' }}>💆</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--brown)' }}>
                          {user.role === 'professional' ? b.client_name : b.pro_name} {user.role !== 'professional' && b.pro_surname}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--brown2)' }}>
                          {b.service_name} · {new Date(b.scheduled_at).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · R${b.total_amount}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusMap[b.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                          {statusMap[b.status]?.label || b.status}
                        </span>
                        {b.status === 'confirmed' && user.role === 'client' && (
                          <button onClick={() => handleCancel(b.id)} className="text-xs text-red-600 hover:underline">Cancelar</button>
                        )}
                        {b.status === 'confirmed' && user.role === 'professional' && (
                          <button onClick={() => handleComplete(b.id)} className="btn-sage text-xs py-1 px-2">Concluir</button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <p className="font-display text-lg font-light mb-1" style={{ color: 'var(--brown)' }}>Nenhuma reserva</p>
                    <a href="/buscar" className="btn-sage inline-block mt-3 text-sm">Encontrar profissional</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APPROVALS - Admin */}
          {activeSection === 'approvals' && user.role === 'admin' && (
            <div>
              <h1 className="font-display text-2xl font-light mb-6" style={{ color: 'var(--brown)' }}>Aprovações pendentes</h1>
              <div className="card">
                {pending.length ? pending.map((p: any) => (
                  <div key={p.id} className="px-5 py-4 border-b flex items-start gap-4" style={{ borderColor: 'var(--cream3)' }}>
                    <div className="w-10 h-10 rounded-full bg-[var(--sage3)] flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {p.name?.[0]}{p.surname?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: 'var(--brown)' }}>{p.name} {p.surname}</p>
                      <p className="text-xs" style={{ color: 'var(--brown2)' }}>{p.email} · {p.city}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--brown3)' }}>
                        Especialidades: {p.specialties?.join(', ')} · {p.experience_years} anos
                      </p>
                      {p.certifications?.length > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brown3)' }}>📄 {p.certifications.join('; ')}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleApprove(p.id)} className="btn-sage text-xs py-1.5 px-3">✓ Aprovar</button>
                      <button onClick={() => { const r = prompt('Motivo da rejeição:'); if(r) prosAPI.reject(p.id,r).then(()=>{toast.success('Rejeitado');fetchSection('approvals')}).catch(()=>toast.error('Erro')); }} className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-red-50 text-red-600" style={{ borderColor: '#fecaca' }}>✕ Rejeitar</button>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-display text-lg font-light" style={{ color: 'var(--brown)' }}>Nenhuma pendência</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOOKINGS detail */}
          {activeSection === 'bookings' && (
            <div>
              <h1 className="font-display text-2xl font-light mb-6" style={{ color: 'var(--brown)' }}>
                {user.role === 'professional' ? 'Agenda completa' : 'Minhas reservas'}
              </h1>
              <div className="card">
                {fetching ? <div className="p-8 text-center text-sm" style={{ color: 'var(--brown2)' }}>Carregando...</div> :
                  bookings.length ? bookings.map((b: any) => (
                    <div key={b.id} className="px-5 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--cream3)' }}>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: 'var(--brown)' }}>
                          {user.role === 'professional' ? `${b.client_name} ${b.client_surname}` : `${b.pro_name} ${b.pro_surname}`}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brown2)' }}>
                          {b.service_name} · {new Date(b.scheduled_at).toLocaleString('pt-BR', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--brown3)' }}>💰 R${b.total_amount} · #{b.id.substring(0,8).toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusMap[b.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                          {statusMap[b.status]?.label || b.status}
                        </span>
                        {b.status === 'confirmed' && user.role === 'client' && (
                          <button onClick={() => handleCancel(b.id)} className="text-xs text-red-500 hover:underline">Cancelar</button>
                        )}
                        {b.status === 'confirmed' && user.role === 'professional' && (
                          <button onClick={() => handleComplete(b.id)} className="btn-sage text-xs py-1 px-2">Concluir</button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center">
                      <div className="text-4xl mb-3">📅</div>
                      <p style={{ color: 'var(--brown2)' }}>Nenhuma reserva encontrada</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div>
              <h1 className="font-display text-2xl font-light mb-6" style={{ color: 'var(--brown)' }}>Meu perfil</h1>
              <div className="card p-6 max-w-lg">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--cream3)' }}>
                  <div className="w-16 h-16 rounded-full bg-[var(--sage3)] flex items-center justify-center text-2xl font-medium" style={{ color: 'var(--sage)' }}>
                    {user.name[0]}{user.surname[0]}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--brown)' }}>{user.name} {user.surname}</p>
                    <p className="text-sm" style={{ color: 'var(--brown2)' }}>{user.email}</p>
                    <p className="text-xs mt-1" style={{ color: user.email_verified ? 'var(--sage)' : 'var(--gold)' }}>
                      {user.email_verified ? '✓ E-mail verificado' : '⚠️ E-mail não verificado'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Nome</label><input className="form-input" defaultValue={user.name} /></div>
                  <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>E-mail</label><input className="form-input" defaultValue={user.email} type="email" /></div>
                  <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Nova senha</label><input className="form-input" type="password" placeholder="••••••••" /></div>
                  <button className="btn-primary" onClick={() => toast.success('Perfil atualizado!')}>Salvar alterações</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
