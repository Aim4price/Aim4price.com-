const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { marketplaceDealComparison } = load('lib/selling-price.ts');
const { calculateMarketplaceDealRating } = load('lib/marketplace.ts');

for (const basis of ['realistic', 'ideal']) {
  test(`${basis} ratings use the exact agreed boundaries`, () => {
    const benchmark = basis === 'realistic'
      ? { realisticSellingPriceExVat: 100000, aim4priceValueExVat: 200000 }
      : { aim4priceValueExVat: 100000 };
    for (const [price, rating, label] of [
      [79999, 'low', 'Low price'], [80000, 'great', 'Good value'],
      [94999, 'great', 'Good value'], [95000, 'fair', 'Fair value'],
      [100000, 'fair', 'Fair value'], [105000, 'fair', 'Fair value'],
      [105001, 'high', 'Above estimate'],
    ]) {
      const input = { ...benchmark, askingPriceExVat: price };
      const comparison = marketplaceDealComparison(input);
      assert.equal(comparison.basis, basis);
      assert.equal(comparison.rating, rating);
      assert.equal(comparison.label, label);
      assert.match(comparison.difference, new RegExp(`${basis} selling price`));
      assert.equal(calculateMarketplaceDealRating(input).rating, rating);
    }
  });
}
test('current realistic price wins; stale, invalid or missing realistic price falls back to ideal', () => {
  const input = { askingPriceExVat: 90000, realisticSellingPriceExVat: 100000, aim4priceValueExVat: 120000 };
  assert.equal(marketplaceDealComparison(input).difference, '10% below realistic selling price');
  for (const value of [null, undefined, NaN, Infinity, 0, -1]) {
    const comparison = marketplaceDealComparison({ ...input, realisticSellingPriceExVat: value });
    assert.equal(comparison.rating, 'low');
    assert.equal(comparison.difference, '25% below ideal selling price');
  }
  assert.equal(marketplaceDealComparison({ ...input, sellingPriceNeedsReview: true }).basis, 'ideal');
  assert.equal(marketplaceDealComparison({ ...input, sellingPriceNeedsReview: true, aim4priceValueExVat: null }), null);
});
test('invalid asking prices or absent benchmarks never receive a rating', () => {
  for (const value of [NaN, Infinity, 0, -1]) {
    assert.equal(marketplaceDealComparison({ askingPriceExVat: value, aim4priceValueExVat: 100000 }), null);
  }
  assert.deepEqual(calculateMarketplaceDealRating({ askingPriceExVat: 100000 }), { rating: 'none', percentDiff: null });
});
test('percentage bands are independent of currency magnitude and manual entry', () => {
  for (const scale of [1, 1.15, 1000]) {
    assert.equal(calculateMarketplaceDealRating({ askingPriceExVat: 90000 * scale, aim4priceValueExVat: 100000 * scale, isManualEquipment: true }).rating, 'great');
  }
});

test('visible badges and filter ratings agree; hidden ratings stay unclassified', () => {
  const fs = require('node:fs'), ts = require('typescript');
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const source = fs.readFileSync('app/marketplace/marketplace-client.tsx', 'utf8');
  const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['getListingDealRating', 'getDealRatingToneClass', 'DealRatingBadge']);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.has(n.name?.text)).map(n => n.getText(ast)).join('\n');
  const code = ts.transpileModule(functions, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const styles = new Proxy({}, { get: (_, key) => key });
  const ui = new Function('React', 'styles', 'marketplaceDealComparison', 'calculateMarketplaceDealRating', 'isManualMarketplaceListing', `${code}; return { DealRatingBadge, getListingDealRating };`)(React, styles, marketplaceDealComparison, calculateMarketplaceDealRating, () => false);
  const render = listing => renderToStaticMarkup(React.createElement(ui.DealRatingBadge, { listing }));
  for (const [price, rating, label, tone] of [[70000, 'low', 'Low price', 'Low'], [90000, 'great', 'Good value', 'Great'], [100000, 'fair', 'Fair value', 'Fair'], [110000, 'high', 'Above estimate', 'High']]) {
    const listing = { askingPriceExVat: price, aim4priceValueExVat: 100000, dealRating: 'none' };
    const html = render(listing);
    assert.equal(ui.getListingDealRating(listing), rating);
    assert.match(html, new RegExp(`ratingFilterPill dealRatingBadge${tone}`));
    assert.match(html, new RegExp(label));
    assert.match(html, /ideal selling price/);
    assert.equal(render({ ...listing, showDealRating: false }), '');
    assert.equal(ui.getListingDealRating({ ...listing, showDealRating: false }), 'none');
  }
  assert.match(render({ askingPriceExVat: 100000 }), /No rating/);
});
