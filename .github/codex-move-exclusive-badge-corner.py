from pathlib import Path

styles_path = Path('app/valuation/page.module.css')
test_path = Path('tests/basic-estimate-flow.test.mjs')

styles = styles_path.read_text()
tests = test_path.read_text()

styles = styles.replace(
    '''.estimateModeAdvancedCard .sectorCardTopRow {\n  position: absolute;\n  top: 0.85rem;\n  right: 0.9rem;''',
    '''.estimateModeAdvancedCard .sectorCardTopRow {\n  position: absolute;\n  top: 0.55rem;\n  right: 0.55rem;''',
    1,
)
styles = styles.replace(
    '''  .estimateModeAdvancedCard .sectorCardTopRow {\n    top: 0.8rem;\n    right: 0.8rem;\n  }''',
    '''  .estimateModeAdvancedCard .sectorCardTopRow {\n    top: 0.6rem;\n    right: 0.6rem;\n  }''',
    1,
)
tests = tests.replace(
    r'''assert.match(valuationStyles, /\.estimateModeAdvancedCard \.sectorCardTopRow[^\{]*\{[\s\S]*?position: absolute;[\s\S]*?top: 0\.85rem;[\s\S]*?right: 0\.9rem;[\s\S]*?justify-content: flex-end;/);''',
    r'''assert.match(valuationStyles, /\.estimateModeAdvancedCard \.sectorCardTopRow[^\{]*\{[\s\S]*?position: absolute;[\s\S]*?top: 0\.55rem;[\s\S]*?right: 0\.55rem;[\s\S]*?justify-content: flex-end;/);''',
    1,
)

if 'top: 0.55rem;' not in styles or 'right: 0.55rem;' not in styles:
    raise RuntimeError('Desktop Exclusive badge corner adjustment was not applied')
if 'top: 0.6rem;' not in styles or 'right: 0.6rem;' not in styles:
    raise RuntimeError('Responsive Exclusive badge corner adjustment was not applied')
if 'top: 0\\.55rem;' not in tests or 'right: 0\\.55rem;' not in tests:
    raise RuntimeError('Regression assertion was not updated')

styles_path.write_text(styles)
test_path.write_text(tests)
