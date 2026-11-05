import { NextRemote } from 'vitral/next-host'
import { useTranslation } from 'react-i18next'
import i18n from '../../lib/i18n'

// O remote com as traduções dele, que entram no i18next do host antes de montar.
export default function NsI18n() {
  const { t } = useTranslation('loja')
  return (
    <main>
      <h1>Remote no host Next</h1>
      <button className="lingua" onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'pt-BR' : 'en')}>
        {t('lingua')}
      </button>
      <NextRemote name="ns-i18n" props={{ i18n: true }} fallback={<p className="carregando">carregando</p>} />
    </main>
  )
}
