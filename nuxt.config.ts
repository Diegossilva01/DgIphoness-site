export default defineNuxtConfig({
  ssr: false,
  nitro: {
    experimental: {
      websocket: true
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Ludo Friends',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#11131a' }
      ]
    }
  }
})
