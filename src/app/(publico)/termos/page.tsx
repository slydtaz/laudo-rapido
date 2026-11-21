import Link from 'next/link'

import { DOCUMENTOS } from '@/lib/legal/conteudo'

export default function PaginaTermos() {
  const documento = DOCUMENTOS.termos

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <header className="space-y-2">
        <p className="eyebrow">LaudoRápido</p>
        <h1>{documento.titulo}</h1>
        <p className="eyebrow">Vigência</p>
        <p className="text-sm text-muted">{documento.vigencia}</p>
        <p className="card mt-4 p-4 text-sm leading-relaxed">{documento.aviso}</p>
      </header>

      {documento.secoes.map((secao) => (
        <section key={secao.titulo} className="card space-y-3 p-5 sm:p-8">
          <h2>{secao.titulo}</h2>
          {secao.paragrafos.map((paragrafo) => (
            <p key={paragrafo} className="text-sm leading-relaxed text-muted">
              {paragrafo}
            </p>
          ))}
        </section>
      ))}

      <nav aria-label="Documentos legais" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/privacidade">
          Política de Privacidade
        </Link>
        <Link className="underline" href="/cookies">
          Política de Cookies
        </Link>
      </nav>
    </main>
  )
}
