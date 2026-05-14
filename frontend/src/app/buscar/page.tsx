import { Suspense } from 'react';
import BuscarContent from './BuscarContent';

export default function BuscarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
        <div className="text-4xl animate-pulse">🌿</div>
      </div>
    }>
      <BuscarContent />
    </Suspense>
  );
}