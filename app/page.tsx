import Image from 'next/image';
import Link from 'next/link';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import styles from './page.module.css';
import { money, runValuation } from '../lib/tractor-logic';

const sample = runValuation({
  modelId: 'john-deere-6135b-field-4wd-cab',
  year: 2020,
  hours: 3500,
  condition: 'good',
});

export default function HomePage() {
  return (
    <main className={styles.page}>
      <AppHeader active="home" ctaHref="/valuation" ctaLabel="Start valuation" />

      <section className={styles.heroSection}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Tractors-first valuations</span>
              <h1 className={styles.heroTitle}>A cleaner homepage, with the valuation flow front and center.</h1>
              <p className={styles.heroBody}>
                This version keeps the focus where you asked: the homepage is more photographic, the tractor valuation
                journey is the core product, and the interface is meant to feel easier to understand, more premium,
                and much more deliberate.
              </p>

              <div className={styles.heroActions}>
                <Link href="/valuation" className={styles.primaryButton}>
                  Start tractor valuation
                </Link>
                <Link href="#valuation-flow" className={styles.secondaryButton}>
                  See how it works
                </Link>
              </div>

              <div className={styles.metricGrid}>
                <article className={styles.metricCard}>
                  <span className={styles.metricLabel}>Aim4price value</span>
                  <strong className={styles.metricValue}>{money(sample.aim4priceValueExVat)}</strong>
                  <p>Condition-adjusted for a 2020 John Deere 6135B at 3,500 hours.</p>
                </article>
                <article className={styles.metricCard}>
                  <span className={styles.metricLabel}>Market midpoint</span>
                  <strong className={styles.metricValue}>{money(sample.marketMid)}</strong>
                  <p>Based on matching structured market comparables in the bundled prototype data.</p>
                </article>
                <article className={styles.metricCard}>
                  <span className={styles.metricLabel}>Department guideline</span>
                  <strong className={styles.metricValue}>{money(sample.departmentValueExVat)}</strong>
                  <p>Replacement value less hourly depreciation, with the salvage floor applied.</p>
                </article>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroPhotoFrame}>
                <Image
                  src="/images/hero-tractor.png"
                  alt="Green tractor in a field"
                  fill
                  className={styles.heroImage}
                  sizes="(max-width: 960px) 100vw, 48vw"
                  priority
                />
              </div>

              <div className={styles.floatingCard}>
                <span className={styles.floatingLabel}>Sample valuation preview</span>
                <h2 className={styles.floatingTitle}>John Deere 6135B</h2>
                <p className={styles.floatingMeta}>2020 model • 3,500 hours • Good condition</p>

                <div className={styles.floatingValues}>
                  <div>
                    <span>Preview value</span>
                    <strong>{money(sample.previewValueExVat)}</strong>
                  </div>
                  <div>
                    <span>Coverage</span>
                    <strong className={styles.coverage}>{sample.coverageBand.toUpperCase()}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>What is improved</span>
            <h2 className={styles.sectionTitle}>The product now reads as a valuation tool first.</h2>
            <p className={styles.sectionBody}>
              The homepage is more visual, the tractor photo is given proper space, and the call to action points
              straight into valuations instead of splitting attention across unfinished areas.
            </p>
          </div>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>Better first impression</h3>
              <p>
                A larger hero image, stronger spacing and clearer value language make the landing page feel closer to a
                production product.
              </p>
            </article>
            <article className={styles.featureCard}>
              <h3>Valuation-led flow</h3>
              <p>
                The main journey now moves users directly from the homepage into the tractor valuation wizard, with
                less emphasis on prototype-only sections.
              </p>
            </article>
            <article className={styles.featureCard}>
              <h3>Three methods, one decision</h3>
              <p>
                Aim4price, market midpoint and Department guideline values still sit together, but the UI is more
                explicit about how they compare.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="valuation-flow" className={styles.sectionAlt}>
        <div className={styles.container}>
          <div className={styles.showcaseGrid}>
            <div className={styles.showcaseCopy}>
              <span className={styles.sectionEyebrow}>Valuation flow</span>
              <h2 className={styles.sectionTitle}>A shorter path from search to result.</h2>
              <div className={styles.flowGrid}>
                <article className={styles.flowCard}>
                  <span className={styles.flowNumber}>01</span>
                  <h3>Pick a tractor profile</h3>
                  <p>Choose brand, tractor type, drive, cab and model from the existing bundled catalogue.</p>
                </article>
                <article className={styles.flowCard}>
                  <span className={styles.flowNumber}>02</span>
                  <h3>Enter the valuation inputs</h3>
                  <p>Set the year model, hours and condition without leaving the flow.</p>
                </article>
                <article className={styles.flowCard}>
                  <span className={styles.flowNumber}>03</span>
                  <h3>Review the three outputs</h3>
                  <p>Compare the methods, review comparables, and keep the next step obvious.</p>
                </article>
              </div>
            </div>

            <div className={styles.showcasePanel}>
              <div className={styles.showcaseImageWrap}>
                <Image
                  src="/images/tractor-generic.png"
                  alt="Generic tractor illustration"
                  fill
                  className={styles.showcaseImage}
                  sizes="(max-width: 960px) 100vw, 42vw"
                />
              </div>
              <div className={styles.showcaseCard}>
                <h3>Focused scope</h3>
                <p>
                  This package concentrates effort on the homepage and valuation experience first, so the visual system
                  feels correct before backend and database work continue.
                </p>
                <Link href="/valuation" className={styles.inlineLink}>
                  Go straight to valuation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <div>
              <span className={styles.sectionEyebrow}>Ready to test</span>
              <h2 className={styles.ctaTitle}>Open the tractor valuation page and run the flow.</h2>
              <p className={styles.ctaBody}>
                The main route is <code>/valuation</code>. A matching <code>/valuations</code> alias is also included so
                either path works for your next backend-focused pass.
              </p>
            </div>
            <div className={styles.ctaActions}>
              <Link href="/valuation" className={styles.primaryButton}>
                Open valuation
              </Link>
              <Link href="/valuations" className={styles.secondaryButton}>
                Open alias route
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
