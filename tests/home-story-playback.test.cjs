const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Run the real component's hooks and event handlers with a deterministic clock.
// Geometry stays at canonical canvas dimensions; no browser or database is required.
function mountHero({ reducedMotion = false } = {}) {
  let cursor = 0, dirty = true, tree, now = 0, nextId = 0;
  const hooks = [], effects = [], timers = new Map(), listeners = new Map();
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); };
  const emit = name => { for (const fn of listeners.get(name) || []) fn(); };
  const schedule = (fn, delay, repeat = false) => { const id = ++nextId; timers.set(id, { fn, at: now + delay, delay, repeat }); return id; };
  const win = {
    scrollY: 0,
    getComputedStyle: () => ({ top: '0' }),
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }),
    addEventListener: add, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    requestAnimationFrame: fn => schedule(fn, 16), cancelAnimationFrame: id => timers.delete(id),
    scrollTo: ({ top }) => { win.scrollY = top; schedule(() => emit('scroll'), 1); },
  };
  const doc = { hidden: false, documentElement: {}, addEventListener: add, removeEventListener: win.removeEventListener };
  const nodes = {
    heroSection: { getBoundingClientRect: () => ({ top: -win.scrollY, height: 4400 }) },
    heroSticky: { getBoundingClientRect: () => ({ height: 1000 }) },
  };
  const nodeFor = classes => {
    const key = classes.split(' ').find(k => nodes[k]) || classes;
    return nodes[key] ||= { offsetLeft: 600, style: { setProperty() {} } };
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = {
    useState(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], next => { next = typeof next === 'function' ? next(hooks[i]) : next; if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true; } }]; },
    useRef(value) { const i = cursor++; return hooks[i] ||= { current: value }; },
    useCallback(fn, deps) { const i = cursor++; if (changed(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (changed(hooks[i]?.deps, deps)) effects.push({ i, fn, deps }); },
  };
  const walk = (node, fn) => { if (Array.isArray(node)) return node.forEach(n => walk(n, fn)); if (!node || typeof node !== 'object') return; fn(node); walk(node.props?.children, fn); };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/home-hero-experience.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '../lib/website-canvas': { currentWebsiteScale: () => 1 },
    '../lib/home-story-swipe': { attachHomeStorySwipe: () => () => {} },
    './home-asset-preview': { __esModule: true, default: 'Preview' },
    './page.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
    'next/image': { __esModule: true, default: 'Image' }, 'next/link': { __esModule: true, default: 'Link' },
  };
  new Function('require', 'exports', 'window', 'document', 'performance', 'getComputedStyle', code)(
    name => { assert.ok(name in mocks, name); return mocks[name]; }, exports, win, doc,
    { now: () => now }, () => ({ top: '0', fontSize: '16', getPropertyValue: () => '7.75' }),
  );
  function flush() {
    let guard = 0;
    while (dirty) {
      assert.ok(++guard < 30, 'render settles'); dirty = false; cursor = 0;
      tree = exports.default();
      walk(tree, node => { if (node.props.ref) node.props.ref.current = nodeFor(node.props.className); });
      const pending = effects.splice(0);
      pending.forEach(({ i }) => hooks[i]?.cleanup?.());
      pending.forEach(({ i, fn, deps }) => { hooks[i] = { deps, cleanup: fn() }; });
    }
  }
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; now = timer.at;
      if (timer.repeat) timer.at += timer.delay; else timers.delete(id);
      timer.fn(); flush();
    }
    now = end; flush();
  }
  const find = predicate => { let result; walk(tree, node => { if (predicate(node)) result = node; }); return result; };
  const click = label => { const button = find(n => n.props['aria-label'] === label || n.props.children === label); assert.ok(button, label); button.props.onClick(); flush(); };
  flush();
  return {
    advance, click, find,
    step: () => tree.props['data-story-step'], playing: () => tree.props['data-autoplay'],
    select(index) { find(n => n.type === 'Preview').props.onQuestionChange(exports.HERO_STAGES[index], index); flush(); },
    scroll(top) { win.scrollY = top; emit('scroll'); advance(20); },
    pendingScroll(top) { win.scrollY = top; emit('scroll'); },
    setHidden(hidden) { doc.hidden = hidden; emit('visibilitychange'); flush(); },
  };
}

test('every manually selected feature resumes in place despite queued scroll synchronization', () => {
  for (let index = 0; index < 5; index++) {
    const h = mountHero(); h.scroll(1900); h.select(index); h.advance(20);
    const selected = h.step();
    h.pendingScroll(1200); // Focus/scroll frame queued before Play.
    h.click('Play card animation'); h.advance(20);
    assert.equal(h.step(), selected); assert.equal(h.playing(), 'true');
    h.advance(2000); assert.equal(h.step(), selected);
  }
});

test('pause and page visibility preserve the remaining reading time', () => {
  const h = mountHero(); h.select(2); h.advance(20); h.click('Play card animation'); h.advance(3000);
  h.click('Pause card animation'); h.advance(20000); assert.equal(h.step(), 'manage');
  h.click('Play card animation'); h.advance(4000); assert.equal(h.step(), 'manage');
  h.setHidden(true); h.advance(20000); assert.equal(h.step(), 'manage');
  h.setHidden(false); h.advance(3100); assert.equal(h.step(), 'cost');
});

test('tour ends on Maintenance with signup and replay; replay starts a fresh tour', () => {
  const h = mountHero(); h.advance(63601);
  assert.equal(h.step(), 'attention'); assert.equal(h.playing(), 'false');
  assert.ok(h.find(n => n.props.className === 'featureEndActions'));
  assert.equal(h.find(n => n.props['data-feature-countdown'] !== undefined), undefined);
  h.advance(30000); assert.equal(h.step(), 'attention');
  h.click('Replay tour'); h.advance(20); assert.equal(h.step(), 'promise');
  h.advance(4900); assert.equal(h.step(), 'preview');
});

test('native scrolling still takes control after Play and reduced motion never autoplays', () => {
  const h = mountHero(); h.select(2); h.advance(20); h.click('Play card animation'); h.advance(20);
  h.scroll(2800); assert.equal(h.step(), 'cost'); assert.equal(h.playing(), 'false');
  h.scroll(1300); assert.equal(h.step(), 'worth');
  const reduced = mountHero({ reducedMotion: true }); reduced.select(4); reduced.advance(90000);
  assert.equal(reduced.step(), 'attention'); assert.equal(reduced.playing(), 'false');
  assert.ok(reduced.find(n => n.props.className === 'featureEndActions'));
});
