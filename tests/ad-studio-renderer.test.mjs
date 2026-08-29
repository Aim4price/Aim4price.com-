import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const TEMPLATE_OPTIONS = [
  { id: 'showcase', photoCount: 4 },
  { id: 'price-focus', photoCount: 1 },
  { id: 'photo-first', photoCount: 1 },
  { id: 'classic', photoCount: 1 },
  { id: 'minimal', photoCount: 1 },
  { id: 'duo-split', photoCount: 2 },
  { id: 'gallery-three', photoCount: 3 },
  { id: 'catalogue-grid', photoCount: 4 },
];

const DEFAULT_COLORS = {
  primary: '#165340',
  secondary: '#0d3329',
  accent: '#f2b84b',
};

async function loadRenderer() {
  const source = await read('lib/marketplace-ad-renderer.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const dependencies = {
    './ad-studio': {
      AD_TEMPLATE_OPTIONS: TEMPLATE_OPTIONS,
      DEFAULT_AD_BRAND_COLORS: DEFAULT_COLORS,
    },
    './marketplace': {
      calculateMarketplaceDealRating: () => ({ rating: 'fair' }),
    },
  };
  const requireDependency = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  new Function('exports', 'module', 'require', output)(module.exports, module, requireDependency);
  return module.exports;
}

function fontSize(font) {
  return Number.parseFloat(String(font).match(/([\d.]+)px/)?.[1] ?? '0');
}

function fontWeight(font) {
  return Number.parseInt(String(font).match(/^\s*(\d+)/)?.[1] ?? '400', 10);
}

function measuredWidth(value, font) {
  const size = fontSize(font) || 16;
  return String(value).length * size * .52;
}

function destinationRect(args) {
  if (args.length === 4) {
    return { x: args[0], y: args[1], width: args[2], height: args[3] };
  }
  if (args.length === 8) {
    return { x: args[4], y: args[5], width: args[6], height: args[7] };
  }
  throw new Error(`Unexpected drawImage argument count: ${args.length}`);
}

function createTraceCanvas() {
  const calls = {
    drawImage: [],
    fillText: [],
    fillRect: [],
    roundRect: [],
  };
  const stateKeys = [
    'font',
    'fillStyle',
    'strokeStyle',
    'textAlign',
    'textBaseline',
    'globalAlpha',
    'lineWidth',
    'shadowColor',
    'shadowBlur',
    'shadowOffsetX',
    'shadowOffsetY',
    'lineCap',
    'lineJoin',
  ];
  const context = {
    font: '400 16px Montserrat, Arial, sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineWidth: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  };
  const stateStack = [];
  context.save = () => {
    stateStack.push(Object.fromEntries(stateKeys.map((key) => [key, context[key]])));
  };
  context.restore = () => {
    const saved = stateStack.pop();
    if (saved) Object.assign(context, saved);
  };
  context.clearRect = () => {};
  context.beginPath = () => {};
  context.closePath = () => {};
  context.clip = () => {};
  context.fill = () => {};
  context.stroke = () => {};
  context.moveTo = () => {};
  context.lineTo = () => {};
  context.arc = () => {};
  context.fillRect = (x, y, width, height) => calls.fillRect.push({ x, y, width, height, fillStyle: context.fillStyle });
  context.roundRect = (x, y, width, height, radius) => calls.roundRect.push({ x, y, width, height, radius });
  context.createLinearGradient = () => ({ addColorStop() {} });
  context.measureText = (value) => ({ width: measuredWidth(value, context.font) });
  context.fillText = (value, x, y) => calls.fillText.push({
    value: String(value),
    x,
    y,
    font: context.font,
    fontSize: fontSize(context.font),
    fontWeight: fontWeight(context.font),
    measuredWidth: measuredWidth(value, context.font),
    fillStyle: context.fillStyle,
    textAlign: context.textAlign,
    globalAlpha: context.globalAlpha,
  });
  context.drawImage = (image, ...args) => calls.drawImage.push({
    source: image.src,
    sourceWidth: image.naturalWidth || image.width,
    sourceHeight: image.naturalHeight || image.height,
    ...destinationRect(args),
  });

  return {
    canvas: {
      width: 0,
      height: 0,
      getContext: () => context,
    },
    context,
    calls,
  };
}

function withFakeImages(dimensions, run) {
  const OriginalImage = globalThis.Image;
  class FakeImage {
    decoding = 'async';
    crossOrigin = '';
    naturalWidth = 0;
    naturalHeight = 0;
    width = 0;
    height = 0;
    onload = null;
    onerror = null;
    #source = '';

    set src(value) {
      this.#source = value;
      const size = dimensions[value];
      queueMicrotask(() => {
        if (!size) {
          this.onerror?.(new Error(`No fake image for ${value}`));
          return;
        }
        this.naturalWidth = size.width;
        this.naturalHeight = size.height;
        this.width = size.width;
        this.height = size.height;
        this.onload?.();
      });
    }

    get src() {
      return this.#source;
    }
  }

  globalThis.Image = FakeImage;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (OriginalImage === undefined) delete globalThis.Image;
      else globalThis.Image = OriginalImage;
    });
}

function contentFor(templateId, logoUrl = 'fake://logo-wide') {
  return {
    title: 'Extra Long Agricultural Material Handling Machine With Hydraulic Loading Equipment Package',
    year: 'N/A',
    usage: '12 345 hours',
    condition: 'Very good working condition',
    familyLabel: 'Agricultural material handling equipment',
    askingPriceExVat: 12_345_678,
    aim4priceValueExVat: 12_000_000,
    dealRating: 'fair',
    showDealRating: false,
    sellerName: 'Regional Account Manager With A Long Contact Name',
    sellerPhone: '0821234567',
    sellerCompany: 'The Western Cape Agricultural Equipment And Machinery Trading Company',
    imageUrls: ['fake://photo-1', 'fake://photo-2', 'fake://photo-3', 'fake://photo-4'],
    design: 'saved-brand',
    brand: {
      name: 'Test Brand Kit',
      templateId,
      logoUrl,
      primaryColor: '#165340',
      secondaryColor: '#0d3329',
      accentColor: '#f2b84b',
      businessName: 'The Western Cape Agricultural Equipment And Machinery Trading Company',
      contactName: 'Regional Account Manager With A Long Contact Name',
      phone: '0821234567',
      email: 'sales-team-for-agricultural-machinery@example-equipment.co.za',
      website: 'https://www.example-equipment.co.za/agricultural-machinery',
      language: 'en',
      vatLabel: 'plus-vat',
    },
  };
}

const IMAGE_DIMENSIONS = {
  'fake://logo-wide': { width: 1_200, height: 200 },
  'fake://logo-square': { width: 600, height: 600 },
  'fake://logo-tall': { width: 240, height: 900 },
  'fake://photo-1': { width: 1_600, height: 1_000 },
  'fake://photo-2': { width: 1_200, height: 900 },
  'fake://photo-3': { width: 900, height: 1_200 },
  'fake://photo-4': { width: 1_600, height: 900 },
};

const EXPECTED_PHOTO_RECTS = {
  showcase: [
    { x: 28, y: 28, width: 950, height: 590.8 },
    { x: 28, y: 632.8, width: 307.3333333333, height: 239.2 },
    { x: 349.3333333333, y: 632.8, width: 307.3333333333, height: 239.2 },
    { x: 670.6666666667, y: 632.8, width: 307.3333333333, height: 239.2 },
  ],
  'price-focus': [{ x: 28, y: 28, width: 950, height: 844 }],
  'photo-first': [{ x: 28, y: 28, width: 1544, height: 844 }],
  classic: [{ x: 28, y: 28, width: 950, height: 844 }],
  minimal: [{ x: 680, y: 28, width: 892, height: 844 }],
  'duo-split': [
    { x: 28, y: 28, width: 950, height: 415 },
    { x: 28, y: 457, width: 950, height: 415 },
  ],
  'gallery-three': [
    { x: 28, y: 28, width: 617.5, height: 844 },
    { x: 659.5, y: 28, width: 318.5, height: 415 },
    { x: 659.5, y: 457, width: 318.5, height: 415 },
  ],
  'catalogue-grid': [
    { x: 28, y: 28, width: 468, height: 415 },
    { x: 510, y: 28, width: 468, height: 415 },
    { x: 28, y: 457, width: 468, height: 415 },
    { x: 510, y: 457, width: 468, height: 415 },
  ],
};

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < .001, `${message}: expected ${expected}, received ${actual}`);
}

function assertRect(actual, expected, message) {
  closeTo(actual.x, expected.x, `${message} x`);
  closeTo(actual.y, expected.y, `${message} y`);
  closeTo(actual.width, expected.width, `${message} width`);
  closeTo(actual.height, expected.height, `${message} height`);
}

test('all eight saved-brand templates render their promised photo geometry with resilient long text', async () => {
  const { renderMarketplaceAdCanvas } = await loadRenderer();

  await withFakeImages(IMAGE_DIMENSIONS, async () => {
    for (const option of TEMPLATE_OPTIONS) {
      const trace = createTraceCanvas();
      const renderedTemplate = await renderMarketplaceAdCanvas(trace.canvas, contentFor(option.id), {
        includeImages: true,
        useBestPhotoFit: false,
      });

      assert.equal(renderedTemplate, option.id, `${option.id} should render without template fallback`);
      assert.equal(trace.canvas.width, 1600);
      assert.equal(trace.canvas.height, 900);

      const photoCalls = trace.calls.drawImage.filter((call) => call.source.startsWith('fake://photo-'));
      assert.equal(photoCalls.length, option.photoCount, `${option.id} should draw its declared photo count`);
      photoCalls.forEach((call, index) => {
        assertRect(call, EXPECTED_PHOTO_RECTS[option.id][index], `${option.id} photo ${index + 1}`);
        assert.ok(call.x >= 0 && call.y >= 0 && call.x + call.width <= 1600 && call.y + call.height <= 900);
      });

      const titleCalls = trace.calls.fillText.filter((call) => call.fontWeight === 860);
      assert.ok(titleCalls.length >= 1, `${option.id} should draw the listing title`);
      assert.ok(titleCalls.length <= (option.id === 'photo-first' ? 2 : 3), `${option.id} title should stay in its safe line count`);
      titleCalls.forEach((call) => {
        const maximumWidth = option.id === 'photo-first' ? 862 : option.id === 'minimal' ? 560.72 : 497.08;
        assert.ok(call.measuredWidth <= maximumWidth + .001, `${option.id} title line should fit its safe width`);
        assert.ok(call.y > 0 && call.y < 900, `${option.id} title baseline should remain on canvas`);
      });

      const companyCalls = trace.calls.fillText.filter((call) => call.fontWeight === 850);
      assert.ok(companyCalls.length >= 1, `${option.id} should draw a fitted business name beside its logo`);
      assert.ok(companyCalls.length <= 2, `${option.id} business name should use at most two lines`);
      assert.ok(companyCalls.every((call) => call.fontSize >= 18), `${option.id} business name should remain readable`);

      const contactCalls = trace.calls.fillText.filter((call) =>
        call.value.startsWith('Regional Account')
        || call.value.startsWith('sales-team')
        || call.value.startsWith('www.example-equipment'),
      );
      assert.equal(contactCalls.length, 3, `${option.id} should keep the primary, email and website contact lines`);
      assert.ok(contactCalls.every((call) => call.fontSize >= 15), `${option.id} contact lines should remain legible`);
      assert.ok(contactCalls.every((call) => call.y >= 690 && call.y <= 834), `${option.id} contact lines should remain inside their footer area`);
      const phoneCalls = trace.calls.fillText.filter((call) => call.value === '082 123 4567');
      assert.equal(phoneCalls.length, 1, `${option.id} should keep the complete phone number visible`);
      assert.equal(phoneCalls[0].textAlign, 'right', `${option.id} should protect the phone at the right edge`);

      assert.ok(!trace.calls.fillText.some((call) => ['Low price', 'Great price', 'Fair price', 'High price', 'No rating'].includes(call.value)), `${option.id} should honor hidden ratings`);
      assert.ok(!trace.calls.fillText.some((call) => /^[1-4]$/.test(call.value)), `${option.id} should not draw photo-number badges`);
      assert.ok(trace.calls.fillText.some((call) => call.value === 'Powered by Aim4price.com'), `${option.id} should retain the Aim4price credit`);
    }
  });
});

test('square, wide and tall logos are centered and contained in every dedicated template logo space', async () => {
  const { renderMarketplaceAdCanvas } = await loadRenderer();
  const logoCases = [
    { source: 'fake://logo-wide', ratio: 6 },
    { source: 'fake://logo-square', ratio: 1 },
    { source: 'fake://logo-tall', ratio: 240 / 900 },
  ];

  await withFakeImages(IMAGE_DIMENSIONS, async () => {
    for (const option of TEMPLATE_OPTIONS) {
      const slot = option.id === 'photo-first'
        ? { x: 76, y: 66, width: 224, height: 92 }
        : option.id === 'minimal'
          ? { x: 73.64, y: 50, width: 208, height: 92 }
          : { x: 1034.46, y: 50, width: 190, height: 92 };

      for (const logoCase of logoCases) {
        const trace = createTraceCanvas();
        await renderMarketplaceAdCanvas(trace.canvas, contentFor(option.id, logoCase.source), {
          includeImages: true,
          useBestPhotoFit: false,
        });
        const logoCall = trace.calls.drawImage.find((call) => call.source === logoCase.source);
        assert.ok(logoCall, `${option.id} should draw ${logoCase.source}`);
        closeTo(logoCall.width / logoCall.height, logoCase.ratio, `${option.id} should preserve ${logoCase.source} aspect ratio`);
        assert.ok(logoCall.x >= slot.x + 14 - .001, `${option.id} logo should respect horizontal padding`);
        assert.ok(logoCall.x + logoCall.width <= slot.x + slot.width - 14 + .001, `${option.id} logo should stay within slot width`);
        assert.ok(logoCall.y >= slot.y + 10 - .001, `${option.id} logo should respect vertical padding`);
        assert.ok(logoCall.y + logoCall.height <= slot.y + slot.height - 10 + .001, `${option.id} logo should stay within slot height`);
        closeTo(logoCall.x + logoCall.width / 2, slot.x + slot.width / 2, `${option.id} logo should be horizontally centered`);
        closeTo(logoCall.y + logoCall.height / 2, slot.y + slot.height / 2, `${option.id} logo should be vertically centered`);
      }
    }
  });
});

test('a missing logo falls back to a readable two-line business identity in every template', async () => {
  const { renderMarketplaceAdCanvas } = await loadRenderer();

  await withFakeImages(IMAGE_DIMENSIONS, async () => {
    for (const option of TEMPLATE_OPTIONS) {
      const trace = createTraceCanvas();
      await renderMarketplaceAdCanvas(trace.canvas, contentFor(option.id, ''), {
        includeImages: true,
        useBestPhotoFit: false,
      });
      const companyCalls = trace.calls.fillText.filter((call) => call.fontWeight === 900 && call.y < 190);
      assert.ok(companyCalls.length >= 1, `${option.id} should draw the business-name fallback`);
      assert.ok(companyCalls.length <= 2, `${option.id} business-name fallback should stay within two lines`);
      assert.ok(companyCalls.every((call) => call.fontSize >= 20), `${option.id} business-name fallback should remain readable`);
      assert.ok(!trace.calls.drawImage.some((call) => call.source.includes('logo')), `${option.id} should not reserve a broken image draw`);
    }
  });
});

test('mid-tone custom colours choose the higher-contrast text colour', async () => {
  const { renderMarketplaceAdCanvas } = await loadRenderer();

  await withFakeImages(IMAGE_DIMENSIONS, async () => {
    const trace = createTraceCanvas();
    const content = contentFor('showcase', '');
    content.brand.primaryColor = '#22b24b';
    content.brand.accentColor = '#22b24b';
    await renderMarketplaceAdCanvas(trace.canvas, content, {
      includeImages: true,
      useBestPhotoFit: false,
    });

    const titleCalls = trace.calls.fillText.filter((call) => call.fontWeight === 860);
    const priceCalls = trace.calls.fillText.filter((call) => call.fontWeight === 950);
    assert.ok(titleCalls.length > 0);
    assert.ok(priceCalls.length > 0);
    assert.ok(titleCalls.every((call) => call.fillStyle === '#10251f'));
    assert.ok(priceCalls.every((call) => call.fillStyle === '#10251f'));
  });
});
