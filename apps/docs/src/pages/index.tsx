import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
  icon: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'AI-Powered Agents',
    icon: '🤖',
    description: (
      <>
        Create intelligent agents that use LLMs to make decisions. Agents read sensor states, 
        evaluate rules, and execute actions automatically.
      </>
    ),
  },
  {
    title: 'Device Integration',
    icon: '📡',
    description: (
      <>
        Native support for ESP32/ESPHome devices with MQTT autodiscovery. Connect Android phones, 
        Raspberry Pi, and any computer as network agents.
      </>
    ),
  },
  {
    title: 'Visual Boards',
    icon: '🎨',
    description: (
      <>
        Design control logic visually with boards and cards. Value cards display sensor data, 
        action cards execute commands.
      </>
    ),
  },
  {
    title: 'Auto-Generated APIs',
    icon: '⚡',
    description: (
      <>
        Define data objects and get full CRUD APIs automatically. Real-time updates via MQTT 
        with DataView components.
      </>
    ),
  },
  {
    title: 'Event System',
    icon: '📨',
    description: (
      <>
        Decoupled communication between components. Subscribe to events in frontend or backend 
        without knowing the emitter.
      </>
    ),
  },
  {
    title: 'MCP Integration',
    icon: '🔌',
    description: (
      <>
        Expose boards to AI assistants via Model Context Protocol. Use Vento from Claude Desktop, 
        Cursor, or any MCP client.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <div style={{fontSize: '3rem', marginBottom: '1rem'}}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p style={{fontSize: '1.2rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2rem'}}>
          Build intelligent agents that sense, decide, and act on the real world.
          Connect LLMs to sensors and actuators for AI-powered automation.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="docs/intro">
            Get Started →
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Documentation"
      description="Vento - The AI control and automation platform for devices, machines and spaces">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {FeatureList.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
