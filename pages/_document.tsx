import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    return (
      <Html lang="zh-CN">
        <Head>
          {/* Character Set */}
          <meta charSet="utf-8" />

          {/* SEO Meta Tags */}
          <meta name="robots" content="index, follow" />
          <meta name="keywords" content="AI, Slack, Team Communication, Analytics, Performance Report, Team Insights" />
          <meta name="author" content="Gengar Bark" />

          {/* Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />

          {/* Favicons */}
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />

          {/* Primary Meta Tags */}
          <meta name="description" content="Get detailed insights into your Slack workspace activity with AI-powered analytics and performance reports." />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://pearl.baobo.me/" />
          <meta property="og:description" content="Discover your Slack workspace performance with comprehensive analytics and AI-generated insights." />
          <meta property="og:image" content="https://pearl.baobo.me/images/preview2.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="Gengar Bark Analytics" />

          {/* Enhanced Twitter Card Meta Tags */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@GengarbarkAI" />
          <meta name="twitter:creator" content="@GengarbarkAI" />
          <meta name="twitter:url" content="https://pearl.baobo.me/" />
          <meta name="twitter:description" content="Discover your Slack workspace performance with comprehensive analytics and AI-generated insights." />
          <meta name="twitter:image" content="https://pearl.baobo.me/images/preview2.png" />
          <meta name="twitter:label1" content="Platform" />
          <meta name="twitter:data1" content="Slack Analytics" />
          <meta name="twitter:label2" content="Type" />
          <meta name="twitter:data2" content="Performance Report" />

          {/* Additional Meta Data */}
          <meta name="application-name" content="Gengar Bark Analytics" />
          <meta name="apple-mobile-web-app-title" content="Gengar Bark Analytics" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="theme-color" content="#524262" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />

          {/* Google Fonts - Noto Sans SC */}
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
          
          {/* 霞鹜文楷 */}
          <link
            href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.1.0/style.css"
            rel="stylesheet"
          />
          
          {/* 马善政楷体 */}
          <link
            href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap"
            rel="stylesheet"
          />

          {/* 得意黑 - 更现代的中文字体 */}
          <link
            href="https://cdn.jsdelivr.net/npm/smiley-sans@1.1.0/css/smiley-sans.css"
            rel="stylesheet"
          />

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
