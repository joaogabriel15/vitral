// Gateway de edge (`vitral/edge`) com `fetch` simulado, sem rede.
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { gateway, toNodeListener, type GatewayOptions } from '../src/edge'
import { decodeEntities, rewrite } from '../src/edge/rewriter'

const CDN = 'https://cdn.exemplo.com/carrinho/'
const sri = (s: string) => 'sha384-' + createHash('sha384').update(s).digest('base64')
const CSS = '.c{color:red;background:url(img/x.png)}'
const MANIFEST = {
  name: 'carrinho',
  entry: `${CDN}carrinho-abc.js`,
  css: ['carrinho-abc.css'],
  integrity: sri('js'),
  scope: 'carrinho',
  files: { [`${CDN}carrinho-abc.js`]: sri('js'), 'carrinho-abc.css': sri(CSS) },
  split: { entry: 'split/entry.js', chunks: [`${CDN}split/chunk.js`] },
}

const PAGE = `<!doctype html><html><head><title>a < b</title></head><body>
<!-- <vitral-remote name="carrinho"></vitral-remote> -->
<script>const t = '<vitral-remote name="carrinho">'</script>
<vitral-remote name="carrinho" props='{"n":2}' isolate="shadow"><p slot="fallback">Carregando</p><p slot="error">Erro</p></vitral-remote>
</body></html>`

/** Host e CDN simulados. `files` troca respostas por URL. */
function server(files: Record<string, string | Response> = {}) {
  const all: Record<string, string | Response> = {
    'https://app.exemplo.com/': PAGE,
    [`${CDN}vitral.json`]: JSON.stringify(MANIFEST),
    [`${CDN}carrinho-abc.css`]: CSS,
    [`${CDN}carrinho-abc.js`]: 'js',
    ...files,
  }
  return vi.fn(async (req: Request) => {
    const body = all[req.url.split('?')[0]]
    if (body instanceof Response) return body
    if (body === undefined) return new Response('não', { status: 404 })
    const type = req.url.endsWith('.json') ? 'application/json' : req.url.endsWith('/') ? 'text/html; charset=utf-8' : 'text/plain'
    return new Response(body, { headers: { 'content-type': type, 'content-encoding': 'gzip', 'content-length': '1', etag: '"x"' } })
  })
}

const setup = (options: Partial<GatewayOptions> = {}, files?: Record<string, string | Response>) => {
  const fetch = server(files)
  const handler = gateway({ origin: 'https://app.exemplo.com', remotes: { carrinho: `${CDN}vitral.json` }, fetch, ...options })
  return { fetch, handler, get: (path: string, init?: RequestInit) => handler(new Request(`https://edge.exemplo.com${path}`, init)) }
}

describe('gateway: remotes na mesma origem', () => {
  it('reescreve o vitral.json para caminhos locais e mantém os hashes', async () => {
    const { get, fetch } = setup()
    const res = await get('/_vitral/carrinho/vitral.json')
    expect(fetch.mock.calls[0][0].url).toBe(`${CDN}vitral.json`)
    const m = await res.json()
    expect(m.entry).toBe('/_vitral/carrinho/carrinho-abc.js')
    expect(m.css).toEqual(['carrinho-abc.css'])
    expect(m.integrity).toBe(MANIFEST.integrity)
    expect(m.files).toEqual({ '/_vitral/carrinho/carrinho-abc.js': sri('js'), 'carrinho-abc.css': sri(CSS) })
    expect(m.split).toEqual({ entry: 'split/entry.js', chunks: ['/_vitral/carrinho/split/chunk.js'] })
    expect(res.headers.get('content-type')).toBe('application/json')
    // O corpo já veio decodificado do fetch; os cabeçalhos do original não valem mais.
    expect(res.headers.get('content-encoding')).toBeNull()
    expect(res.headers.get('etag')).toBeNull()
  })

  it('repassa os arquivos do remote como vieram, com a query', async () => {
    const { get, fetch } = setup({}, { [`${CDN}carrinho-abc.js`]: 'export default 1' })
    const res = await get('/_vitral/carrinho/carrinho-abc.js?v=1')
    expect(fetch.mock.calls[0][0].url).toBe(`${CDN}carrinho-abc.js?v=1`)
    expect(await res.text()).toBe('export default 1')
    expect(res.headers.get('content-length')).toBeNull()
  })

  it('404 para remote desconhecido e para caminho fora da pasta', async () => {
    const { get, fetch } = setup()
    expect((await get('/_vitral/outro/vitral.json')).status).toBe(404)
    expect((await get('/_vitral/carrinho')).status).toBe(404)
    expect((await get('/_vitral/carrinho/%2e%2e/segredo.json')).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('JSON inválido e erro HTTP passam sem mudança', async () => {
    const { get } = setup({}, { [`${CDN}vitral.json`]: '{quebrado', [`${CDN}x.json`]: new Response('fora', { status: 503 }) })
    expect(await (await get('/_vitral/carrinho/vitral.json')).text()).toBe('{quebrado')
    expect((await get('/_vitral/carrinho/x.json')).status).toBe(503)
  })

  it('repassa método, corpo e cabeçalhos para o host, sem host', async () => {
    const { get, fetch } = setup({}, { 'https://app.exemplo.com/api': new Response('ok', { headers: { 'content-type': 'text/plain' } }) })
    const res = await get('/api?x=1', { method: 'POST', body: 'dados', headers: { 'x-a': '1' } })
    const sent: Request = fetch.mock.calls[0][0]
    expect(sent.url).toBe('https://app.exemplo.com/api?x=1')
    expect(sent.method).toBe('POST')
    expect(await sent.text()).toBe('dados')
    expect(sent.headers.get('x-a')).toBe('1')
    expect(sent.headers.get('x-forwarded-host')).toBe('edge.exemplo.com')
    expect(await res.text()).toBe('ok')
  })
})

describe('gateway: HTML', () => {
  it('troca o src do CDN pelo caminho local', async () => {
    const page = `<vitral-remote src="${CDN}vitral.json"></vitral-remote><vitral-remote src="/_vitral/carrinho/vitral.json"></vitral-remote><vitral-remote src="https://outro.com/x.json"></vitral-remote>`
    const { get } = setup({}, { 'https://app.exemplo.com/': page })
    const html = await (await get('/')).text()
    expect(html).toBe(
      '<vitral-remote src="/_vitral/carrinho/vitral.json"></vitral-remote><vitral-remote src="/_vitral/carrinho/vitral.json"></vitral-remote><vitral-remote src="https://outro.com/x.json"></vitral-remote>',
    )
  })

  it('Link na segunda visita (o que a página usou) e já na primeira com preload', async () => {
    const { get, handler } = setup()
    expect((await get('/')).headers.get('link')).toBeNull()
    await (await get('/')).text()
    const links = (await get('/')).headers.get('link')!
    expect(links).toContain('</_vitral/carrinho/split/entry.js>; rel=preload; as=fetch; crossorigin=anonymous')
    expect(links).toContain('</_vitral/carrinho/split/chunk.js>; rel=preload; as=fetch')
    expect(links).toContain('</_vitral/carrinho/carrinho-abc.css>; rel=preload; as=fetch; crossorigin=anonymous')
    expect(await handler.hints(new Request('https://edge.exemplo.com/_vitral/carrinho/x.js'))).toEqual([])

    const first = setup({ preload: (url) => (url.pathname === '/' ? ['carrinho', 'nenhum'] : []) })
    expect(await first.handler.hints(new Request('https://edge.exemplo.com/'))).toHaveLength(3)
  })

  it('modulepreload para JS sem hash, preload as=style fora do Shadow DOM', async () => {
    const m = { name: 'carrinho', entry: 'c.js', css: ['c.css'] }
    const { handler } = setup({ preload: () => ['carrinho'] }, { [`${CDN}vitral.json`]: JSON.stringify(m) })
    expect(await handler.hints(new Request('https://edge.exemplo.com/'))).toEqual([
      '</_vitral/carrinho/c.js>; rel=modulepreload',
      '</_vitral/carrinho/c.css>; rel=preload; as=style; crossorigin=anonymous',
    ])
  })

  it('canal e remote só com JS: sem hints de manifesto', async () => {
    const { handler } = setup(
      { remotes: { carrinho: `${CDN}vitral.json`, js: 'https://cdn.exemplo.com/js/remote.js' }, preload: () => ['carrinho', 'js'] },
      { [`${CDN}vitral.json`]: JSON.stringify({ stable: '1.0.0' }) },
    )
    expect(await handler.hints(new Request('https://edge.exemplo.com/'))).toEqual(['</_vitral/js/remote.js>; rel=modulepreload'])
  })

  it('outras respostas passam sem reescrita', async () => {
    const { get } = setup({}, { 'https://app.exemplo.com/a.css': new Response('<vitral-remote name="carrinho">', { headers: { 'content-type': 'text/css' } }) })
    expect(await (await get('/a.css')).text()).toBe('<vitral-remote name="carrinho">')
  })
})

describe('gateway: SSR', () => {
  const render = vi.fn((props: Record<string, unknown>) => `<button>itens: ${props.n}</button>`)

  it('Shadow DOM declarativo com o HTML e o CSS do remote; fallback escondido', async () => {
    const { get } = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render } } })
    const html = await (await get('/')).text()
    expect(render).toHaveBeenCalledWith({ n: 2 })
    expect(html).toContain(
      '<vitral-remote name="carrinho" props=\'{"n":2}\' isolate="shadow"><div data-vitral-ssr data-vitral-slot="carrinho"><template shadowrootmode="open"><style data-vitral-ssr>.c{color:red;background:url(/_vitral/carrinho/img/x.png)}</style><div data-vitral-root="carrinho" data-vitral-scope="carrinho" style="display:contents"><button>itens: 2</button></div></template></div><p slot="fallback" hidden="">Carregando</p><p slot="error">Erro</p></vitral-remote>',
    )
    // Comentário e script ficam como estavam.
    expect(html).toContain('<!-- <vitral-remote name="carrinho"></vitral-remote> -->')
    expect(html).toContain(`<script>const t = '<vitral-remote name="carrinho">'</script>`)
  })

  it('CSS preparado no build, @font-face fora do shadow root', async () => {
    const m = { ...MANIFEST, files: {}, shadow: { css: ['pronto.css'], global: ['global.css'] } }
    const { get } = setup(
      { remotes: { carrinho: { url: `${CDN}vitral.json`, render } } },
      { [`${CDN}vitral.json`]: JSON.stringify(m), [`${CDN}pronto.css`]: '.p{background:url(a.png)}</style>' },
    )
    const html = await (await get('/')).text()
    expect(html).toContain('<link rel="stylesheet" href="/_vitral/carrinho/global.css" crossorigin="anonymous"><template shadowrootmode="open"><style data-vitral-ssr>.p{background:url(a.png)}<\\/style></style>')
  })

  it('sem isolate: links com integrity e a raiz com escopo', async () => {
    const page = `<vitral-remote src="${CDN}vitral.json" props="{&quot;n&quot;:3}"></vitral-remote>`
    const { get } = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render } } }, { 'https://app.exemplo.com/': page })
    const html = await (await get('/')).text()
    expect(html).toBe(
      `<vitral-remote src="/_vitral/carrinho/vitral.json" props="{&quot;n&quot;:3}"><div data-vitral-ssr data-vitral-slot="carrinho"><link rel="stylesheet" href="/_vitral/carrinho/carrinho-abc.css" crossorigin="anonymous" integrity="${sri(CSS)}"><div data-vitral-root="carrinho" data-vitral-scope="carrinho" style="display:contents"><button>itens: 3</button></div></div></vitral-remote>`,
    )
  })

  it('CSS com hash errado, render que lança e iframe: página sem SSR, erro no onError', async () => {
    const onError = vi.fn()
    const bad = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render } }, onError }, { [`${CDN}carrinho-abc.css`]: '.trocado{}' })
    const html = await (await bad.get('/')).text()
    expect(html).not.toContain('data-vitral-ssr')
    expect(html).toContain('<p slot="fallback">Carregando</p>')
    expect(String(onError.mock.calls[0][0])).toContain('integrity')

    const throws = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render: () => Promise.reject(new Error('quebrou')) } }, onError })
    expect(await (await throws.get('/')).text()).not.toContain('data-vitral-ssr')
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), 'carrinho')

    const page = '<vitral-remote name="carrinho" isolate="iframe"></vitral-remote>'
    const frame = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render } } }, { 'https://app.exemplo.com/': page })
    expect(await (await frame.get('/')).text()).toBe(page)
  })

  it('padrão do onError: console.error no servidor', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { get } = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render: () => { throw new Error('x') } } } })
    await (await get('/')).text()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('manifesto e CSS ficam em cache por ttl', async () => {
    const { get, fetch } = setup({ remotes: { carrinho: { url: `${CDN}vitral.json`, render } } })
    await (await get('/')).text()
    await (await get('/')).text()
    const cdn = fetch.mock.calls.filter(([r]) => r.url.startsWith(CDN))
    expect(cdn).toHaveLength(2)
  })
})

describe('rewriter próprio', () => {
  const run = async (html: string, size = 1) => {
    const bytes = new TextEncoder().encode(html)
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size))
        c.close()
      },
    })
    const seen: string[] = []
    const out = rewrite(body, 'x-r', {
      async element(el) {
        await new Promise((r) => setTimeout(r, 0))
        seen.push(el.getAttribute('a') ?? '-')
        el.setAttribute('b', 'novo "valor"')
        el.prepend('<i>1</i>', { html: true })
        el.prepend('<texto>')
      },
      child(el) {
        if (el.hasAttribute('slot')) el.setAttribute('hidden', '')
      },
    })
    return [await new Response(out).text(), seen] as const
  }

  it('acha a tag e os filhos diretos, mesmo com o HTML partido em pedaços de 1 byte', async () => {
    const html = `<p>a <b> c</p><x-r a='1>2' c><div slot=fallback><span slot="x">s</span></div><img slot="i"><br/><p slot=p>t</p></x-r><x-r a=sem></x-r><x-r/>fim <`
    for (const size of [1, 3, 1000]) {
      const [out, seen] = await run(html, size)
      expect(seen).toEqual(['1>2', 'sem', '-'])
      expect(out).toBe(
        `<p>a <b> c</p><x-r a="1>2" c b="novo &quot;valor&quot;">&lt;texto&gt;<i>1</i><div slot="fallback" hidden=""><span slot="x">s</span></div><img slot="i" hidden=""><br/><p slot="p" hidden="">t</p></x-r><x-r a="sem" b="novo &quot;valor&quot;">&lt;texto&gt;<i>1</i></x-r><x-r b="novo &quot;valor&quot;" />&lt;texto&gt;<i>1</i>fim <`,
      )
    }
  })

  it('ignora comentários e texto de script/style, até no fim do arquivo', async () => {
    const html = '<style>x-r{}</style><script>"<x-r>"; a<b</script><textarea><x-r></textarea><!-- <x-r> --><!-- aberto <x-r>'
    const [out, seen] = await run(html, 2)
    expect(seen).toEqual([])
    expect(out).toBe(html)
  })

  it('tag sem fim e script sem fechamento saem como vieram', async () => {
    expect((await run('<script>a <x-r a=1>', 4))[0]).toBe('<script>a <x-r a=1>')
    expect((await run('texto <x-r a="1', 4))[0]).toBe('texto <x-r a="1')
  })

  it('decodifica entidades dos atributos', () => {
    expect(decodeEntities('{&quot;a&quot;:&#49;,&#x62;:&apos;&lt;&gt;&amp;&#39;}')).toBe(`{"a":1,b:'<>&'}`)
  })
})

describe('toNodeListener', () => {
  const fakeRes = () => {
    const res = {
      status: 0,
      headers: {} as Record<string, string | string[]>,
      chunks: [] as string[],
      hints: [] as unknown[],
      headersSent: false,
      writeHead(status: number, headers: Record<string, string | string[]>) {
        res.status = status
        res.headers = headers
        res.headersSent = true
      },
      write(c: Uint8Array) {
        res.chunks.push(new TextDecoder().decode(c))
      },
      end(c?: string) {
        if (c) res.chunks.push(c)
      },
      writeEarlyHints(h: unknown) {
        res.hints.push(h)
      },
    }
    return res
  }
  const fakeReq = (method: string, url: string, body = '') => ({
    method,
    url,
    headers: { host: 'edge.exemplo.com', 'x-a': ['1', '2'], ':authority': 'x' } as Record<string, string | string[] | undefined>,
    async *[Symbol.asyncIterator]() {
      if (body) yield new TextEncoder().encode(body)
    },
  })

  it('converte a requisição e a resposta, com 103 Early Hints antes', async () => {
    const { handler } = setup({ preload: () => ['carrinho'] })
    const res = fakeRes()
    await toNodeListener(handler)(fakeReq('GET', '/'), res)
    expect(res.hints).toEqual([{ link: expect.arrayContaining(['</_vitral/carrinho/split/entry.js>; rel=preload; as=fetch; crossorigin=anonymous']) }])
    expect(res.status).toBe(200)
    expect(res.chunks.join('')).toContain('<vitral-remote name="carrinho"')
  })

  it('corpo de POST, cookies e handler comum', async () => {
    let got = ''
    const res = fakeRes()
    await toNodeListener(async (req) => {
      got = `${req.method} ${req.url} ${req.headers.get('x-a')} ${await req.text()}`
      const headers = new Headers({ 'content-type': 'text/plain' })
      headers.append('set-cookie', 'a=1')
      headers.append('set-cookie', 'b=2')
      return new Response('ok', { status: 201, headers })
    })(fakeReq('POST', '/x', 'corpo'), res)
    expect(got).toBe('POST http://edge.exemplo.com/x 1, 2 corpo')
    expect(res.status).toBe(201)
    expect(res.headers['set-cookie']).toEqual(['a=1', 'b=2'])
    expect(res.chunks).toEqual(['ok'])
  })

  it('502 quando o handler falha', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    await toNodeListener(async () => {
      throw new Error('fora')
    })(fakeReq('GET', '/'), res)
    expect(res.status).toBe(502)
    spy.mockRestore()
  })
})
