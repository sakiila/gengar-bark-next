import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from '../styles/Home.module.css';
import { useEffect, useRef, useState } from 'react';

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
      <img
        src={imageUrl}
        alt={title}
        className={styles.featureImg}
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

  const phrases = [
    "Transform Your Team Communication",
    "Enhance Your Workspace Productivity",
    "Streamline Team Collaboration Instantly",
    "Automate Your Daily Communications",
    "Power Up Your Team's Workflow",
  ];

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
            // Deleting
            if (prev.length > 0) {
              return prev.slice(0, -1);
            }
            // Move to next phrase
            setIsDeleting(false);
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
            return '';
          }
        });
      }, speed);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIndex, isPaused]);

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

const HomePage: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const demoRef = useRef<HTMLDivElement>(null);

  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.logo}>Gengar Bark</div>
        <a
          href="https://slack.com/app_redirect?app=A06697P9VTN&team=T011CF3CMJN"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaButton}
        >
          Chat on Slack
        </a>
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

export default HomePage;
