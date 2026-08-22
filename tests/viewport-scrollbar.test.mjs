import assert from 'node:assert/strict';
import test from 'node:test';

import { isViewportScrollbarInteraction } from '../lib/viewport-scrollbar.ts';

const scrollablePage = {
  clientWidth: 1280,
  clientHeight: 720,
  scrollWidth: 1280,
  scrollHeight: 1440,
};

test('normal page clicks are not classified as scrollbar interactions', () => {
  assert.equal(
    isViewportScrollbarInteraction({ clientX: 640, clientY: 360 }, scrollablePage),
    false,
  );
});

test('the vertical scrollbar is ignored only when the page can scroll vertically', () => {
  assert.equal(
    isViewportScrollbarInteraction({ clientX: 1280, clientY: 360 }, scrollablePage),
    true,
  );
  assert.equal(
    isViewportScrollbarInteraction(
      { clientX: 1280, clientY: 360 },
      { ...scrollablePage, scrollHeight: scrollablePage.clientHeight },
    ),
    false,
  );
});

test('the horizontal scrollbar is ignored only when the page can scroll horizontally', () => {
  assert.equal(
    isViewportScrollbarInteraction(
      { clientX: 640, clientY: 720 },
      { ...scrollablePage, scrollWidth: 1500 },
    ),
    true,
  );
  assert.equal(
    isViewportScrollbarInteraction({ clientX: 640, clientY: 720 }, scrollablePage),
    false,
  );
});
