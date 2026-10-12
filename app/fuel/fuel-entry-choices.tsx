import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import valuationStyles from '../valuation/page.module.css';
import entryStyles from '../marketplace/marketplace-entry.module.css';

// Reuse Marketplace's entry layout so spacing, cards and responsive behaviour stay aligned.
export default function FuelEntryChoices() {
  return (
    <main className={valuationStyles.page}>
      <AppHeader active="none" />
      <div className={`${valuationStyles.container} ${entryStyles.entryContainer}`}>
        <section className={`${valuationStyles.wizardShell} ${valuationStyles.sectorWizardShell} ${entryStyles.entryShell}`}>
          <div className={`${valuationStyles.wizardCard} ${valuationStyles.sectorWizardCard} ${entryStyles.entryCard}`}>
            <div className={`${valuationStyles.stepContent} ${valuationStyles.sectorStepContent} ${entryStyles.entryContent}`}>
              <div className={`${valuationStyles.sectorStart} ${entryStyles.entryStart}`}>
                <div className={`${valuationStyles.sectorIntro} ${entryStyles.entryIntro}`}>
                  <h1 className={`${valuationStyles.stepTitle} ${entryStyles.entryTitle}`}>Manage your fuel</h1>
                  <p className={`${valuationStyles.stepText} ${entryStyles.entryText}`}>Open your storage ledger or manage fuel slips.</p>
                </div>
                <nav className={`${valuationStyles.sectorLargeGrid} ${entryStyles.entryGrid}`} aria-label="Fuel choices">
                  {[
                    { view: 'storage', title: 'Fuel Ledger', description: 'Track storage tanks and fuel movements' },
                    { view: 'slips', title: 'Fuel Slips', description: 'Add and manage fuel receipts' },
                  ].map(choice => (
                    <Link key={choice.view} href={`/fuel?view=${choice.view}`}
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
