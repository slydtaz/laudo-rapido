import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'

import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import RegistradorSW from '@/components/RegistradorSW'
import RodapeLegal from '@/components/RodapeLegal'
import ToastProvider from '@/components/ToastProvider'

import './globals.css'

const sora = localFont({
  src: '../fonts/sora-latin.woff2',
  variable: '--font-sora',
  display: 'swap',
  weight: '400 700',
})

const dmSans = localFont({
  src: '../fonts/dm-sans-latin.woff2',
  variable: '--font-dm-sans',
  display: 'swap',
  weight: '400 700',
})

/** Aplica a preferência salva antes da primeira pintura, sem flash de tema. */
const SCRIPT_PREFERENCIAS = `(function(){try{
var p=JSON.parse(localStorage.getItem('laudo-rapido:preferencias:v1')||'{}');
var t=p.tema||'sistema';var e=window.matchMedia('(prefers-color-scheme: dark)').matches;
var r=document.documentElement;
r.dataset.theme=(t==='escuro'||(t==='sistema'&&e))?'escuro':'claro';
r.dataset.motion=p.movimento==='reduzido'?'reduzido':'completo';
r.dataset.texto=(p.tamanhoTexto==='grande'||p.tamanhoTexto==='extra')?p.tamanhoTexto:'normal';
var i={ptBR:'pt-BR',en:'en',es:'es',fr:'fr',de:'de'};r.lang=i[p.idioma]||'pt-BR';
}catch(e){}})();`

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
    // O script abaixo ajusta os atributos antes da pintura; o React não deve
    // reclamar da diferença entre o HTML do servidor e o estado inicial.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${sora.variable} ${dmSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCIAS }} />
      </head>
      <body>
        <ProvedorPreferencias>
          <ToastProvider>
            <RegistradorSW />
            {children}
            <RodapeLegal />
          </ToastProvider>
        </ProvedorPreferencias>
      </body>
    </html>
  )
}
