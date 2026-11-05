import type { AppProps } from 'next/app'
import { VitralNext } from 'vitral/next-host'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <VitralNext lang={i18n.language} />
      <Component {...pageProps} />
    </>
  )
}
