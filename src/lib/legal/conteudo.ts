export type SecaoLegal = {
  titulo: string
  paragrafos: string[]
}

export type DocumentoLegal = {
  titulo: string
  vigencia: string
  aviso: string
  secoes: SecaoLegal[]
}

const VIGENCIA = '21/11/2026'
const AVISO_PTBR = 'A versão em português do Brasil prevalece em caso de divergência.'
const CONTATO = 'macedoartur1250@gmail.com'
const CONTROLADOR = 'Artur Fernandes Macêdo Vinhas'

export const DOCUMENTOS: Record<'privacidade' | 'termos' | 'cookies', DocumentoLegal> = {
  privacidade: {
    titulo: 'Política de Privacidade',
    vigencia: VIGENCIA,
    aviso: AVISO_PTBR,
    secoes: [
      {
        titulo: 'Controlador e canal de contato',
        paragrafos: [
          `O controlador dos dados tratados neste serviço é ${CONTROLADOR}, pessoa física, sem CNPJ informado.`,
          `O canal público de contato para assuntos de privacidade e para o titular é ${CONTATO}. Não há endereço postal informado nem encarregado de dados nomeado nesta versão; esse e-mail serve como canal de privacidade.`,
        ],
      },
      {
        titulo: 'Vigência e alterações',
        paragrafos: [
          'Esta política vale a partir da data de vigência indicada no início deste documento.',
          'Podemos atualizar este texto para refletir mudanças no serviço ou na lei. A versão atual e sua data de vigência ficam sempre disponíveis nesta página; alterações relevantes serão comunicadas pelo canal público de contato.',
        ],
      },
      {
        titulo: 'Dados tratados e finalidades',
        paragrafos: [
          'Conta: e-mail, nome, hash da senha, identificador `sub` do Google e verificação de e-mail, usados para autenticar e manter a conta.',
          'Visitas: nome do cliente, tipo, observações e data de captura, usados para registrar a visita e entregar o laudo.',
          'Mídias: Fotos e assinaturas são enviadas ao Cloudflare R2 e ficam com URL pública.',
          'Como a URL da mídia é pública, qualquer pessoa que a receba pode visualizar o arquivo; compartilhe o link de entrega apenas com o destinatário pretendido.',
          'Entrega: token opaco do link `/o/:token`, usado para liberar o laudo ao destinatário sem expor identificadores na URL.',
          'Segurança: chave derivada de IP + e-mail em `tentativas_login`, usada para limitar tentativas e prevenir abuso.',
          'Preferências locais: tema, idioma, movimento, sincronização automática e tamanho de texto, guardados no próprio aparelho.',
        ],
      },
      {
        titulo: 'Bases legais',
        paragrafos: [
          'Execução de contrato para os dados de conta e de visitas, necessários para prestar o serviço.',
          'Legítimo interesse para segurança, prevenção a fraude e manutenção do serviço.',
          'Obrigação legal quando a guarda ou a apresentação de dados for exigida por lei.',
          'Consentimento apenas se houver uso futuro que dependa dele; nenhum uso atual de dados de terceiros depende de banner de consentimento.',
        ],
      },
      {
        titulo: 'Dados de terceiros',
        paragrafos: [
          'O técnico coleta nome, foto e assinatura do cliente. O técnico é responsável pela origem lícita desses dados, pela base legal aplicável à coleta e por decidir com quem o link de entrega será compartilhado.',
        ],
      },
      {
        titulo: 'Compartilhamento e operadores',
        paragrafos: [
          'Usamos Google (OAuth) para autenticação, provedor de e-mail por webhook para mensagens de verificação e recuperação, Cloudflare R2 para mídia com URL pública, Vercel para hospedagem e um provedor de Postgres para o banco de dados.',
          'Não vendemos dados pessoais e não os compartilhamos para publicidade ou perfilamento.',
        ],
      },
      {
        titulo: 'Transferência internacional',
        paragrafos: [
          'Alguns operadores podem processar dados fora do Brasil. Nesses casos, exigimos garantias contratuais de proteção equivalentes às da LGPD, na forma da Resolução ANPD nº 19/2024, incluindo cláusulas-padrão quando necessárias.',
        ],
      },
      {
        titulo: 'Retenção dos dados',
        paragrafos: [
          'Os cookies `sessao` e `oauth` expiram, respectivamente, em 7 dias e 10 minutos. Tokens de verificação e redefinição já têm validade curta implementada.',
          'Visitas, fotos e assinaturas são mantidas enquanto a conta estiver ativa ou até pedido de exclusão.',
          'Não existe hoje rotina automática de expurgo; pedidos são atendidos manualmente pelo canal de contato.',
        ],
      },
      {
        titulo: 'Direitos do titular',
        paragrafos: [
          'Nos termos do art. 18 da LGPD, você pode pedir confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio, exclusão, portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas.',
          `O atendimento é gratuito e segue os prazos legais. Envie sua solicitação para ${CONTATO}. Você também pode apresentar petição à Autoridade Nacional de Proteção de Dados (ANPD) quando julgar necessário.`,
          'Não há hoje exportação ou exclusão self-service: os pedidos são atendidos manualmente pelo mesmo canal.',
        ],
      },
      {
        titulo: 'Uso condicional do serviço',
        paragrafos: [
          'O tratamento desses dados é condição para usar o serviço.',
          'Sem os dados de conta não é possível autenticar; sem os dados da visita e da mídia não é possível gerar e entregar o laudo.',
        ],
      },
      {
        titulo: 'Segurança',
        paragrafos: [
          'Senhas são armazenadas com Argon2, o fluxo Google usa PKCE, os cookies de autenticação são HttpOnly, SameSite e Secure em produção, as consultas são escopadas por tenant e o service worker não armazena dados em cache offline.',
        ],
      },
      {
        titulo: 'Incidentes',
        paragrafos: [
          `Comprometemo-nos a comunicar incidentes de segurança relevantes pelo canal público ${CONTATO}, com as informações disponíveis e dentro dos prazos aplicáveis.`,
        ],
      },
      {
        titulo: 'Crianças',
        paragrafos: [
          'O serviço não é dirigido a crianças e não busca coletar dados delas.',
        ],
      },
      {
        titulo: 'Valor do PDF',
        paragrafos: [
          'O PDF gerado tem valor documental, mas não substitui perícia, laudo técnico regulamentado nem orientação jurídica.',
        ],
      },
    ],
  },

  termos: {
    titulo: 'Termos de Uso',
    vigencia: VIGENCIA,
    aviso: AVISO_PTBR,
    secoes: [
      {
        titulo: 'Aceite e quem contrata',
        paragrafos: [
          'Ao usar o LaudoRápido, você declara ter lido e aceitado estes termos. Contrata o técnico que utiliza o serviço ou a empresa que ele representa.',
        ],
      },
      {
        titulo: 'Descrição do serviço',
        paragrafos: [
          'O serviço permite captura de visitas com fotos e assinatura em modo offline-first, sincronização quando há conexão, geração de PDF no momento da visita e entrega por link opaco.',
        ],
      },
      {
        titulo: 'Elegibilidade e acesso',
        paragrafos: [
          'O acesso é privado e restrito, podendo ser revogado a qualquer momento. Não há cadastro aberto nesta versão.',
        ],
      },
      {
        titulo: 'Responsabilidades do usuário',
        paragrafos: [
          'Você responde pela exatidão dos dados informados, pela licitude da coleta de fotos e da assinatura do cliente e por compartilhar o link de entrega apenas com o destinatário.',
        ],
      },
      {
        titulo: 'Propriedade e licença',
        paragrafos: [
          'O conteúdo inserido permanece sob sua responsabilidade e titularidade. Você nos concede licença limitada para armazenar, processar e entregar esse conteúdo na forma de laudo.',
          'O PDF gerado a partir dos seus dados destina-se ao destinatário da visita e não cria direitos sobre marca, código ou estrutura do serviço.',
        ],
      },
      {
        titulo: 'Limitações',
        paragrafos: [
          'O funcionamento offline depende do aparelho e do armazenamento local; falhas de sincronização podem atrasar a disponibilidade do laudo no servidor.',
          'Há limites práticos para tamanho de mídia e o serviço pode ficar indisponível por manutenção ou falha de infraestrutura, sem promessa de SLA nesta versão.',
        ],
      },
      {
        titulo: 'Suspensão e encerramento',
        paragrafos: [
          'Podemos suspender ou encerrar o acesso quando houver uso indevido, risco de segurança ou solicitação do titular da conta.',
          'O tratamento dos dados nesses casos segue a Política de Privacidade, disponível na navegação deste documento.',
        ],
      },
      {
        titulo: 'Cobrança',
        paragrafos: [
          'Nenhuma cobrança é feita nesta versão.',
          'Se houver cobrança no futuro, os valores, a periodicidade e as condições serão apresentados antes da contratação, sem alteração retroativa destes termos.',
        ],
      },
      {
        titulo: 'Lei aplicável e direitos',
        paragrafos: [
          'Lei brasileira e foro da comarca do controlador.',
          'Nada nestes termos renuncia direitos previstos na LGPD ou no CDC, e não há cláusula que impeça o exercício desses direitos.',
        ],
      },
    ],
  },

  cookies: {
    titulo: 'Política de Cookies',
    vigencia: VIGENCIA,
    aviso: AVISO_PTBR,
    secoes: [
      {
        titulo: 'O que são cookies e armazenamento local',
        paragrafos: [
          'Cookie é um pequeno arquivo que o site guarda no navegador. O armazenamento local cumpre papel parecido, mas fica em áreas próprias do navegador, como localStorage e IndexedDB, e não é enviado a cada requisição.',
          'Nesta política listamos todos os mecanismos usados pelo LaudoRápido e o que cada um faz.',
        ],
      },
      {
        titulo: 'Mecanismos utilizados',
        paragrafos: [
          '`sessao`: cookie essencial de autenticação, com validade de 7 dias, HttpOnly, SameSite=Lax e Secure em produção.',
          '`oauth`: cookie essencial do fluxo Google, com validade de 10 minutos e os mesmos atributos de segurança do cookie de sessão.',
          '`laudo-rapido:preferencias:v1`: entrada em localStorage com tema, idioma, movimento, sincronização automática e tamanho de texto.',
          '`laudo-rapido-offline`: banco IndexedDB com rascunhos, fotos, assinaturas e tokens de entrega pendentes.',
          'Os dois primeiros são necessários para entrar e manter a sessão. Os dois últimos ficam apenas no aparelho do usuário.',
        ],
      },
      {
        titulo: 'Analytics e rastreadores',
        paragrafos: [
          'Não há analytics, anúncios, pixels, perfilamento ou rastreadores de terceiros.',
          'Por isso, não exibimos banner de consentimento nesta versão.',
        ],
      },
      {
        titulo: 'Regra para uso futuro',
        paragrafos: [
          'Se entrar qualquer cookie não essencial, passaremos a exigir opt-in granular, botão de rejeitar tudo e forma simples de retirar o consentimento, conforme orientação da ANPD.',
        ],
      },
      {
        titulo: 'Como limpar os dados locais',
        paragrafos: [
          'Você pode apagar cookies e dados do site nas configurações de privacidade do navegador.',
          'Ao limpar o banco `laudo-rapido-offline`, visitas pendentes não sincronizadas são perdidas. Exporte ou sincronize antes de apagar.',
        ],
      },
      {
        titulo: 'Atualização e privacidade',
        paragrafos: [
          'A data de atualização desta política aparece no início do documento.',
          'Para entender o tratamento dos dados pessoais, consulte a Política de Privacidade, disponível na navegação deste documento.',
        ],
      },
    ],
  },
}
