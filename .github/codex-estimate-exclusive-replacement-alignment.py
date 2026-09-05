from pathlib import Path

client_path = Path('app/valuation/valuation-client.tsx')
styles_path = Path('app/valuation/page.module.css')
test_path = Path('tests/basic-estimate-flow.test.mjs')

client = client_path.read_text()
styles = styles_path.read_text()
tests = test_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Could not find {label}')
    return text.replace(old, new, 1)


# Advanced remains intentionally locked/cosmetic, but should visually mirror Basic's CTA.
client = replace_once(
    client,
    '                  <span className={`${styles.sectorCardHint} ${styles.estimateModeAdvancedSpacer}`} aria-hidden="true">Start estimate →</span>',
    '                  <span className={`${styles.sectorCardHint} ${styles.estimateModeAdvancedHint}`} aria-hidden="true">Start estimate →</span>',
    'Advanced cosmetic Start estimate hint',
)

# Make the left replacement-price stack and right slider stack share the same visual rows.
styles = replace_once(
    styles,
    '''.replacementPriceStack {
  display: grid;
  grid-row: 1 / span 2;
  gap: 0.76rem;
  min-width: 0;
  align-self: center;
}
''',
    '''.replacementPriceStack {
  display: grid;
  grid-row: 1 / span 2;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.82rem;
  min-width: 0;
  align-self: stretch;
}
''',
    'Replacement price stack alignment',
)

styles = replace_once(
    styles,
    '''.replacementSliderPanel {
  grid-template-columns: minmax(19rem, 21rem) minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 1.35rem;
  row-gap: 0.92rem;
  align-items: center;
  margin-top: 0.25rem;
  padding: 1rem 1.08rem;
}
''',
    '''.replacementSliderPanel {
  grid-template-columns: minmax(20rem, 21.5rem) minmax(0, 1fr);
  grid-template-rows: minmax(9.75rem, 1fr) auto;
  column-gap: 1.55rem;
  row-gap: 0.82rem;
  align-items: stretch;
  margin-top: 0.25rem;
  padding: 1.08rem 1.15rem;
}
''',
    'Replacement slider panel grid',
)

styles = replace_once(
    styles,
    '''.replacementSliderReadout {
  display: grid;
  min-height: 9.55rem;
  align-content: center;
  gap: 0.34rem;
  padding: 1.15rem 1.2rem;
}
''',
    '''.replacementSliderReadout {
  display: grid;
  min-height: 0;
  height: 100%;
  align-content: center;
  gap: 0.36rem;
  padding: 1.2rem 1.25rem;
}
''',
    'Replacement slider readout alignment',
)

styles = replace_once(
    styles,
    '''.replacementSliderPanel .yearSliderControl {
  align-self: center;
  display: grid;
  gap: 0.86rem;
  min-width: 0;
  padding: 0.1rem 0.28rem 0;
}

.replacementSliderPanel .yearSliderMeta {
  margin-top: -0.08rem;
}

.replacementSliderPanel .yearFineTuneRow {
  grid-column: 2;
  gap: 0.82rem;
  margin: 0 0.28rem;
}

.replacementSliderPanel .yearFineTuneButton {
  min-height: 3.08rem;
}
''',
    '''.replacementSliderPanel .yearSliderControl {
  align-self: stretch;
  display: grid;
  align-content: center;
  gap: 0.9rem;
  min-width: 0;
  padding: 0 0.3rem;
}

.replacementSliderPanel .yearSliderControl .fieldLabel,
.replacementSliderPanel .yearSliderMeta {
  margin: 0;
}

.replacementSliderPanel .yearFineTuneRow {
  grid-column: 2;
  align-self: stretch;
  gap: 0.9rem;
  margin: 0 0.3rem;
}

.replacementSliderPanel .yearFineTuneButton {
  min-height: 3.45rem;
}
''',
    'Replacement slider control alignment',
)

# Keep responsive stacking centered after the desktop row alignment changes.
styles = replace_once(
    styles,
    '''  .replacementPriceStack {
    grid-row: auto;
    width: min(100%, 28rem);
    justify-self: center;
  }
''',
    '''  .replacementPriceStack {
    grid-row: auto;
    grid-template-rows: auto auto;
    width: min(100%, 29rem);
    justify-self: center;
    align-self: auto;
  }
''',
    'Responsive replacement price stack',
)

# Pin the Exclusive badge to the true card corner and expose the cosmetic CTA beneath Advanced.
styles = replace_once(
    styles,
    '''.estimateModeAdvancedCard .sectorCardTopRow {
  position: absolute;
  top: clamp(1rem, 1.35vw, 1.2rem);
  right: clamp(1rem, 1.35vw, 1.2rem);
  z-index: 4;
  width: auto;
  min-height: 0;
  margin: 0;
}

.estimateModeAdvancedSpacer {
  visibility: hidden;
}
''',
    '''.estimateModeAdvancedCard .sectorCardTopRow {
  position: absolute;
  top: 0.85rem;
  right: 0.9rem;
  z-index: 5;
  width: auto;
  min-height: 0;
  margin: 0;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: none;
}

.estimateModeAdvancedHint {
  opacity: 0.92;
}
''',
    'Advanced Exclusive badge positioning',
)

styles = replace_once(
    styles,
    '''.exclusiveBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.15rem;
  padding: 0 0.86rem;
  border: 1px solid rgba(239, 193, 84, 0.9);
  border-radius: 999px;
  background: rgba(17, 52, 41, 0.72);
  color: #f4cd6c;
  box-shadow:
    0 10px 22px rgba(10, 34, 26, 0.16),
    inset 0 1px 0 rgba(255, 242, 199, 0.08);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.09em;
  line-height: 1;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
}

.exclusiveBadgeIcon {
  width: 0.95rem;
  height: 0.95rem;
  flex: 0 0 auto;
}
''',
    '''.exclusiveBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.46rem;
  min-height: 2.05rem;
  padding: 0 0.78rem;
  border: 1px solid rgba(239, 193, 84, 0.92);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(18, 63, 49, 0.94) 0%, rgba(12, 48, 37, 0.96) 100%);
  color: #f6d77c;
  box-shadow:
    0 9px 20px rgba(8, 31, 24, 0.18),
    inset 0 1px 0 rgba(255, 242, 199, 0.1);
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.085em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  backdrop-filter: blur(10px);
}

.exclusiveBadgeIcon {
  width: 0.9rem;
  height: 0.9rem;
  flex: 0 0 auto;
}
''',
    'Exclusive badge styling',
)

styles = replace_once(
    styles,
    '''  .estimateModeAdvancedCard .sectorCardTopRow {
    top: 1rem;
    right: 1rem;
  }
''',
    '''  .estimateModeAdvancedCard .sectorCardTopRow {
    top: 0.8rem;
    right: 0.8rem;
  }
''',
    'Mobile Exclusive badge positioning',
)

# Regression coverage: Advanced stays locked, while its visible CTA remains presentation-only.
tests = replace_once(
    tests,
    "  assert.match(client, /<strong className=\\{styles\\.sectorLabel\\}>Advanced<\\/strong>[\\s\\S]*?styles\\.estimateModeAdvancedSpacer/);\n",
    "  const advancedCardStart = client.indexOf('estimateModeAdvancedCard');\n  assert.notEqual(advancedCardStart, -1);\n  const advancedCardChunk = client.slice(\n    client.lastIndexOf('<button', advancedCardStart),\n    client.indexOf('</button>', advancedCardStart) + '</button>'.length,\n  );\n  assert.match(advancedCardChunk, /estimateModeCardLocked/);\n  assert.match(advancedCardChunk, /\\bdisabled\\b/);\n  assert.match(advancedCardChunk, /aria-disabled=\"true\"/);\n  assert.match(advancedCardChunk, /estimateModeAdvancedHint/);\n  assert.match(advancedCardChunk, /aria-hidden=\"true\"/);\n  assert.match(advancedCardChunk, /Start estimate →/);\n",
    'Advanced estimate regression assertion',
)

tests = replace_once(
    tests,
    "  assert.match(valuationStyles, /\\.estimateModeAdvancedCard \\.sectorCardTopRow[^\\{]*\\{[\\s\\S]*?position: absolute;[\\s\\S]*?right: clamp\\(1rem, 1\\.35vw, 1\\.2rem\\);/);\n  assert.match(valuationStyles, /\\.estimateModeAdvancedSpacer[^\\{]*\\{[\\s\\S]*?visibility: hidden;/);\n  assert.match(valuationStyles, /\\.exclusiveBadge[^\\{]*\\{[\\s\\S]*?border: 1px solid rgba\\(239, 193, 84, 0\\.9\\);[\\s\\S]*?text-transform: uppercase;/);\n",
    "  assert.match(valuationStyles, /\\.estimateModeAdvancedCard \\.sectorCardTopRow[^\\{]*\\{[\\s\\S]*?position: absolute;[\\s\\S]*?top: 0\\.85rem;[\\s\\S]*?right: 0\\.9rem;[\\s\\S]*?justify-content: flex-end;/);\n  assert.match(valuationStyles, /\\.estimateModeAdvancedHint[^\\{]*\\{[\\s\\S]*?opacity: 0\\.92;/);\n  assert.doesNotMatch(valuationStyles, /\\.estimateModeAdvancedSpacer/);\n  assert.match(valuationStyles, /\\.exclusiveBadge[^\\{]*\\{[\\s\\S]*?border: 1px solid rgba\\(239, 193, 84, 0\\.92\\);[\\s\\S]*?white-space: nowrap;[\\s\\S]*?text-transform: uppercase;/);\n",
    'Advanced estimate styling regression assertions',
)

tests = replace_once(
    tests,
    "  assert.match(valuationStyles, /\\.replacementPriceStack[^\\{]*\\{[\\s\\S]*?grid-row: 1 \\/ span 2;[\\s\\S]*?align-self: center;/);\n  assert.match(valuationStyles, /\\.replacementSliderPanel[^\\{]*\\{[\\s\\S]*?grid-template-columns: minmax\\(19rem, 21rem\\) minmax\\(0, 1fr\\);[\\s\\S]*?align-items: center;/);\n",
    "  assert.match(valuationStyles, /\\.replacementPriceStack[^\\{]*\\{[\\s\\S]*?grid-row: 1 \\/ span 2;[\\s\\S]*?grid-template-rows: minmax\\(0, 1fr\\) auto;[\\s\\S]*?align-self: stretch;/);\n  assert.match(valuationStyles, /\\.replacementSliderPanel[^\\{]*\\{[\\s\\S]*?grid-template-columns: minmax\\(20rem, 21\\.5rem\\) minmax\\(0, 1fr\\);[\\s\\S]*?grid-template-rows: minmax\\(9\\.75rem, 1fr\\) auto;[\\s\\S]*?align-items: stretch;/);\n  assert.match(valuationStyles, /\\.replacementSliderPanel \\.yearFineTuneButton[^\\{]*\\{[\\s\\S]*?min-height: 3\\.45rem;/);\n",
    'Replacement alignment regression assertions',
)

client_path.write_text(client)
styles_path.write_text(styles)
test_path.write_text(tests)
