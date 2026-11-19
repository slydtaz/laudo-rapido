import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import RegistradorSW from '@/components/RegistradorSW'

import './globals.css'

export const metadata: Metadata = {
  title: 'LaudoRápido',
  description:
    'Laudos de visita técnica offline, com fotos, assinatura do cliente e entrega em PDF.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LaudoRápido',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegistradorSW />
        {children}
      </body>
    </html>
  )
}
