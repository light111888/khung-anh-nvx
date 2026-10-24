import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_SPECS,
  computeInitialPlacement,
  clampPlacement,
  renderAvatarComposite,
} from '../src/compositor.js';

test('computeInitialPlacement scales portrait and landscape photos to cover the circular cutout', () => {
  const portrait = computeInitialPlacement(500, 1000);
  assert.equal(portrait.zoom, 1);
  assert.equal(portrait.offsetX, 0);
  assert.equal(portrait.offsetY, 0);
  assert.equal(portrait.rotationDeg, 0);
  // Must tuck at least 2px under the solid blue ring (radius >= 298 -> diameter >= 596)
  assert.equal(FRAME_SPECS.holeRadiusX, 298);
  assert.equal(FRAME_SPECS.holeRadiusY, 289);
  assert.ok(500 * portrait.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.ok(1000 * portrait.baseScale >= FRAME_SPECS.holeRadiusY * 2);
  assert.equal(Math.round(500 * portrait.baseScale), FRAME_SPECS.holeRadiusX * 2);

  const landscape = computeInitialPlacement(1200, 600);
  assert.ok(1200 * landscape.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.ok(600 * landscape.baseScale >= FRAME_SPECS.holeRadiusX * 2);
  assert.equal(Math.round(600 * landscape.baseScale), FRAME_SPECS.holeRadiusX * 2);
});

test('clampPlacement constrains zoom and pan offsets within circular cutout bounds including 90-degree rotation', () => {
  const initial = computeInitialPlacement(596, 1192);
  const clamped = clampPlacement(
    { ...initial, zoom: 0.4, offsetX: 250, offsetY: -999 },
    596,
    1192
  );
  assert.equal(clamped.zoom, 1);
  assert.equal(clamped.offsetX, 0);
  assert.equal(clamped.offsetY, -307);

  const rotated = clampPlacement(
    { ...initial, rotationDeg: 90, offsetX: 500, offsetY: 100 },
    596,
    1192
  );
  assert.equal(rotated.offsetX, 298);
  assert.equal(rotated.offsetY, 9);
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

  // Verify user photo is clipped to circular hole first, then frame is drawn on top
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



