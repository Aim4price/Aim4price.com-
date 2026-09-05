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


# Keep the UI VAT basis separate from the valuation engine's ex-VAT storage basis.
client = replace_once(
    client,
    "  const [basicReplacementPrice, setBasicReplacementPrice] = useState('');\n",
    "  const [basicReplacementPrice, setBasicReplacementPrice] = useState('');\n  const [basicReplacementVatMode, setBasicReplacementVatMode] = useState<VatDisplayMode>('excl');\n",
    'Basic replacement price state',
)

client = replace_once(
    client,
    """  const basicSpecLevelLabel = BASIC_SPECIFICATION_LEVELS.find((option) => option.key === basicSpecLevel)?.label ?? '';
  const basicBaseReplacementPriceExVat = parseMoneyInput(basicReplacementPrice);
  const basicExtraReplacementPriceExVat = basicExtraChoice === 'family'
""",
    """  const basicSpecLevelLabel = BASIC_SPECIFICATION_LEVELS.find((option) => option.key === basicSpecLevel)?.label ?? '';
  const basicReplacementEnteredPrice = parseMoneyInput(basicReplacementPrice);
  const basicBaseReplacementPriceExVat = basicReplacementEnteredPrice === null
    ? null
    : Math.round(
        basicReplacementVatMode === 'incl'
          ? basicReplacementEnteredPrice / (1 + VAT_RATE)
          : basicReplacementEnteredPrice,
      );
  const basicExtraReplacementPriceExVat = basicExtraChoice === 'family'
""",
    'Basic replacement price ex-VAT derivation',
)

client = replace_once(
    client,
    """  useEffect(() => {
    if (!basicEstimateActive || step !== 5 || !basicReplacementGuide || String(basicReplacementPrice).trim()) return;
    setBasicReplacementPrice(String(basicReplacementGuide.suggestedExVat));
  }, [basicEstimateActive, basicReplacementGuide, basicReplacementPrice, step]);
""",
    """  useEffect(() => {
    if (!basicEstimateActive || step !== 5 || String(basicReplacementPrice).trim()) return;
    const defaultMode = getDefaultVatDisplayMode(selectedSector, selectedFamily?.familyKey);
    setBasicReplacementVatMode(defaultMode);
    if (!basicReplacementGuide) return;
    const suggestedPrice = getVatDisplayValue(basicReplacementGuide.suggestedExVat, defaultMode);
    if (suggestedPrice !== null) setBasicReplacementPrice(String(Math.round(suggestedPrice)));
  }, [basicEstimateActive, basicReplacementGuide, basicReplacementPrice, selectedFamily?.familyKey, selectedSector, step]);
""",
    'Basic replacement defaulting effect',
)

render_start = client.index('  function renderBasicReplacementStep() {')
render_return = client.index('    return (', render_start)
new_render_variables = """  function renderBasicReplacementStep() {
    const guide = basicReplacementGuide;
    const replacementSliderMin = 0;
    const replacementSliderMax = 5_000_000;
    const replacementSliderStep = 50_000;
    const replacementSliderDefault = getVatDisplayValue(guide?.suggestedExVat ?? 0, basicReplacementVatMode) ?? 0;
    const normalizedReplacementInput = String(basicReplacementPrice).replace(/[^0-9.-]/g, '');
    const parsedReplacementInput = normalizedReplacementInput === '' ? null : Number(normalizedReplacementInput);
    const hasReplacementSliderInput = parsedReplacementInput !== null
      && Number.isFinite(parsedReplacementInput)
      && parsedReplacementInput >= 0;
    const selectedReplacementPrice = hasReplacementSliderInput
      ? parsedReplacementInput
      : replacementSliderDefault;
    const sliderValue = Math.min(
      replacementSliderMax,
      Math.max(replacementSliderMin, selectedReplacementPrice),
    );
    const progress = ((sliderValue - replacementSliderMin) / Math.max(1, replacementSliderMax - replacementSliderMin)) * 100;
    const sliderStyle = { '--year-progress': `${Math.min(100, Math.max(0, progress))}%` } as CSSProperties;
    const replacementVatLabel = basicReplacementVatMode === 'incl' ? 'Including VAT' : 'Excluding VAT';

    function setBasicReplacementVatModePreservingPrice(nextMode: VatDisplayMode) {
      if (nextMode === basicReplacementVatMode) return;
      const currentDisplayPrice = parseMoneyInput(basicReplacementPrice);
      if (currentDisplayPrice !== null) {
        const convertedPrice = nextMode === 'incl'
          ? currentDisplayPrice * (1 + VAT_RATE)
          : currentDisplayPrice / (1 + VAT_RATE);
        setBasicReplacementPrice(String(Math.round(convertedPrice)));
      }
      setBasicReplacementVatMode(nextMode);
      setMessage('');
      resetResult();
    }

"""
client = client[:render_start] + new_render_variables + client[render_return:]

client = replace_once(
    client,
    "          <p className={styles.stepText}>Choose the current new replacement price for a comparable asset. All figures on this step are excluding VAT.</p>",
    "          <p className={styles.stepText}>Choose the current new replacement price for a comparable asset.</p>",
    'Replacement step introduction',
)

slider_anchor = "        <div className={`${styles.yearSliderPanel} ${styles.replacementSliderPanel}`}>\n"
vat_toggle = """        <div className={styles.replacementVatToggle} role="group" aria-label="Replacement price VAT basis">
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

""" + slider_anchor
client = replace_once(client, slider_anchor, vat_toggle, 'Replacement slider panel anchor')

client = replace_once(
    client,
    '            <small>Excluding VAT</small>',
    '            <small>{replacementVatLabel}</small>',
    'Replacement readout VAT label',
)

client = replace_once(
    client,
    '            <span className={styles.fieldLabel}>Or enter replacement price manually (excl. VAT)</span>',
    "            <span className={styles.fieldLabel}>Or enter replacement price manually ({basicReplacementVatMode === 'incl' ? 'incl. VAT' : 'excl. VAT'})</span>",
    'Replacement manual input VAT label',
)

client = replace_once(
    client,
    "            <span className={styles.fieldHint}>You can always override Aim4price&apos;s guide with the price you believe best represents the comparable new asset.</span>",
    "            <span className={styles.fieldHint}>You can always override the slider with the price you believe best represents the comparable new asset.</span>",
    'Replacement manual input hint',
)

breakdown_block = """

          {inputPrice ? (
            <div className={styles.replacementBreakdown}>
              <span>
                <small>Asset replacement</small>
                <strong>{money(inputPrice)}</strong>
              </span>
              {hasExtra && basicExtraReplacementPriceExVat ? (
                <>
                  <span className={styles.replacementBreakdownSymbol}>+</span>
                  <span>
                    <small>{extraName || 'Extra'}</small>
                    <strong>{money(basicExtraReplacementPriceExVat)}</strong>
                  </span>
                </>
              ) : null}
              <span className={styles.replacementBreakdownSymbol}>=</span>
              <span>
                <small>Configured asset replacement</small>
                <strong>{money(basicTotalReplacementPriceExVat ?? inputPrice)}</strong>
              </span>
            </div>
          ) : null}
"""
client = replace_once(client, breakdown_block, '\n', 'Replacement price breakdown')

# VAT selector styling and a smaller, guaranteed single-line replacement-price readout.
panel_anchor = ".replacementSliderPanel {\n  margin-top: 0.2rem;\n}\n"
vat_css = """.replacementVatToggle {
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

""" + panel_anchor
styles = replace_once(styles, panel_anchor, vat_css, 'Replacement slider panel styles')

desktop_readout_start = styles.index('.replacementSliderReadout strong {')
desktop_readout_end = styles.index('}', desktop_readout_start) + 1
desktop_readout_block = styles[desktop_readout_start:desktop_readout_end]
if 'font-size: clamp(2.2rem, 4.25vw, 3.6rem);' not in desktop_readout_block:
    raise RuntimeError('Could not find desktop replacement-price readout sizing')
desktop_readout_block = desktop_readout_block.replace(
    'font-size: clamp(2.2rem, 4.25vw, 3.6rem);',
    'font-size: clamp(1.6rem, 2.2vw, 2.2rem);\n  white-space: nowrap;',
    1,
)
styles = styles[:desktop_readout_start] + desktop_readout_block + styles[desktop_readout_end:]

mobile_readout_start = styles.index('.replacementSliderReadout strong {', desktop_readout_start + len(desktop_readout_block))
mobile_readout_end = styles.index('}', mobile_readout_start) + 1
mobile_readout_block = styles[mobile_readout_start:mobile_readout_end]
if 'font-size: clamp(2rem, 10vw, 3rem);' not in mobile_readout_block:
    raise RuntimeError('Could not find mobile replacement-price readout sizing')
mobile_readout_block = mobile_readout_block.replace(
    'font-size: clamp(2rem, 10vw, 3rem);',
    'font-size: clamp(1.5rem, 7vw, 2rem);',
    1,
)
styles = styles[:mobile_readout_start] + mobile_readout_block + styles[mobile_readout_end:]

# Regression coverage for the VAT selector, ex-VAT normalization and removal of the redundant breakdown.
test_anchor = "test('the final result renderer and save destinations remain shared with the existing valuation flow', () => {"
if test_anchor not in tests:
    raise RuntimeError('Could not find final result regression test anchor')
addition = r'''test('Basic replacement VAT selector preserves an ex-VAT valuation basis and removes the redundant breakdown', () => {
  assert.match(client, /const \[basicReplacementVatMode, setBasicReplacementVatMode\] = useState<VatDisplayMode>\('excl'\);/);
  assert.match(client, /const basicBaseReplacementPriceExVat = basicReplacementEnteredPrice === null[\s\S]*?basicReplacementVatMode === 'incl'[\s\S]*?basicReplacementEnteredPrice \/ \(1 \+ VAT_RATE\)/);

  const replacementStart = client.indexOf('function renderBasicReplacementStep()');
  const replacementEnd = client.indexOf('function renderMotorSubtypeSelection', replacementStart);
  const replacementBlock = client.slice(replacementStart, replacementEnd);
  assert.ok(replacementStart >= 0 && replacementEnd > replacementStart);
  assert.match(replacementBlock, /role="group" aria-label="Replacement price VAT basis"/);
  assert.match(replacementBlock, />\s*Excluding VAT\s*<\/button>/);
  assert.match(replacementBlock, />\s*Including VAT\s*<\/button>/);
  assert.match(replacementBlock, /setBasicReplacementVatModePreservingPrice\('excl'\)/);
  assert.match(replacementBlock, /setBasicReplacementVatModePreservingPrice\('incl'\)/);
  assert.match(replacementBlock, /currentDisplayPrice \* \(1 \+ VAT_RATE\)/);
  assert.match(replacementBlock, /currentDisplayPrice \/ \(1 \+ VAT_RATE\)/);
  assert.match(replacementBlock, /replacementVatLabel/);
  assert.doesNotMatch(replacementBlock, /Asset replacement/);
  assert.doesNotMatch(replacementBlock, /Configured asset replacement/);
  assert.doesNotMatch(replacementBlock, /replacementBreakdown/);

  assert.match(valuationStyles, /\.replacementVatToggle/);
  assert.match(valuationStyles, /\.replacementVatToggle button\.replacementVatToggleActive/);
  assert.match(valuationStyles, /\.replacementSliderReadout strong[^\{]*\{[\s\S]*?font-size: clamp\(1\.6rem, 2\.2vw, 2\.2rem\);[\s\S]*?white-space: nowrap;/);
});

'''
tests = tests.replace(test_anchor, addition + test_anchor, 1)

client_path.write_text(client)
styles_path.write_text(styles)
test_path.write_text(tests)
