import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import valuationStyles from '../valuation/page.module.css';
import entryStyles from '../marketplace/marketplace-entry.module.css';

// Reuse Marketplace's entry layout so spacing, cards and responsive behaviour stay aligned.
export default function CostEntryChoices() {
  return (
    <main className={valuationStyles.page}>
      <AppHeader active="none" />
      <div className={`${valuationStyles.container} ${entryStyles.entryContainer}`}>
        <section className={`${valuationStyles.wizardShell} ${valuationStyles.sectorWizardShell} ${entryStyles.entryShell}`}>
          <div className={`${valuationStyles.wizardCard} ${valuationStyles.sectorWizardCard} ${entryStyles.entryCard}`}>
            <div className={`${valuationStyles.stepContent} ${valuationStyles.sectorStepContent} ${entryStyles.entryContent}`}>
              <div className={`${valuationStyles.sectorStart} ${entryStyles.entryStart}`}>
                <div className={`${valuationStyles.sectorIntro} ${entryStyles.entryIntro}`}>
                  <h1 className={`${valuationStyles.stepTitle} ${entryStyles.entryTitle}`}>Manage your costs</h1>
                  <p className={`${valuationStyles.stepText} ${entryStyles.entryText}`}>Record your costs or track your budgets.</p>
                </div>
                <nav className={`${valuationStyles.sectorLargeGrid} ${entryStyles.entryGrid}`} aria-label="Cost choices">
                  {[
                    { href: '/my-invoices?view=costs', title: 'Cost Ledger', description: 'Add and manage costs and invoices' },
                    { href: '/budgets', title: 'Budgets', description: 'Set budgets and track your spending' },
                  ].map(choice => (
                    <Link key={choice.href} href={choice.href}
                      className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive} ${entryStyles.entryChoiceCard}`}
                      style={{ textDecoration: 'none' }} aria-label={`Open ${choice.title}`}>
                      <span className={valuationStyles.sectorVideoOverlay} aria-hidden="true" />
                      <span className={`${valuationStyles.sectorBigCardContent} ${entryStyles.entryChoiceContent}`}>
                        <span className={valuationStyles.sectorLabelWrap}>
                          <strong className={valuationStyles.sectorLabel}>{choice.title}</strong>
                          <span className={valuationStyles.sectorCardHint}>{choice.description}</span>
                        </span>
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
