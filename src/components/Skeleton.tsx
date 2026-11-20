'use client'

type SkeletonProps = {
  linhas?: number
  bloco?: boolean
  label?: string
  className?: string
}

/** Placeholder com altura reservada: o conteúdo real entra sem saltar o layout. */
export default function Skeleton({
  linhas = 3,
  bloco = true,
  label = 'Carregando…',
  className = '',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`space-y-3 ${className}`}
    >
      {Array.from({ length: linhas }, (_, indice) => (
        <div
          key={indice}
          className="skeleton h-4"
          style={{ width: indice === linhas - 1 ? '62%' : '100%' }}
        />
      ))}
      {bloco && <div className="skeleton h-48 w-full" />}
    </div>
  )
}
