import type { AppProps } from 'next/app'
import { VitralNext } from 'vitral/next-host'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <VitralNext />
      <Component {...pageProps} />
    </>
  )
}
