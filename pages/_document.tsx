import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />

          {/* Primary Meta Tags */}
          <meta name="title" content="Gengar Bark - Your AI-Powered Slack Assistant" />
          <meta name="description" content="Enhance team productivity with AI-powered chat, automatic summaries, and smart scheduling - all within Slack." />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://pearl.baobo.me/" />
          <meta property="og:title" content="Gengar Bark | Smart Team Communication" />
          <meta property="og:description" content="Transform your Slack workspace with AI-powered chat assistance, automatic meeting summaries, and intelligent scheduling." />
          <meta property="og:image" content="https://pearl.baobo.me/images/preview2.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="Gengar Bark" />

          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content="https://pearl.baobo.me/" />
          <meta name="twitter:title" content="Gengar Bark | Smart Team Communication" />
          <meta name="twitter:description" content="Transform your Slack workspace with AI-powered chat assistance, automatic meeting summaries, and intelligent scheduling." />
          <meta name="twitter:image" content="https://pearl.baobo.me/images/preview2.png" />

          {/* Additional Meta Data */}
          <meta name="application-name" content="Gengar Bark" />
          <meta name="apple-mobile-web-app-title" content="Gengar Bark" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="theme-color" content="#524262" />

          <style>{`
            html, body {
              margin: 0;
              padding: 0;
              overflow-x: hidden;
              width: 100%;
            }
          `}</style>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
