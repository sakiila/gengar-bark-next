import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from '../styles/Home.module.css';
import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import type { NextPage } from 'next'
import Image from 'next/image';

const FeatureCard: React.FC<{
  title: string;
  description: string;
  imageUrl: string;
}> = ({ title, description, imageUrl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8 }}
    className={styles.featureCard}
  >
    <div className={styles.featureImage}>
      <Image
        src={imageUrl}
        alt={title}
        className={styles.featureImg}
        width={500}
        height={300}
      />
    </div>
    <div className={styles.featureContent}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </motion.div>
);

const FloatingParticles: React.FC = () => {
  return (
    <div className={styles.particlesContainer}>
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className={styles.particle}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

const TypingText: React.FC = () => {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const phrases = useMemo(() => [
    "Transform Your Team Communication",
    "Enhance Your Workspace Productivity",
    "Streamline Team Collaboration Instantly",
    "Automate Your Daily Communications",
    "Power Up Your Team's Workflow",
  ], []);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    let timer: NodeJS.Timeout;

    if (isPaused) {
      // Wait for 2 seconds when phrase is complete
      timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000);
    } else {
      const speed = isDeleting ? 50 : 100;
      timer = setTimeout(() => {
        setDisplayText(prev => {
          if (!isDeleting) {
            // Typing
            if (prev.length < currentPhrase.length) {
              return currentPhrase.slice(0, prev.length + 1);
            }
            // Complete phrase reached, start pause
            setIsPaused(true);
            return prev;
          } else {
            if (prev.length > 0) {
              return prev.slice(0, -1);
            }
            setIsDeleting(false);
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
            return '';
          }
        });
      }, speed);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIndex, isPaused, phrases]);

  return (
    <span className={styles.typingText}>
      {displayText}
    </span>
  );
};

const Divider: React.FC = () => (
  <div className={styles.divider}>
    <motion.div
      className={styles.dividerLine}
      initial={{ width: "0%" }}
      whileInView={{ width: "100%" }}
      viewport={{ once: true }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    />
    <div className={styles.dividerDot} />
    <div className={styles.dividerRing} />
  </div>
);

const Home: NextPage = () => {
  const { scrollYProgress } = useScroll();
  const demoRef = useRef<HTMLDivElement>(null);

  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gengar.baobo.me';

  return (
    <div className={styles.container}>
      <Head>
        <title>Gengar Bark | AI-Powered Slack Assistant for Smart Team Communication</title>
        <meta name="description" content="Enhance team productivity with AI-powered chat, automatic summaries, and smart scheduling - all within Slack." />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:title" content="Gengar Bark | Smart Team Communication" />
        <meta property="og:description" content="Transform your Slack workspace with AI-powered chat assistance, automatic meeting summaries, and intelligent scheduling." />
        <meta property="og:image" content="/images/preview2.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Gengar Bark | Smart Team Communication" />
        <meta name="twitter:description" content="Transform your Slack workspace with AI-powered chat assistance, automatic meeting summaries, and intelligent scheduling." />
        <meta name="twitter:image" content="/images/preview2.png" />
      </Head>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>Gengar Bark</Link>
        <div className={styles.navLinks}>
          <Link href="/guide" className={styles.guideLink}>
            User Guide
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

      <FloatingParticles />

      <main>
        <section className={styles.hero}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.typingContainer}>
              <h1>
                <TypingText />
              </h1>
            </div>
            <p>
              Enhance productivity and collaboration with our intelligent Slack
              assistant that understands your team&apos;s context and needs.
            </p>
            <a
              href="https://slack.com/app_redirect?app=A06697P9VTN&team=T011CF3CMJN"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.primaryButton}
            >
              Get Started Free
            </a>
          </motion.div>
        </section>

        <section className={styles.videoSection}>
          <div className={styles.sectionIntro}>
            <div className={styles.separator}>
              <span className={styles.separatorLine}></span>
              <span className={styles.separatorText}>Watch Demo</span>
              <span className={styles.separatorLine}></span>
            </div>
            <h2>See Gengar Bark in Action</h2>
            <p>Watch how our AI assistant transforms team communication and boosts productivity in Slack.</p>
          </div>
          <div className={styles.videoWrapper}>
            <video
              className={styles.video}
              controls
              playsInline
              preload="auto"
              poster="/images/cover.png"
            >
              <source src="https://gengar.baobo.me/gengar_bark_ai.mov" type='video/mp4; codecs="avc1.42E01E, mp4a.40.2"' />
              <source src="https://gengar.baobo.me/gengar_bark_ai.mov" type="video/quicktime" />
              <source src="https://gengar.baobo.me/gengar_bark_ai.webm" type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </div>
        </section>

        <Divider />

        <section className={styles.features}>
          <h2>Core Features</h2>
          <div className={styles.featureGrid}>
            <FeatureCard
              title="AI Chat Assistant"
              description="Experience smart conversations with context-aware responses that understand your team's needs and communication style. Our AI assistant learns from interactions to provide increasingly personalized and relevant support."
              imageUrl="/images/ai-chat.png"
            />
            <FeatureCard
              title="Conversation Summarizer"
              description="Never miss important details with automatic meeting notes and discussion highlights generated in real-time. Our advanced AI processes conversations to extract key points, action items, and decisions."
              imageUrl="/images/summarizer.png"
            />
            <FeatureCard
              title="Interactive Scheduling"
              description="Schedule meetings effortlessly through natural dialogue with our AI assistant that handles all the coordination. Simply chat about your availability and let the AI manage the complexities of calendar management."
              imageUrl="/images/scheduling.png"
            />
          </div>
        </section>

        <section className={styles.cta}>
          <h2>Ready to Transform Your Workspace?</h2>
          <p>
            Join thousands of teams already using Gengar Bark to boost their
            productivity.
          </p>
          <a
            href="https://slack.com/app_redirect?app=A06697P9VTN&team=T011CF3CMJN"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primaryButton}
          >
            Chat on Slack
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2024 Gengar Bark. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
