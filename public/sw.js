const CACHE_PREFIX = 'granazen-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const scopeUrl = new URL('./', self.registration.scope)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch(scopeUrl, { cache: 'reload' })
    if (!response.ok) throw new Error(`Não foi possível armazenar a tela inicial (${response.status}).`)
    const html = await response.clone().text()
    await cache.put(scopeUrl, response)
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
      .map((match) => new URL(match[1], scopeUrl).href)
    await Promise.all(assets.map(async (assetUrl) => {
      const asset = await fetch(assetUrl, { cache: 'reload' })
      if (asset.ok) await cache.put(assetUrl, asset)
    }))
    await cache.addAll([
      new URL('manifest.webmanifest', scopeUrl),
      new URL('granazen.svg', scopeUrl),
    ])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin || !requestUrl.href.startsWith(scopeUrl.href)) return

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      try {
        const response = await fetch(event.request)
        if (response.ok) await cache.put(scopeUrl, response.clone())
        return response
      } catch {
        const cached = await cache.match(scopeUrl)
        if (cached) return cached
        throw new Error('O GranaZen não tem uma tela inicial salva para uso offline.')
      }
    })())
    return
  }

  if (requestUrl.pathname.includes('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(event.request)
      const network = fetch(event.request).then((response) => {
        if (response.ok) void cache.put(event.request, response.clone())
        return response
      })
      return cached ?? network
    })())
  }
})
