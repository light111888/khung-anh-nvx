import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_SPECS,
  computeInitialPlacement,
  clampPlacement,
  zoomAroundPoint,
  renderAvatarComposite,
  detectDefaultViewMode,
  computePinchZoom,
  isInAppWebView,
  shouldUseModalImageSave,
} from '../src/compositor.js';

test('computeInitialPlacement scales portrait and landscape photos to cover the circular cutout', () => {
  const portrait = computeInitialPlacement(500, 1000);
  assert.equal(portrait.zoom, 1);
  assert.equal(portrait.offsetX, 0);
  assert.equal(portrait.offsetY, 0);
  assert.equal(portrait.rotationDeg, 0);
  assert.equal(FRAME_SPECS.centerX, 510);
  assert.equal(FRAME_SPECS.centerY, 454);
  assert.equal(FRAME_SPECS.holeRadiusX, 328);
  assert.equal(FRAME_SPECS.holeRadiusY, 314);
  assert.equal(FRAME_SPECS.clipRadius, 336);
  assert.equal(FRAME_SPECS.minZoom, 0.25);
  assert.equal(FRAME_SPECS.maxZoom, 4);
  assert.ok(500 * portrait.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.ok(1000 * portrait.baseScale >= FRAME_SPECS.holeRadiusY * 2);
  assert.equal(Math.round(500 * portrait.baseScale), FRAME_SPECS.holeRadiusX * 2);

  const landscape = computeInitialPlacement(1200, 600);
  assert.ok(1200 * landscape.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.ok(600 * landscape.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.equal(Math.round(600 * landscape.baseScale), FRAME_SPECS.holeRadiusX * 2);
});

test('clampPlacement allows zooming out below 100% and free X/Y positioning even on square photos', () => {
  const square = computeInitialPlacement(644, 644);
  const moved = clampPlacement(
    { ...square, zoom: 0.5, offsetX: 120, offsetY: -95 },
    644,
    644
  );
  assert.equal(moved.zoom, 0.5);
  assert.equal(moved.offsetX, 120);
  assert.equal(moved.offsetY, -95);

  const extreme = clampPlacement(
    { ...square, zoom: 0.1, offsetX: 5000, offsetY: -5000 },
    644,
    644
  );
  assert.equal(extreme.zoom, FRAME_SPECS.minZoom);
  assert.ok(extreme.offsetX < 1000 && extreme.offsetX > 0);
  assert.ok(extreme.offsetY > -1000 && extreme.offsetY < 0);
});

test('zoomAroundPoint scales zoom and adjusts offset so focal point remains anchored', () => {
  const initial = computeInitialPlacement(656, 656);
  // Focal point at (560, 504) is +50px X, +50px Y from circle center (510, 454)
  const zoomed = zoomAroundPoint(initial, 2, 560, 504, 656, 656);
  assert.equal(zoomed.zoom, 2);
  assert.equal(Math.round(zoomed.offsetX), -50);
  assert.equal(Math.round(zoomed.offsetY), -50);
});

test('renderAvatarComposite clips user photo into circular window underneath the frame overlay', () => {
  const ops = [];
  const mockCtx = {
    clearRect: (...args) => ops.push(['clearRect', ...args]),
    save: () => ops.push(['save']),
    beginPath: () => ops.push(['beginPath']),
    arc: (...args) => ops.push(['arc', ...args]),
    closePath: () => ops.push(['closePath']),
    clip: () => ops.push(['clip']),
    fill: () => ops.push(['fill']),
    translate: (...args) => ops.push(['translate', ...args]),
    rotate: (...args) => ops.push(['rotate', ...args]),
    drawImage: (img, ...args) => ops.push(['drawImage', img.id, ...args]),
    restore: () => ops.push(['restore']),
  };

  const userImg = { id: 'user-photo', width: 590, height: 590 };
  const frameImg = { id: 'frame-overlay', width: 1024, height: 1024 };
  const placement = { baseScale: 1, zoom: 1.5, offsetX: 12, offsetY: -8, rotationDeg: 90 };

  renderAvatarComposite(mockCtx, {
    frameImage: frameImg,
    userImage: userImg,
    placement,
  });

  const arcOp = ops.find((op) => op[0] === 'arc');
  assert.deepEqual(arcOp.slice(1, 4), [FRAME_SPECS.centerX, FRAME_SPECS.centerY, FRAME_SPECS.clipRadius]);

  const drawOps = ops.filter((op) => op[0] === 'drawImage');
  assert.equal(drawOps.length, 2);
  assert.deepEqual(drawOps[0], ['drawImage', 'user-photo', -442.5, -442.5, 885, 885]);
  assert.deepEqual(drawOps[1], ['drawImage', 'frame-overlay', 0, 0, 1024, 1024]);
});

test('renderAvatarComposite prefers naturalWidth and naturalHeight when present on HTMLImageElement', () => {
  const drawCalls = [];
  const mockCtx = {
    clearRect: () => {},
    save: () => {},
    beginPath: () => {},
    arc: () => {},
    closePath: () => {},
    clip: () => {},
    fill: () => {},
    translate: () => {},
    rotate: () => {},
    drawImage: (img, ...args) => drawCalls.push([img.id, ...args]),
    restore: () => {},
  };

  const domImg = { id: 'dom-img', width: 0, height: 0, naturalWidth: 590, naturalHeight: 590 };
  const frameImg = { id: 'frame', width: 1024, height: 1024 };
  renderAvatarComposite(mockCtx, {
    frameImage: frameImg,
    userImage: domImg,
    placement: { baseScale: 1, zoom: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 },
  });

  assert.deepEqual(drawCalls[0], ['dom-img', -295, -295, 590, 590]);
});

test('detectDefaultViewMode selects mobile or desktop mode based on viewport width', () => {
  assert.equal(detectDefaultViewMode(375), 'mobile');
  assert.equal(detectDefaultViewMode(768), 'mobile');
  assert.equal(detectDefaultViewMode(769), 'desktop');
  assert.equal(detectDefaultViewMode(1440), 'desktop');
});

test('computePinchZoom scales zoom proportionally to two-finger touch distance and clamps bounds', () => {
  assert.equal(computePinchZoom(1, 100, 180), 1.8);
  assert.equal(computePinchZoom(2, 100, 250), FRAME_SPECS.maxZoom);
  assert.equal(computePinchZoom(0.4, 200, 100), FRAME_SPECS.minZoom);
  assert.equal(computePinchZoom(1.4, 0, 120), 1.4);
});

test('isInAppWebView and shouldUseModalImageSave detect Zalo and mobile environments to avoid broken blob downloads', () => {
  const zaloIosUA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/240501';
  const fbAndroidUA =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/vi_VN;FBAV/410.0]';
  const desktopChromeUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  assert.equal(isInAppWebView(zaloIosUA), true);
  assert.equal(isInAppWebView(fbAndroidUA), true);
  assert.equal(isInAppWebView(desktopChromeUA), false);

  assert.equal(shouldUseModalImageSave(zaloIosUA, 'desktop'), true);
  assert.equal(shouldUseModalImageSave(desktopChromeUA, 'mobile'), true);
  assert.equal(shouldUseModalImageSave(desktopChromeUA, 'desktop'), false);
});

