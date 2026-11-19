export default function HomePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">LaudoRápido</h1>
      <p>Laudos de visita técnica direto do campo, mesmo sem internet.</p>
      <a
        href="/visitas/nova"
        className="inline-block rounded bg-teal-700 px-4 py-2 text-white"
      >
        Registrar nova visita
      </a>
    </main>
  )
}
