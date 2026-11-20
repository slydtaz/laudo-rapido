/** Chave versionada: mudanças de formato podem migrar sem ler lixo antigo. */
export const CHAVE_PREFERENCIAS = 'laudo-rapido:preferencias:v1'

export const TEMAS = ['claro', 'escuro', 'sistema'] as const
export type Tema = (typeof TEMAS)[number]

export const IDIOMAS = [
  { codigo: 'ptBR', tag: 'pt-BR', nome: 'Português (Brasil)' },
  { codigo: 'en', tag: 'en', nome: 'English' },
  { codigo: 'es', tag: 'es', nome: 'Español' },
  { codigo: 'fr', tag: 'fr', nome: 'Français' },
  { codigo: 'de', tag: 'de', nome: 'Deutsch' },
] as const
export type Idioma = (typeof IDIOMAS)[number]['codigo']

export const MOVIMENTOS = ['completo', 'reduzido'] as const
export type Movimento = (typeof MOVIMENTOS)[number]

export const TAMANHOS_TEXTO = ['normal', 'grande', 'extra'] as const
export type TamanhoTexto = (typeof TAMANHOS_TEXTO)[number]

export type Preferencias = {
  tema: Tema
  idioma: Idioma
  movimento: Movimento
  autoSync: boolean
  tamanhoTexto: TamanhoTexto
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: 'sistema',
  idioma: 'ptBR',
  movimento: 'completo',
  autoSync: true,
  tamanhoTexto: 'normal',
}

const CODIGOS_IDIOMA = IDIOMAS.map((idioma) => idioma.codigo) as Idioma[]

function umDe<T extends string>(
  valor: unknown,
  opcoes: readonly T[],
  padrao: T,
): T {
  return typeof valor === 'string' && (opcoes as readonly string[]).includes(valor)
    ? (valor as T)
    : padrao
}

/** Nunca lança: localStorage pode estar cheio, bloqueado ou corrompido. */
export function lerPreferencias(): Preferencias {
  const padrao = { ...PREFERENCIAS_PADRAO }
  if (typeof window === 'undefined') return padrao

  try {
    const bruto = window.localStorage.getItem(CHAVE_PREFERENCIAS)
    if (!bruto) return padrao

    const dados: unknown = JSON.parse(bruto)
    if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) return padrao

    const objeto = dados as Record<string, unknown>
    return {
      tema: umDe(objeto.tema, TEMAS, padrao.tema),
      idioma: umDe(objeto.idioma, CODIGOS_IDIOMA, padrao.idioma),
      movimento: umDe(objeto.movimento, MOVIMENTOS, padrao.movimento),
      autoSync: typeof objeto.autoSync === 'boolean' ? objeto.autoSync : padrao.autoSync,
      tamanhoTexto: umDe(objeto.tamanhoTexto, TAMANHOS_TEXTO, padrao.tamanhoTexto),
    }
  } catch {
    return padrao
  }
}

export function salvarPreferencias(preferencias: Preferencias): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias))
  } catch {
    // Armazenamento indisponível: as preferências valem só nesta sessão.
  }
}

export function tagDoIdioma(idioma: Idioma): string {
  return IDIOMAS.find((item) => item.codigo === idioma)?.tag ?? 'pt-BR'
}

/** Espelha as preferências nos atributos que os tokens CSS consomem. */
export function aplicarPreferencias(
  preferencias: Preferencias,
  prefereEscuro = false,
): void {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  raiz.dataset.theme = resolverTema(preferencias.tema, prefereEscuro)
  raiz.dataset.motion = preferencias.movimento
  raiz.dataset.texto = preferencias.tamanhoTexto
  raiz.lang = tagDoIdioma(preferencias.idioma)
}

/** Resolve "sistema" para um tema concreto usando a preferência do SO. */
export function resolverTema(
  tema: Tema,
  prefereEscuro = false,
): 'claro' | 'escuro' {
  if (tema === 'sistema') return prefereEscuro ? 'escuro' : 'claro'
  return tema
}
