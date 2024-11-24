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
          <meta name="title" content="Gengar Bark - AI-Powered Slack Assistant" />
          <meta name="description" content="Transform your team communication with AI. Smart conversations, automatic summaries, and seamless scheduling in Slack." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://pearl.baobo.me" />
          <meta property="og:title" content="Gengar Bark - AI-Powered Team Communication" />
          <meta property="og:description" content="Experience smart conversations with context-aware responses, automatic meeting summaries, and effortless scheduling - all within Slack." />
          <meta property="og:image" content="https://pearl.baobo.me/images/preview.png" />
          <meta property="og:site_name" content="Gengar Bark" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content="https://pearl.baobo.me" />
          <meta name="twitter:title" content="Gengar Bark - AI-Powered Team Communication" />
          <meta name="twitter:description" content="Experience smart conversations with context-aware responses, automatic meeting summaries, and effortless scheduling - all within Slack." />
          <meta name="twitter:image" content="https://pearl.baobo.me/images/preview.png" />
          <meta name="twitter:label1" content="Available On" />
          <meta name="twitter:data1" content="Slack" />
          <meta name="twitter:label2" content="Type" />
          <meta name="twitter:data2" content="AI Assistant" />
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
