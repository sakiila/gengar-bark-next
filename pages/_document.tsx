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
          <meta property="og:title" content="Gengar Bark - AI-Powered Slack Assistant" />
          <meta property="og:description" content="Transform your team communication with AI. Smart conversations, automatic summaries, and seamless scheduling in Slack." />
          <meta property="og:image" content="https://pearl.baobo.me/images/avatar.png" />
          <meta property="og:url" content="https://pearl.baobo.me" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Gengar Bark - AI-Powered Slack Assistant" />
          <meta name="twitter:description" content="Transform your team communication with AI. Smart conversations, automatic summaries, and seamless scheduling in Slack." />
          <meta name="twitter:image" content="https://pearl.baobo.me/images/avatar.png" />
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
