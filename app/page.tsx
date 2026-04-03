import Image from 'next/image';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';

const registerHref = '/asset-register';

const routeCards = [
  {
    href: '/valuation',
    image: '/brand/Valuations.png',
    eyebrow: 'Green section',
    title: 'Valuation',
    text: 'Get a guided machinery value with a cleaner, faster flow.',
    action: 'Start valuation',
    tone: 'green',
  },
  {
    href: registerHref,
    image: '/brand/Register.png',
    eyebrow: 'Ochre section',
    title: 'Asset Register',
    text: 'Keep values, notes, manual assets, and property in one working view.',
    action: 'Open register',
    tone: 'gold',
  },
  {
    href: '/marketplace',
    image: '/brand/Buy & Sell.png',
    eyebrow: 'Blue section',
    title: 'Marketplace',
    text: 'Browse machinery first, then unlock seller contact details after sign-in.',
    action: 'Open marketplace',
    tone: 'blue',
  },
] as const;

const workflow = [
  {
    step: '01',
    title: 'Value machinery',
    text: 'Start with a guided valuation and get to a result quickly.',
  },
  {
    step: '02',
    title: 'Save good records',
    text: 'Store the machine in the register so it is ready for refresh and review.',
  },
  {
    step: '03',
    title: 'Move to market',
    text: 'Push the right machine to marketplace when you are ready to sell.',
  },
] as const;

const highlights = [
  'Free valuation start',
  'Asset register storage',
  'Marketplace browsing before sign-in',
] as const;

const previewPanels = [
  {
    href: '/valuation',
    title: 'Built to start fast',
    text: 'A guided valuation flow with stronger sectioning, clearer choices, and better result hierarchy.',
    list: ['Step-based journey', 'Cleaner result cards', 'Confidence-led summary'],
    image: '/brand/Valuations.png',
    tone: 'green',
  },
  {
    href: registerHref,
    title: 'Built to manage clearly',
    text: 'The asset register is structured as a working dashboard rather than a cluttered table.',
    list: ['Portfolio summary', 'Clearer asset grouping', 'Marketplace handoff'],
    image: '/brand/Register.png',
    tone: 'gold',
  },
  {
    href: '/marketplace',
    title: 'Built to browse confidently',
    text: 'Filters help without getting in the way, and users can still scroll listings before creating an account.',
    list: ['Cleaner filters', 'Better listing cards', 'Locked contact details only'],
    image: '/brand/Buy & Sell.png',
    tone: 'blue',
  },
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>Agricultural &amp; industrial machinery pricing</p>
              <h1 className={styles.heroTitle}>Know what your machinery is worth. Then act on it.</h1>
              <p className={styles.heroText}>
                Aim4price gives you a cleaner route into valuation, record keeping, and marketplace
                decisions without overwhelming the user.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryCta}>
                  Start Free Valuation
                </Link>
                <Link href={registerHref} className={styles.secondaryCta}>
                  Open Asset Register
                </Link>
              </div>

              <div className={styles.highlightRow} aria-label="Platform highlights">
                {highlights.map((item) => (
                  <span key={item} className={styles.highlightPill}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.heroVisualWrap}>
              <div className={styles.heroVisualPanel}>
                <div className={styles.heroVisualTop}>
                  <div>
                    <p className={styles.visualEyebrow}>Platform view</p>
                    <h2 className={styles.visualTitle}>Three clear routes.</h2>
                  </div>
                  <span className={styles.visualChip}>Cleaner product identity</span>
                </div>

                <Link href="/valuation" className={styles.heroPreview} aria-label="Open valuation">
                  <div className={styles.heroPreviewMedia}>
                    <Image
                      src="/brand/Home-page.png"
                      alt="Aim4price platform preview"
                      fill
                      priority
                      sizes="(max-width: 980px) 100vw, 42vw"
                      className={styles.heroPreviewImage}
                    />
                  </div>
                  <div className={styles.heroPreviewBar}>
                    <span>Open valuation</span>
                    <span className={styles.arrow}>→</span>
                  </div>
                </Link>

                <div className={styles.quickGrid}>
                  {routeCards.map((card) => (
                    <Link
                      key={card.title}
                      href={card.href}
                      className={`${styles.quickCard} ${styles[`tone_${card.tone}`]}`}
                    >
                      <div className={styles.quickCardTop}>
                        <span className={styles.quickEyebrow}>{card.eyebrow}</span>
                        <Image src={card.image} alt={card.title} width={44} height={44} className={styles.quickIcon} />
                      </div>
                      <h3 className={styles.quickTitle}>{card.title}</h3>
                      <p className={styles.quickText}>{card.text}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.routeSection}>
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Start where it makes sense</p>
            <h2 className={styles.sectionTitle}>A clearer front door into the product.</h2>
            <p className={styles.sectionText}>
              Each route now has a stronger visual identity so the product feels easier to scan and easier to trust.
            </p>
          </div>

          <div className={styles.routeGrid}>
            {routeCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`${styles.routeCard} ${styles[`tone_${card.tone}`]}`}
              >
                <div className={styles.routeTop}>
                  <span className={styles.routeBadge}>{card.eyebrow}</span>
                  <Image src={card.image} alt={card.title} width={68} height={68} className={styles.routeImage} />
                </div>
                <h3 className={styles.routeTitle}>{card.title}</h3>
                <p className={styles.routeText}>{card.text}</p>
                <span className={styles.routeAction}>{card.action}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.workflowPanel}>
            <div className={styles.workflowIntro}>
              <p className={styles.workflowEyebrow}>How it works</p>
              <h2 className={styles.workflowTitle}>Simple, visible, and easy to follow.</h2>
              <p className={styles.workflowText}>
                The product should feel direct on desktop and mobile. This flow keeps the main actions obvious.
              </p>
            </div>

            <div className={styles.workflowGrid}>
              {workflow.map((item) => (
                <div key={item.step} className={styles.workflowCard}>
                  <span className={styles.workflowStep}>{item.step}</span>
                  <h3 className={styles.workflowCardTitle}>{item.title}</h3>
                  <p className={styles.workflowCardText}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.previewSection}>
        <div className={styles.shell}>
          <div className={styles.sectionIntroLeft}>
            <p className={styles.sectionEyebrow}>Inside the product</p>
            <h2 className={styles.sectionTitle}>Polish where users actually feel it.</h2>
            <p className={styles.sectionTextLeft}>
              Better hierarchy, stronger sections, and simpler browsing matter more than extra words.
            </p>
          </div>

          <div className={styles.previewStack}>
            {previewPanels.map((panel) => (
              <Link
                key={panel.title}
                href={panel.href}
                className={`${styles.previewCard} ${styles[`tone_${panel.tone}`]}`}
              >
                <div className={styles.previewCopy}>
                  <span className={styles.previewBadge}>{panel.title}</span>
                  <p className={styles.previewText}>{panel.text}</p>
                  <ul className={styles.previewList}>
                    {panel.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <span className={styles.previewAction}>Open section</span>
                </div>

                <div className={styles.previewMedia}>
                  <div className={styles.previewImageFrame}>
                    <Image src={panel.image} alt={panel.title} fill sizes="(max-width: 980px) 100vw, 22vw" className={styles.previewImage} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shellNarrow}>
          <div className={styles.ctaPanel}>
            <p className={styles.ctaEyebrow}>Get started</p>
            <h2 className={styles.ctaTitle}>Start with valuation. Build from there.</h2>
            <p className={styles.ctaText}>
              Begin with a free valuation, save the machinery to your register, and move the right unit to marketplace when ready.
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/valuation" className={styles.ctaPrimary}>
                Start Free Valuation
              </Link>
              <Link href="/marketplace" className={styles.ctaSecondary}>
                Browse Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
