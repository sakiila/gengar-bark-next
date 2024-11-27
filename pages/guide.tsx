import React from 'react';
import { motion } from 'framer-motion';
import styles from '../styles/Home.module.css';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

const GuideSection: React.FC<{
  title: string;
  content: React.ReactNode;
  imageUrl: string;
}> = ({ title, content, imageUrl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className={styles.guideSection}
  >
    <div className={styles.guideSectionImage}>
      <Zoom>
        <Image
          src={imageUrl}
          alt={title}
          width={1200}
          height={900}
          style={{ objectFit: 'cover' }}
        />
      </Zoom>
    </div>
    <div className={styles.guideSectionText}>
      <h3>{title}</h3>
      <div className={styles.guideDescription}>{content}</div>
    </div>
  </motion.div>
);

const GuidePage: React.FC = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>User Guide | Gengar Bark</title>
        <meta name="title" content="User Guide - Gengar Bark" />
        <meta property="og:title" content="User Guide | Gengar Bark" />
        <meta name="twitter:title" content="User Guide | Gengar Bark" />
      </Head>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          Gengar Bark
        </Link>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.guideLink}>
            Home
          </Link>
          <a
            href="https://slack.com/app_redirect?app=A06697P9VTN&team=T011CF3CMJN"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaButton}
          >
            Chat on Slack
          </a>
        </div>
      </nav>

      <main className={styles.main}>
        <section className={styles.hero}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className={styles.title}>User Guide</h1>
            <p className={styles.description}>
              Learn how to use Gengar Bark effectively
            </p>
          </motion.div>
        </section>

        <section className={styles.guideContent}>
          <GuideSection
            title="Intelligent Q&A"
            content={
              <p>
                In DM chat view or side-by-side view, you can interact with the
                AI using natural language, powered by the OpenAI ChatGPT 4.0
                model.
              </p>
            }
            imageUrl="/images/guide/shot1.png"
          />

          <GuideSection
            title="Message Summarization"
            content={
              <p>
                In public channels, use @Gengar Bark to translate, summarize, or
                analyze content within the context of the current thread.
              </p>
            }
            imageUrl="/images/guide/shot2.png"
          />

          <GuideSection
            title="MoeGo Assistant"
            content={
              <p>
                Through natural language commands, you can create appointments
                in the testing environment (
                <a
                  href="https://go.t2.moego.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  https://go.t2.moego.dev
                </a>
                ).
                <br />
                For example,{" "}
                <code>
                  Create three appointments for today using MoeGo account
                  bob@moego.pet
                </code>
                <br />
               and{" "}
                <code>
                  Create an appointment for Customer Peter at 9 AM tomorrow
                </code>
              </p>
            }
            imageUrl="/images/guide/shot3.png"
          />
        </section>
      </main>

      <footer className={styles.footer}>
        <p> 2024 Gengar Bark. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default GuidePage;
