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
          <meta property="og:title" content="Gengar Bark - AI-Powered Slack Assistant" />
          <meta property="og:description" content="Transform your team communication with AI. Smart conversations, automatic summaries, and seamless scheduling in Slack." />
          <meta property="og:image" content="https://pearl.baobo.me/images/scheduling.png" />
          <meta property="og:url" content="https://pearl.baobo.me" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Gengar Bark - AI-Powered Slack Assistant" />
          <meta name="twitter:description" content="Transform your team communication with AI. Smart conversations, automatic summaries, and seamless scheduling in Slack." />
          <meta name="twitter:image" content="https://pearl.baobo.me/images/scheduling.png" />
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
