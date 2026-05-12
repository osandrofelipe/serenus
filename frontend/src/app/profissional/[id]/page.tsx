'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { prosAPI, bookingsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function StarRating({ rating, count }: { rating: number; count: number }) {
  const r = parseFloat(rating as any) || 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-amber-400">{'★'.repeat(Math.round(r))}{'☆'.repeat(5-Math.round(r))}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--brown)' }}>{r.toFixed(1)}</span>
      <span className="text-sm" style={{ color: 'var(--brown3)' }}>({count} avaliações)</span>
    </div>
  );
}

export default function ProProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [pro, setPro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sobre');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingStep, setBookingStep] = useState<'select'|'confirm'|'done'>('select');
  const [serviceType, setServiceType] = useState<'local'|'home'>('local');
  const [serviceAddress, setServiceAddress] = useState('');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    prosAPI.get(id).then(res => {
      setPro(res.data);
      if (res.data.services?.length) setSelectedService(res.data.services[0]);
    }).catch(() => toast.error('Profissional não encontrado')).finally(() => setLoading(false));
  }, [id]);

  // Generate next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  async function loadSlots(date: string) {
    setSelectedDate(date);
    setSelectedSlot('');
    setLoadingSlots(true);
    try {
      const res = await prosAPI.getAvailability(id, date);
      setSlots(res.data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook() {
    if (!user) { router.push('/login'); return; }
    if (!selectedService || !selectedSlot || !selectedDate) {
      toast.error('Selecione serviço, data e horário');
      return;
    }
    if (serviceType === 'home' && !serviceAddress.trim()) {
      toast.error('Informe o endereço para atendimento domiciliar');
      return;
    }
    setBooking(true);
    try {
      const scheduledAt = `${selectedDate}T${selectedSlot}:00`;
      const res = await bookingsAPI.create({
        professional_id: id,
        service_id: selectedService.id,
        scheduled_at: scheduledAt,
        service_type: serviceType,
        service_address: serviceType === 'home' ? serviceAddress : undefined,
      });
      toast.success('Reserva criada com sucesso! ✅');
      setBookingStep('done');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao criar reserva');
    } finally {
      setBooking(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
      <div className="text-4xl animate-pulse">🌿</div>
    </div>
  );

  if (!pro) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
      <div className="text-center">
        <div className="text-4xl mb-4">😔</div>
        <p style={{ color: 'var(--brown2)' }}>Profissional não encontrado</p>
        <Link href="/buscar" className="btn-sage inline-block mt-4">Voltar à busca</Link>
      </div>
    </div>
  );

  const totalFee = selectedService ? parseFloat(selectedService.price) : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Nav */}
      <nav className="bg-white border-b px-6 h-14 flex items-center justify-between sticky top-0 z-10" style={{ borderColor: 'var(--cream3)' }}>
        <Link href="/" className="font-display text-xl font-light" style={{ color: 'var(--brown)' }}>
          Serenus<span style={{ color: 'var(--sage)' }}>.</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/buscar" className="btn-outline text-sm py-1.5 px-3">← Buscar</Link>
          {user ? (
            <Link href="/dashboard" className="btn-primary text-sm py-1.5 px-3">Painel</Link>
          ) : (
            <Link href="/login" className="btn-primary text-sm py-1.5 px-3">Entrar</Link>
          )}
        </div>
      </nav>

      {/* Profile header */}
      <div className="border-b" style={{ background: 'linear-gradient(135deg, var(--cream), var(--cream2))', borderColor: 'var(--cream3)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8 flex gap-6 items-end">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--sage4), var(--cream3))' }}>
            {pro.avatar_url ? <img src={pro.avatar_url} className="w-full h-full object-cover rounded-full" /> : '🌿'}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="font-display text-2xl font-light" style={{ color: 'var(--brown)' }}>
                {pro.name} {pro.surname}
              </h1>
              {pro.plan === 'pro' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sage4)', color: 'var(--sage)' }}>✓ Pro verificado</span>
              )}
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--brown2)' }}>
              {pro.specialties?.join(' · ')} — {pro.city}, {pro.state}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <StarRating rating={pro.rating_avg} count={pro.rating_count} />
              <span style={{ color: 'var(--brown2)' }}>📅 {pro.experience_years} anos de exp.</span>
              {pro.home_service && <span style={{ color: 'var(--brown2)' }}>🏠 Atende domicílio</span>}
              <span style={{ color: 'var(--brown2)' }}>💰 A partir de R${parseFloat(pro.base_price||0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Info */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex border-b mb-6" style={{ borderColor: 'var(--cream3)' }}>
            {['sobre','serviços','avaliações'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium capitalize border-b-2 -mb-px transition-all ${activeTab===tab ? 'border-[var(--brown)]' : 'border-transparent'}`}
                style={{ color: activeTab===tab ? 'var(--brown)' : 'var(--brown2)' }}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'sobre' && (
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="font-medium mb-3" style={{ color: 'var(--brown)' }}>Sobre</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--brown2)' }}>{pro.bio || 'Sem descrição.'}</p>
              </div>
              {pro.certifications?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-medium mb-3" style={{ color: 'var(--brown)' }}>Formação e certificações</h3>
                  <ul className="space-y-2">
                    {pro.certifications.map((c: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--brown2)' }}>
                        <span className="text-base flex-shrink-0">🎓</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'serviços' && (
            <div className="card divide-y" style={{ borderColor: 'var(--cream3)' }}>
              {pro.services?.map((s: any) => (
                <div key={s.id} className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm mb-0.5" style={{ color: 'var(--brown)' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: 'var(--brown2)' }}>⏱ {s.duration_minutes} minutos</p>
                    {s.description && <p className="text-xs mt-1" style={{ color: 'var(--brown3)' }}>{s.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium mb-2" style={{ color: 'var(--brown)' }}>R${parseFloat(s.price).toFixed(0)}</p>
                    <button onClick={() => { setSelectedService(s); setActiveTab('sobre'); document.getElementById('bookingPanel')?.scrollIntoView({behavior:'smooth'}); }}
                      className="btn-sage text-xs py-1.5 px-3">Agendar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'avaliações' && (
            <div>
              {pro.reviews?.length ? (
                <div className="space-y-4">
                  {pro.reviews.map((r: any) => (
                    <div key={r.id} className="card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[var(--cream3)] flex items-center justify-center text-xs font-medium" style={{ color: 'var(--brown2)' }}>
                            {r.client_name?.[0]}
                          </div>
                          <span className="font-medium text-sm" style={{ color: 'var(--brown)' }}>{r.client_name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-400 text-sm">{'★'.repeat(r.rating)}</div>
                          <div className="text-xs" style={{ color: 'var(--brown3)' }}>
                            {new Date(r.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--brown2)' }}>{r.comment}</p>
                      {r.professional_reply && (
                        <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--sage4)', color: 'var(--sage)' }}>
                          <strong>Resposta do profissional:</strong> {r.professional_reply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">⭐</div>
                  <p className="font-display text-lg font-light" style={{ color: 'var(--brown)' }}>Sem avaliações ainda</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--brown2)' }}>Seja o primeiro a avaliar!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Booking panel */}
        <div id="bookingPanel" className="lg:sticky lg:top-20">
          <div className="card p-5">
            {bookingStep === 'done' ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-display text-lg font-light mb-2" style={{ color: 'var(--brown)' }}>Reserva confirmada!</h3>
                <p className="text-sm mb-5" style={{ color: 'var(--brown2)' }}>Você receberá uma confirmação por e-mail.</p>
                <Link href="/dashboard" className="btn-primary block text-center">Ver minha agenda</Link>
                <button onClick={() => setBookingStep('select')} className="text-sm mt-3" style={{ color: 'var(--sage)' }}>
                  Agendar outra sessão
                </button>
              </div>
            ) : bookingStep === 'confirm' ? (
              <div>
                <button onClick={() => setBookingStep('select')} className="text-sm mb-4 flex items-center gap-1" style={{ color: 'var(--brown2)' }}>
                  ← Voltar
                </button>
                <h3 className="font-medium mb-4" style={{ color: 'var(--brown)' }}>Confirmar reserva</h3>
                <div className="rounded-xl p-4 mb-4 text-sm space-y-2" style={{ background: 'var(--cream2)' }}>
                  <p><strong>{selectedService?.name}</strong></p>
                  <p style={{ color: 'var(--brown2)' }}>📅 {selectedDate ? new Date(selectedDate+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}) : ''} às {selectedSlot}</p>
                  <p style={{ color: 'var(--brown2)' }}>⏱ {selectedService?.duration_minutes} minutos</p>
                  <p style={{ color: 'var(--brown2)' }}>📍 {serviceType === 'home' ? 'Domicílio' : 'No local'}</p>
                </div>
                {serviceType === 'home' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--brown)' }}>Endereço *</label>
                    <input className="form-input text-sm" placeholder="Rua, número, bairro, cidade"
                      value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} />
                  </div>
                )}
                <div className="border-t pt-3 mb-4" style={{ borderColor: 'var(--cream3)' }}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--brown2)' }}>Serviço</span>
                    <span>R${parseFloat(selectedService?.price||0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--brown2)' }}>Taxa Serenus (15%)</span>
                    <span style={{ color: 'var(--brown3)' }}>inclusa</span>
                  </div>
                  <div className="flex justify-between font-medium mt-2 pt-2 border-t" style={{ borderColor: 'var(--cream3)' }}>
                    <span>Total</span>
                    <span>R${parseFloat(selectedService?.price||0).toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={handleBook} disabled={booking}
                  className="btn-primary w-full justify-center flex text-sm py-3">
                  {booking ? '⏳ Processando...' : '✅ Confirmar reserva'}
                </button>
                <p className="text-center text-xs mt-2" style={{ color: 'var(--brown3)' }}>
                  🔒 Pagamento seguro · Reembolso com +24h
                </p>
              </div>
            ) : (
              <div>
                <h3 className="font-medium mb-4" style={{ color: 'var(--brown)' }}>
                  Agendar sessão
                  <span className="float-right font-light text-sm" style={{ color: 'var(--brown3)' }}>
                    a partir de R${parseFloat(pro.base_price||0).toFixed(0)}
                  </span>
                </h3>

                {/* Service select */}
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Serviço</label>
                  <select className="form-input text-sm"
                    value={selectedService?.id || ''}
                    onChange={e => setSelectedService(pro.services?.find((s: any) => s.id === e.target.value))}>
                    {pro.services?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} — R${parseFloat(s.price).toFixed(0)} ({s.duration_minutes}min)</option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                {pro.home_service && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Modalidade</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['local','home'] as const).map(t => (
                        <button key={t} onClick={() => setServiceType(t)}
                          className={`py-2 rounded-lg text-xs font-medium transition-all ${serviceType===t ? 'btn-primary' : 'btn-outline'}`}>
                          {t === 'local' ? '🏢 No local' : '🏠 Domicílio'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date picker */}
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Data</label>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {days.map(d => {
                      const dateStr = d.toISOString().split('T')[0];
                      const isToday = d.toDateString() === new Date().toDateString();
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button key={dateStr} onClick={() => loadSlots(dateStr)}
                          className={`flex-shrink-0 w-12 py-2 rounded-lg text-center text-xs transition-all ${isSelected ? 'text-white' : ''}`}
                          style={{ background: isSelected ? 'var(--brown)' : 'var(--cream2)', color: isSelected ? 'white' : 'var(--brown2)' }}>
                          <div className="font-medium">{d.getDate()}</div>
                          <div className="text-[10px]">{isToday ? 'Hoje' : d.toLocaleDateString('pt-BR',{weekday:'short'})}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slots */}
                {selectedDate && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--brown3)' }}>Horário</label>
                    {loadingSlots ? (
                      <div className="text-xs text-center py-3" style={{ color: 'var(--brown3)' }}>Carregando horários...</div>
                    ) : slots.length ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {slots.map(slot => (
                          <button key={slot.time} disabled={!slot.available}
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`py-2 rounded-lg text-xs font-medium transition-all ${!slot.available ? 'opacity-40 cursor-not-allowed' : ''} ${selectedSlot===slot.time ? 'text-white' : ''}`}
                            style={{
                              background: !slot.available ? 'var(--cream3)' : selectedSlot===slot.time ? 'var(--brown)' : 'var(--cream2)',
                              color: !slot.available ? 'var(--brown3)' : selectedSlot===slot.time ? 'white' : 'var(--brown2)',
                            }}>
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--brown3)' }}>
                        Sem horários disponíveis nesta data
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!user) { router.push('/login'); return; }
                    if (!selectedSlot) { toast.error('Selecione uma data e horário'); return; }
                    setBookingStep('confirm');
                  }}
                  disabled={!selectedSlot}
                  className={`btn-primary w-full justify-center flex text-sm py-3 ${!selectedSlot ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {selectedSlot ? 'Continuar →' : 'Selecione um horário'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
