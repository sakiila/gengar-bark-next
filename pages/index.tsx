import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from '../styles/Home.module.css';
import { useEffect, useRef, useState } from 'react';

const FeatureCard: React.FC<{ title: string; description: string; icon: string }> = ({
  title,
  description,
  icon,
}) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className={styles.featureCard}
  >
    <div className={styles.iconWrapper}>
      <span className={styles.icon}>{icon}</span>
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
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

const TypingText: React.FC<{ text: string }> = ({ text }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [text]);

  return <span className={styles.typingText}>{displayText}</span>;
};

const HomePage: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const demoRef = useRef<HTMLDivElement>(null);

  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.logo}>Gengar Bark</div>
        <a
          href="https://app.slack.com/client/T011CF3CMJN/D0668HZ40BG"
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
            <h1>
              <TypingText text="Transform Your Team Communication with AI" />
            </h1>
            <p>
              Enhance productivity and collaboration with our intelligent Slack
              assistant that understands your team&apos;s context and needs.
            </p>
            <a
              href="https://app.slack.com/client/T011CF3CMJN/D0668HZ40BG"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.primaryButton}
            >
              Get Started Free
            </a>
          </motion.div>
        </section>

        <section className={styles.features}>
          <h2>Core Features</h2>
          <div className={styles.featureGrid}>
            <FeatureCard
              title="AI Chat Assistant"
              description="Experience smart conversations with context-aware responses that understand your team's needs and communication style."
              icon="🤖"
            />
            <FeatureCard
              title="Conversation Summarizer"
              description="Never miss important details with automatic meeting notes and discussion highlights generated in real-time."
              icon="📝"
            />
            <FeatureCard
              title="Interactive Scheduling"
              description="Schedule meetings effortlessly through natural dialogue with our AI assistant that handles all the coordination."
              icon="📅"
            />
          </div>
        </section>

        <section className={styles.demo} ref={demoRef}>
          <h2>See It in Action</h2>
          <div className={styles.demoContainer}>
            <div className={styles.demoChat}>
              <div className={styles.terminalHeader}>
                <div
                  className={styles.terminalDot}
                  style={{ background: "#a53932" }}
                />
                <div
                  className={styles.terminalDot}
                  style={{ background: "#544562" }}
                />
                <div
                  className={styles.terminalDot}
                  style={{ background: "#b4725f" }}
                />
              </div>
              <motion.div
                className={styles.terminalContent}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className={styles.commandLine}>
                  <span className={styles.prompt}>$</span>
                  <TypingText text=" AI assistant initialized..." />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <h2>Ready to Transform Your Workspace?</h2>
          <p>
            Join thousands of teams already using Gengar Bark to boost their
            productivity.
          </p>
          <a
            href="https://app.slack.com/client/T011CF3CMJN/D0668HZ40BG"
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
