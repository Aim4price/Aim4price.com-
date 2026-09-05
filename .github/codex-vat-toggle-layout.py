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


old_client = '''        <div className={styles.replacementVatToggle} role="group" aria-label="Replacement price VAT basis">
          <button
            type="button"
            className={basicReplacementVatMode === 'excl' ? styles.replacementVatToggleActive : ''}
            aria-pressed={basicReplacementVatMode === 'excl'}
            onClick={() => setBasicReplacementVatModePreservingPrice('excl')}
          >
            Excluding VAT
          </button>
          <button
            type="button"
            className={basicReplacementVatMode === 'incl' ? styles.replacementVatToggleActive : ''}
            aria-pressed={basicReplacementVatMode === 'incl'}
            onClick={() => setBasicReplacementVatModePreservingPrice('incl')}
          >
            Including VAT
          </button>
        </div>

        <div className={`${styles.yearSliderPanel} ${styles.replacementSliderPanel}`}>
          <div className={`${styles.yearSliderReadout} ${styles.replacementSliderReadout}`}>
            <span>Selected replacement price</span>
            <strong>{money(selectedReplacementPrice)}</strong>
            <small>{replacementVatLabel}</small>
          </div>

          <label className={styles.yearSliderControl}>
'''

new_client = '''        <div className={`${styles.yearSliderPanel} ${styles.replacementSliderPanel}`}>
          <div className={styles.replacementPriceStack}>
            <div className={`${styles.yearSliderReadout} ${styles.replacementSliderReadout}`}>
              <span>Selected replacement price</span>
              <strong>{money(selectedReplacementPrice)}</strong>
              <small>{replacementVatLabel}</small>
            </div>

            <div className={styles.replacementVatToggle} role="group" aria-label="Replacement price VAT basis">
              <button
                type="button"
                className={basicReplacementVatMode === 'excl' ? styles.replacementVatToggleActive : ''}
                aria-pressed={basicReplacementVatMode === 'excl'}
                onClick={() => setBasicReplacementVatModePreservingPrice('excl')}
              >
                Excluding VAT
              </button>
              <button
                type="button"
                className={basicReplacementVatMode === 'incl' ? styles.replacementVatToggleActive : ''}
                aria-pressed={basicReplacementVatMode === 'incl'}
                onClick={() => setBasicReplacementVatModePreservingPrice('incl')}
              >
                Including VAT
              </button>
            </div>
          </div>

          <label className={styles.yearSliderControl}>
'''

client = replace_once(client, old_client, new_client, 'VAT toggle placement')

old_toggle_css = '''.replacementVatToggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 25rem);
  gap: 0.45rem;
  margin: 0 auto 0.1rem;
  padding: 0.35rem;
  border: 1px solid rgba(18, 68, 52, 0.11);
  border-radius: 1rem;
  background: rgba(247, 250, 248, 0.92);
}

.replacementVatToggle button {
  min-height: 2.75rem;
  padding: 0.62rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 0.72rem;
  background: transparent;
  color: #62736c;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.replacementVatToggle button:hover {
  color: #184c3b;
  background: rgba(255, 255, 255, 0.72);
}

.replacementVatToggle button.replacementVatToggleActive {
  border-color: rgba(18, 68, 52, 0.14);
  background: #ffffff;
  color: #0f4a39;
  box-shadow: 0 5px 12px rgba(18, 68, 52, 0.07);
}

'''

new_toggle_css = '''.replacementPriceStack {
  display: grid;
  gap: 0.68rem;
  min-width: 0;
  align-self: stretch;
}

.replacementVatToggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 0.35rem;
  margin: 0;
  padding: 0.3rem;
  border: 1px solid rgba(18, 68, 52, 0.13);
  border-radius: 0.9rem;
  background: rgba(239, 246, 242, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 8px 18px rgba(18, 68, 52, 0.035);
}

.replacementVatToggle button {
  min-width: 0;
  min-height: 2.65rem;
  padding: 0.62rem 0.68rem;
  border: 1px solid transparent;
  border-radius: 0.64rem;
  background: transparent;
  color: #60716a;
  font: inherit;
  font-size: 0.79rem;
  font-weight: 850;
  line-height: 1.15;
  cursor: pointer;
  transition:
    transform 150ms ease,
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.replacementVatToggle button:hover {
  color: #123f32;
  background: rgba(255, 255, 255, 0.78);
}

.replacementVatToggle button:active {
  transform: translateY(1px);
}

.replacementVatToggle button.replacementVatToggleActive {
  border-color: rgba(12, 66, 48, 0.88);
  background: linear-gradient(180deg, #176047 0%, #104a39 100%);
  color: #ffffff;
  box-shadow:
    0 7px 14px rgba(15, 74, 57, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

'''

styles = replace_once(styles, old_toggle_css, new_toggle_css, 'VAT toggle styles')

# Keep the stack compact on mobile and allow both labels to fit without crowding.
mobile_anchor = '''  .replacementSliderReadout strong {
    font-size: clamp(1.5rem, 7vw, 2rem);
  }
'''
mobile_replacement = '''  .replacementSliderReadout strong {
    font-size: clamp(1.5rem, 7vw, 2rem);
  }

  .replacementPriceStack {
    gap: 0.6rem;
  }

  .replacementVatToggle button {
    min-height: 2.8rem;
    font-size: 0.8rem;
  }
'''
styles = replace_once(styles, mobile_anchor, mobile_replacement, 'mobile replacement VAT styles')

# Add a placement regression: the segmented control must live below the green price readout,
# inside the left column, before the slider control begins.
test_anchor = "  assert.match(replacementBlock, /role=\"group\" aria-label=\"Replacement price VAT basis\"/);\n"
placement_assertions = "  assert.match(replacementBlock, /styles\\.replacementPriceStack[\\s\\S]*?styles\\.replacementSliderReadout[\\s\\S]*?styles\\.replacementVatToggle[\\s\\S]*?<label className=\\{styles\\.yearSliderControl\\}>/);\n  assert.match(valuationStyles, /\\.replacementPriceStack/);\n"
if placement_assertions not in tests:
    tests = replace_once(tests, test_anchor, test_anchor + placement_assertions, 'VAT placement regression anchor')

client_path.write_text(client)
styles_path.write_text(styles)
test_path.write_text(tests)
