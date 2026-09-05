import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, valuationStyles, appStyles, ownerPage, dealerPage] = await Promise.all([
  read('app/valuation/valuation-client.tsx'),
  read('app/valuation/page.module.css'),
  read('app/dealer/dealer.module.css'),
  read('app/owner-app/valuation/page.tsx'),
  read('app/dealer/valuation/page.tsx'),
]);

test('Owner and Dealer continue to share one valuation client with app-only presentation', () => {
  assert.match(ownerPage, /<ValuationClient ownerAppMode \/>/);
  assert.match(dealerPage, /<ValuationClient dealerAppMode \/>/);
  assert.match(client, /styles\.appValuation/);
  assert.match(client, /Estimate \{step\} of \{WIZARD_STEPS\.length\}/);
  assert.match(client, /compactAppMode \? item\.step : complete \? '✓' : item\.step/);
  assert.match(client, /!compactAppMode \? \([\s\S]*?styles\.stepperLabel/);
  assert.match(appStyles, /stepperLabel[^\{]*\{[\s\S]*?display: none !important/);
});

test('app sector choices are static green cards and progress numbers are centered circles', () => {
  assert.match(client, /compactAppMode \? styles\.sectorBigCardApp : ''/);
  assert.match(client, /\{!compactAppMode \? \([\s\S]*?<video/);
  assert.match(client, /!compactAppMode && !shouldAutoPlaySectorVideos/);
  assert.match(valuationStyles, /\.appValuation \.sectorBigCardApp[^\{]*\{[\s\S]*?place-items: center;[\s\S]*?background: #1d5742;/);
  assert.match(appStyles, /button\[class\*='sectorBigCardApp'\][^\{]*\{[\s\S]*?place-items: center !important;[\s\S]*?background: #1d5742 !important;/);
  assert.match(appStyles, /wizardHeader[^\n]*> \[class\*='stepper'\][^\{]*\{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\) !important;[\s\S]*?align-items: center !important;/);
  assert.match(appStyles, /\[class\*='stepperItem'\][^\{]*\{[\s\S]*?place-items: center !important;[\s\S]*?width: 36px !important;[\s\S]*?height: 36px !important;[\s\S]*?background: transparent !important;/);
  assert.match(appStyles, /\[class\*='stepperBullet'\][^\{]*\{[\s\S]*?place-items: center !important;[\s\S]*?width: 34px !important;[\s\S]*?height: 34px !important;[\s\S]*?border-radius: 50% !important;[\s\S]*?line-height: 1 !important;/);
});

test('app selections open as searchable lists and remain available when navigating backwards', () => {
  assert.match(client, /setEquipmentDropdownOpen\(compactAppMode\)/);
  assert.match(client, /setBrandDropdownOpen\(compactAppMode\)/);
  assert.match(client, /setEquipmentDropdownOpen\(compactAppMode && Boolean\(selectedSector\)\)/);
  assert.match(client, /compactAppMode && step === 2[\s\S]*?setEquipmentDropdownOpen\(true\)/);
  assert.match(appStyles, /equipmentPickerCard[^\n]*equipmentDropdownTrigger[^\{]*\{[\s\S]*?display: none !important/);
  assert.match(appStyles, /equipmentPickerCard[^\n]*equipmentDropdownMenu[^\{]*\{[\s\S]*?background: transparent !important/);
});

test('Basic Estimate bypasses the legacy Path decision in both Owner and Dealer apps', () => {
  assert.match(client, /const basicEstimateActive = estimateExperience === 'basic'/);
  assert.match(client, /if \(basicEstimateActive\) \{[\s\S]*?if \(step === 2\) return renderBasicBrandModelStep\(\);[\s\S]*?if \(step === 3\) return renderBasicLevelStep\(\);/);
  assert.match(client, /<strong className=\{styles\.sectorLabel\}>Basic<\/strong>/);
  assert.match(client, /<strong className=\{styles\.sectorLabel\}>Advanced<\/strong>/);
  assert.match(client, /Aim4price Exclusive/);
  assert.match(client, /compactAppMode && selectedSector && estimateExperience/);
  assert.match(valuationStyles, /\.estimateModeGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('compact model and tractor choices use concise app wording', () => {
  assert.match(client, /compactAppMode \? 'Enter' : 'Enter model manually'/);
  assert.match(client, /compactAppMode \? 'Unknown' : 'Model unknown'/);
  assert.match(client, /\{ value: 'open-station', label: 'Open' \}/);
  assert.match(client, /<strong>Extra&apos;s<\/strong>/);
  assert.doesNotMatch(client, /<strong>Other<\/strong>/);
});

test('mobile year and usage cards reserve their full text width', () => {
  assert.match(client, /compactAppMode \? 'Manufacturing year' : `\$\{getAssetNounTitle\(selectedSector\)\} manufacturing year`/);
  assert.match(valuationStyles, /\.appValuation \.specStepCard[^\{]*\{[\s\S]*?grid-template-columns: 2\.45rem minmax\(0, 1fr\)/);
  assert.match(valuationStyles, /\.appValuation \.specStepContent[^\{]*\{[\s\S]*?padding: 0;/);
  assert.match(valuationStyles, /\.appValuation \.specStepAction[^\{]*\{[\s\S]*?grid-column: 2;/);
  assert.match(valuationStyles, /\.appValuation \.specStepCardComplete[^\{]*\{[\s\S]*?grid-template-columns: 2\.45rem minmax\(0, 1fr\) auto;/);
  assert.match(valuationStyles, /\.appValuation \.specStepCardComplete > \.specStepAction[^\{]*\{[\s\S]*?grid-column: 3;[\s\S]*?grid-row: 1;/);
  assert.match(appStyles, /\[class\*='specStepCard'\][^\{]*\{[\s\S]*?grid-template-columns: 40px minmax\(0, 1fr\) !important/);
  assert.match(appStyles, /\[class\*='specStepContent'\][^\{]*\{[\s\S]*?padding: 0 !important/);
  assert.match(appStyles, /\[class\*='specStepCardComplete'\][^\{]*\{[\s\S]*?grid-template-columns: 40px minmax\(0, 1fr\) auto !important/);
  assert.match(appStyles, /\[class\*='specStepCardComplete'\] \[class\*='specStepAction'\][^\{]*\{[\s\S]*?grid-column: 3 !important/);
});

test('condition assessment starts broad and reveals detail only when requested', () => {
  assert.doesNotMatch(client, /conditionModeToggle/);
  assert.match(client, /id="valuation-detailed-condition-entry"/);
  assert.match(client, /aria-controls="detailed-condition-assessment"/);
  assert.match(client, /compactAppMode \? 'Add details' : 'Add detailed condition'/);
  assert.match(client, /scrollToDetailsCard\('valuation-detailed-condition-entry'\)/);
  assert.match(client, /id="detailed-condition-assessment"/);
  assert.match(client, /Detailed condition \$\{currentDetailedSectionNumber\} of \$\{detailedAssessmentSections\.length\}/);
  assert.match(client, /activeDetailedAssessmentSection/);
  assert.match(client, /detailedAssessmentSummary/);
  assert.match(client, /currentDetailedSection === detailedAssessmentSections\[0\]\.label/);
  assert.match(client, /currentDetailedSection === detailedAssessmentSections\[4\]\.label/);
  assert.match(client, /basicEstimateActive \? basicConditionTemplate\.mechanical : 'Mechanical condition'/);
  assert.match(valuationStyles, /conditionButtonGrid > \.conditionChoiceButton:last-child:nth-child\(odd\)[^\{]*\{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(valuationStyles, /\.appValuation \.conditionChoiceButtonActive[^\{]*\{[\s\S]*?background: #1d5742;/);
  assert.match(valuationStyles, /\.appValuation \.detailedAssessmentEntry[^\{]*\{[\s\S]*?display: grid;[\s\S]*?background: #f0f7f3;/);
  assert.match(valuationStyles, /\.appValuation \.detailedAssessmentSummary/);
  assert.match(valuationStyles, /detailedAssessmentSummary \+ \.dealerAssessmentGroup[^\{]*\{[\s\S]*?margin-top: 0\.75rem/);
  assert.match(appStyles, /\[class\*='dealerAssessmentOptionActive'\][^\{]*\{[\s\S]*?background: #1d5742 !important/);
});

test('phone estimate uses compact sectors, safe sheets and persistent actions', () => {
  assert.match(appStyles, /Shared Owner\/Dealer Estimate: final phone-first overrides/);
  assert.match(appStyles, /sectorLargeGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(appStyles, /max-height: calc\(100dvh - 4px\) !important/);
  assert.match(appStyles, /font-size: 16px !important/);
  assert.match(appStyles, /wizardFooter[^\{]*\{[\s\S]*?position: sticky !important;[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(appStyles, /detailsModalActions[^\{]*\{[\s\S]*?position: sticky !important/);
  assert.match(appStyles, /dealerCompactModalHeader[^\{]*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 44px !important/);
  assert.doesNotMatch(appStyles, /@media \(max-width: 370px\)[\s\S]*?sectorLargeGrid[^\{]*\{[\s\S]*?grid-template-columns: 1fr !important/);
});

test('result facts remain visible as a compact two-column mobile summary', () => {
  assert.match(appStyles, /resultFactsGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(client, /<span>Year model<\/span>/);
  assert.match(client, /<span>Usage<\/span>/);
  assert.match(client, /<span>Condition<\/span>/);
  assert.match(client, /<span>Popularity<\/span>/);
  assert.match(client, /role="group" aria-label="VAT display mode"/);
  assert.match(valuationStyles, /\.appValuation \.resultHeroTopline[^\{]*\{[\s\S]*?flex-direction: row;[\s\S]*?flex-wrap: wrap;[\s\S]*?justify-content: flex-start;/);
  assert.match(valuationStyles, /\.appValuation \.resultValueLine \.resultValue[^\{]*\{[\s\S]*?font-size: clamp\(2\.85rem, 13\.2vw, 3\.3rem\)/);
  assert.match(valuationStyles, /\.appValuation \.resultValueLineCompact \.resultValue[^\{]*\{[\s\S]*?font-size: clamp\(2\.55rem, 12\.3vw, 3\.05rem\)/);
  assert.match(valuationStyles, /\.appValuation \.resultValueLineTight \.resultValue[^\{]*\{[\s\S]*?font-size: clamp\(2rem, 10vw, 2\.55rem\)/);
  assert.match(client, /digitCount >= 8[\s\S]*?resultValueLineTight/);
  assert.match(client, /digitCount >= 7[\s\S]*?resultValueLineCompact/);
  assert.match(valuationStyles, /\.appValuation \.resultKicker,[\s\S]*?\.appValuation \.resultConfidenceBadge[^\{]*\{[\s\S]*?min-height: 1\.75rem;/);
  assert.match(valuationStyles, /\.appValuation \.resultConfidenceNote \+ \.resultConfidenceNote[^\{]*\{[\s\S]*?margin-top: -0\.45rem;/);
  assert.match(valuationStyles, /\.appValuation \.resultAccordionAction[^\{]*\{[\s\S]*?min-height: 2\.75rem;/);
});
