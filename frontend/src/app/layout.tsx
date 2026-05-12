import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Serenus — Massoterapia sob demanda',
  description: 'Encontre massoterapeutas verificados, agende e pague com segurança.',
  keywords: 'massoterapia, massagem, relaxamento, agendamento, bem-estar',
  openGraph: {
    title: 'Serenus — Massoterapia sob demanda',
    description: 'Profissionais verificados, agenda transparente e pagamento seguro.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#3D2B1F',
                color: '#FFFFFF',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '14px',
              },
              success: { style: { background: '#4A6741' } },
              error: { style: { background: '#991b1b' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
