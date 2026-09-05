from pathlib import Path

client_path = Path('app/valuation/valuation-client.tsx')
test_path = Path('tests/basic-estimate-flow.test.mjs')
client = client_path.read_text()
tests = test_path.read_text()

fn = client.index('  function renderBasicReplacementStep() {')
variables_end = client.index('    const hasExtra =', fn)
new_variables = """  function renderBasicReplacementStep() {
    const guide = basicReplacementGuide;
    const inputPrice = basicBaseReplacementPriceExVat;
    const replacementSliderMin = 0;
    const replacementSliderMax = 5_000_000;
    const replacementSliderStep = 50_000;
    const replacementSliderDefault = guide?.suggestedExVat ?? 0;
    const sliderValue = Math.min(
      replacementSliderMax,
      Math.max(replacementSliderMin, inputPrice ?? replacementSliderDefault),
    );
    const progress = ((sliderValue - replacementSliderMin) / Math.max(1, replacementSliderMax - replacementSliderMin)) * 100;
    const sliderStyle = { '--year-progress': `${Math.min(100, Math.max(0, progress))}%` } as CSSProperties;
"""
client = client[:fn] + new_variables + client[variables_end:]

fn = client.index('  function renderBasicReplacementStep() {')
slider_start = client.index('        {basicReplacementBandsLoading ? (', fn)
manual_start = client.index('        <div className={`${styles.currentCard} ${styles.replacementManualCard}`}>', slider_start)
new_slider = """        <div className={`${styles.yearSliderPanel} ${styles.replacementSliderPanel}`}>
          <div className={`${styles.yearSliderReadout} ${styles.replacementSliderReadout}`}>
            <span>Selected replacement price</span>
            <strong>{money(sliderValue)}</strong>
            <small>Excluding VAT</small>
          </div>

          <label className={styles.yearSliderControl}>
            <span className={styles.fieldLabel}>Slide to replacement price</span>
            <input
              className={styles.yearRangeInput}
              style={sliderStyle}
              type="range"
              min={replacementSliderMin}
              max={replacementSliderMax}
              step={replacementSliderStep}
              value={sliderValue}
              onChange={(event) => {
                setBasicReplacementPrice(event.target.value);
                setMessage('');
                resetResult();
              }}
            />
            <span className={styles.yearSliderMeta}>
              <span>{money(replacementSliderMin)}</span>
              <span>{money(replacementSliderMax)}</span>
            </span>
          </label>

          <div className={styles.yearFineTuneRow}>
            <button
              type="button"
              className={styles.yearFineTuneButton}
              onClick={() => {
                setBasicReplacementPrice(String(Math.max(replacementSliderMin, sliderValue - replacementSliderStep)));
                setMessage('');
                resetResult();
              }}
            >
              − R50 000
            </button>
            <button
              type="button"
              className={styles.yearFineTuneButton}
              onClick={() => {
                setBasicReplacementPrice(String(Math.min(replacementSliderMax, sliderValue + replacementSliderStep)));
                setMessage('');
                resetResult();
              }}
            >
              + R50 000
            </button>
          </div>
        </div>

"""
client = client[:slider_start] + new_slider + client[manual_start:]

client = client.replace(
    '<span className={styles.fieldLabel}>Enter replacement price manually (excl. VAT)</span>',
    '<span className={styles.fieldLabel}>Or enter replacement price manually (excl. VAT)</span>',
    1,
)

anchor = "test('replacement styling reuses the year slider visual language and does not introduce a new font', () => {"
idx = tests.index(anchor)
insert_at = tests.index('\n});', idx) + len('\n});')
addition = r'''

test('Basic replacement slider uses the temporary general R0 to R5 million range', () => {
  const replacementStart = client.indexOf('function renderBasicReplacementStep()');
  assert.ok(replacementStart >= 0);
  const replacementBlock = client.slice(replacementStart, replacementStart + 16000);
  assert.match(replacementBlock, /const replacementSliderMin = 0;/);
  assert.match(replacementBlock, /const replacementSliderMax = 5_000_000;/);
  assert.match(replacementBlock, /const replacementSliderStep = 50_000;/);
  assert.match(replacementBlock, /styles\.yearSliderPanel/);
  assert.match(replacementBlock, /styles\.yearSliderReadout/);
  assert.match(replacementBlock, /styles\.yearRangeInput/);
  assert.match(replacementBlock, /styles\.yearFineTuneRow/);
  assert.match(replacementBlock, /− R50 000/);
  assert.match(replacementBlock, /\+ R50 000/);
  assert.doesNotMatch(replacementBlock, /min=\{guide\.minExVat\}/);
  assert.doesNotMatch(replacementBlock, /max=\{guide\.maxExVat\}/);
});'''
tests = tests[:insert_at] + addition + tests[insert_at:]

client_path.write_text(client)
test_path.write_text(tests)
