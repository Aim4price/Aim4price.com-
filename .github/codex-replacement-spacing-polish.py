from pathlib import Path

styles_path = Path('app/valuation/page.module.css')
test_path = Path('tests/basic-estimate-flow.test.mjs')

styles = styles_path.read_text()
tests = test_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Could not find {label}')
    return text.replace(old, new, 1)


old_control_block = '''.replacementPriceStack {
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

new_control_block = '''.replacementPriceStack {
  display: grid;
  grid-row: 1 / span 2;
  gap: 0.76rem;
  min-width: 0;
  align-self: center;
}

.replacementVatToggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 0.34rem;
  margin: 0;
  padding: 0.34rem;
  border: 1px solid rgba(18, 68, 52, 0.13);
  border-radius: 0.92rem;
  background: rgba(239, 246, 242, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 9px 20px rgba(18, 68, 52, 0.04);
}

.replacementVatToggle button {
  min-width: 0;
  min-height: 2.8rem;
  padding: 0.68rem 0.76rem;
  border: 1px solid transparent;
  border-radius: 0.68rem;
  background: transparent;
  color: #60716a;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 850;
  line-height: 1.15;
  text-align: center;
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
  background: rgba(255, 255, 255, 0.82);
}

.replacementVatToggle button:active {
  transform: translateY(1px);
}

.replacementVatToggle button.replacementVatToggleActive {
  border-color: rgba(12, 66, 48, 0.88);
  background: linear-gradient(180deg, #176047 0%, #104a39 100%);
  color: #ffffff;
  box-shadow:
    0 8px 16px rgba(15, 74, 57, 0.19),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
'''
styles = replace_once(styles, old_control_block, new_control_block, 'replacement VAT control block')

old_panel = '''.replacementSliderPanel {
  margin-top: 0.2rem;
}
'''

new_panel = '''.replacementSliderPanel {
  grid-template-columns: minmax(19rem, 21rem) minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 1.35rem;
  row-gap: 0.92rem;
  align-items: center;
  margin-top: 0.25rem;
  padding: 1rem 1.08rem;
}

.replacementSliderReadout {
  display: grid;
  min-height: 9.55rem;
  align-content: center;
  gap: 0.34rem;
  padding: 1.15rem 1.2rem;
}

.replacementSliderReadout span,
.replacementSliderReadout small {
  margin: 0;
}

.replacementSliderPanel .yearSliderControl {
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

.replacementManualCard {
  margin-top: 0.08rem;
  padding: 1.05rem 1.15rem;
}
'''
styles = replace_once(styles, old_panel, new_panel, 'replacement slider panel')

responsive_anchor = '''@media (max-width: 760px) {
  .estimateModeGrid {
'''
responsive = '''@media (max-width: 900px) {
  .replacementSliderPanel {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    gap: 1rem;
    padding: 1rem;
  }

  .replacementPriceStack {
    grid-row: auto;
    width: min(100%, 28rem);
    justify-self: center;
  }

  .replacementSliderPanel .yearSliderControl,
  .replacementSliderPanel .yearFineTuneRow {
    grid-column: 1;
    width: 100%;
    margin-inline: 0;
  }

  .replacementSliderPanel .yearSliderControl {
    padding-inline: 0.15rem;
  }

  .replacementSliderPanel .yearFineTuneRow {
    gap: 0.75rem;
  }
}

@media (max-width: 760px) {
  .estimateModeGrid {
'''
styles = replace_once(styles, responsive_anchor, responsive, 'replacement responsive anchor')

# Lock the desktop balance and responsive stacking so the replacement controls remain aligned.
test_anchor = "  assert.match(valuationStyles, /\\.replacementPriceStack/);\n"
new_assertions = "  assert.match(valuationStyles, /\\.replacementPriceStack[^\\{]*\\{[\\s\\S]*?grid-row: 1 \\/ span 2;[\\s\\S]*?align-self: center;/);\n  assert.match(valuationStyles, /\\.replacementSliderPanel[^\\{]*\\{[\\s\\S]*?grid-template-columns: minmax\\(19rem, 21rem\\) minmax\\(0, 1fr\\);[\\s\\S]*?align-items: center;/);\n  assert.match(valuationStyles, /@media \\(max-width: 900px\\) \\{[\\s\\S]*?\\.replacementSliderPanel[^\\{]*\\{[\\s\\S]*?grid-template-columns: minmax\\(0, 1fr\\);/);\n"
if new_assertions not in tests:
    tests = replace_once(tests, test_anchor, test_anchor + new_assertions, 'replacement spacing regression anchor')

styles_path.write_text(styles)
test_path.write_text(tests)
