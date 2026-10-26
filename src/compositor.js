export const FRAME_SPECS = Object.freeze({
  canvasSize: 1024,
  centerX: 512,
  centerY: 474,
  holeRadiusX: 342,
  holeRadiusY: 342,
  clipRadius: 348,
  minZoom: 0.25,
  maxZoom: 4,
});

export function computeInitialPlacement(imageWidth, imageHeight, specs = FRAME_SPECS) {
  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
    throw new RangeError('Image dimensions must be positive numbers');
  }
  const targetDiameter = Math.max(specs.holeRadiusX, specs.holeRadiusY) * 2;
  const baseScale = Math.max(targetDiameter / imageWidth, targetDiameter / imageHeight);
  return {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    baseScale,
  };
}

export function clampPlacement(state, imageWidth, imageHeight, specs = FRAME_SPECS) {
  const zoom = Math.min(specs.maxZoom, Math.max(specs.minZoom, Number(state.zoom) || 1));
  const rotationDeg = (((Number(state.rotationDeg) || 0) % 360) + 360) % 360;
  const isQuarterTurn = rotationDeg === 90 || rotationDeg === 270;

  const scale = state.baseScale * zoom;
  const renderedWidth = (isQuarterTurn ? imageHeight : imageWidth) * scale;
  const renderedHeight = (isQuarterTurn ? imageWidth : imageHeight) * scale;

  // Allow free positioning anywhere within the circular opening while keeping at least a portion visible
  const maxOffsetX = specs.holeRadiusX * 0.75 + renderedWidth / 2;
  const maxOffsetY = specs.holeRadiusY * 0.75 + renderedHeight / 2;

  const offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, Number(state.offsetX) || 0));
  const offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, Number(state.offsetY) || 0));

  return {
    ...state,
    zoom,
    rotationDeg,
    offsetX,
    offsetY,
  };
}

export function zoomAroundPoint(
  state,
  targetZoom,
  focalX,
  focalY,
  imageWidth,
  imageHeight,
  specs = FRAME_SPECS
) {
  const prevZoom = state.zoom || 1;
  const nextZoom = Math.min(specs.maxZoom, Math.max(specs.minZoom, Number(targetZoom) || 1));
  const ratio = nextZoom / prevZoom;

  // Vector from current image center (centerX + offsetX, centerY + offsetY) to focal point
  const dx = focalX - (specs.centerX + state.offsetX);
  const dy = focalY - (specs.centerY + state.offsetY);

  const nextOffsetX = state.offsetX - dx * (ratio - 1);
  const nextOffsetY = state.offsetY - dy * (ratio - 1);

  return clampPlacement(
    {
      ...state,
      zoom: nextZoom,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    },
    imageWidth,
    imageHeight,
    specs
  );
}

export function renderAvatarComposite(ctx, { frameImage, userImage, placement, specs = FRAME_SPECS }) {
  const { canvasSize, centerX, centerY, clipRadius } = specs;
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  if (userImage && placement) {
    const scale = placement.baseScale * placement.zoom;
    const rawWidth = userImage.naturalWidth || userImage.width;
    const rawHeight = userImage.naturalHeight || userImage.height;
    const drawWidth = rawWidth * scale;
    const drawHeight = rawHeight * scale;
    const radians = ((placement.rotationDeg || 0) * Math.PI) / 180;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, clipRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.translate(centerX + placement.offsetX, centerY + placement.offsetY);
    if (radians !== 0) {
      ctx.rotate(radians);
    }
    ctx.drawImage(userImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  if (frameImage) {
    ctx.drawImage(frameImage, 0, 0, canvasSize, canvasSize);
  }
}

export function detectDefaultViewMode(viewportWidth, mobileBreakpoint = 768) {
  return Number(viewportWidth) <= mobileBreakpoint ? 'mobile' : 'desktop';
}

export function computePinchZoom(initialZoom, initialDistance, currentDistance, specs = FRAME_SPECS) {
  if (!initialDistance || initialDistance <= 0 || !currentDistance || currentDistance <= 0) {
    return Math.min(specs.maxZoom, Math.max(specs.minZoom, Number(initialZoom) || 1));
  }
  const rawZoom = (Number(initialZoom) || 1) * (currentDistance / initialDistance);
  return Math.min(specs.maxZoom, Math.max(specs.minZoom, rawZoom));
}

export function isInAppWebView(userAgent = '') {
  return /Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|BytedanceWebview|TikTok|Line\//i.test(
    String(userAgent)
  );
}

export function shouldUseModalImageSave(userAgent = '', viewMode = 'desktop') {
  if (isInAppWebView(userAgent)) return true;
  if (viewMode === 'mobile') return true;
  return /Android|iPhone|iPad|iPod/i.test(String(userAgent));
}

