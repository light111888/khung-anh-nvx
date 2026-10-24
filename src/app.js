import {
  FRAME_SPECS,
  computeInitialPlacement,
  clampPlacement,
  zoomAroundPoint,
  renderAvatarComposite,
  detectDefaultViewMode,
  computePinchZoom,
} from './compositor.js';

const appShell = document.getElementById('appShell');
const modeDesktopBtn = document.getElementById('modeDesktopBtn');
const modeMobileBtn = document.getElementById('modeMobileBtn');
const canvas = document.getElementById('avatarCanvas');
const ctx = canvas.getContext('2d');
const canvasDropzone = document.getElementById('canvasDropzone');
const circleUploadPrompt = document.getElementById('circleUploadPrompt');
const dragOverlayBadge = document.getElementById('dragOverlayBadge');
const dragOverlayText = document.getElementById('dragOverlayText');
const gestureHint = document.getElementById('gestureHint');
const photoInput = document.getElementById('photoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadBtnLabel = document.getElementById('uploadBtnLabel');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnLabel = document.getElementById('downloadBtnLabel');
const adjustControls = document.getElementById('adjustControls');
const zoomRange = document.getElementById('zoomRange');
const zoomValue = document.getElementById('zoomValue');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const moveLeftBtn = document.getElementById('moveLeftBtn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');
const moveRightBtn = document.getElementById('moveRightBtn');
const rotateBtn = document.getElementById('rotateBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

let frameImage = null;
let userImage = null;
let placement = null;
let currentViewMode = detectDefaultViewMode(window.innerWidth);
const activePointers = new Map();
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pinchLastMidpoint = null;
let holdIntervalId = null;

function getTouchDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function getMidpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function clientToCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = FRAME_SPECS.canvasSize / (rect.width || FRAME_SPECS.canvasSize);
  const scaleY = FRAME_SPECS.canvasSize / (rect.height || FRAME_SPECS.canvasSize);
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
    scale: scaleX,
  };
}

function setStatus(text, type = 'info') {
  statusMessage.textContent = text;
  statusMessage.classList.remove('is-error', 'is-success');
  if (type === 'error') statusMessage.classList.add('is-error');
  if (type === 'success') statusMessage.classList.add('is-success');
}

function redraw() {
  renderAvatarComposite(ctx, {
    frameImage,
    userImage,
    placement,
    specs: FRAME_SPECS,
  });
}

function syncUI() {
  const hasPhoto = Boolean(userImage && placement);
  const isMobile = currentViewMode === 'mobile';

  appShell.dataset.viewMode = currentViewMode;
  modeDesktopBtn.setAttribute('aria-pressed', String(!isMobile));
  modeMobileBtn.setAttribute('aria-pressed', String(isMobile));

  circleUploadPrompt.hidden = hasPhoto;
  dragOverlayBadge.hidden = !hasPhoto;
  gestureHint.hidden = !hasPhoto;

  dragOverlayText.textContent = isMobile
    ? 'Chạm & kéo để đặt vị trí ảnh'
    : 'Giữ chuột kéo để đặt vị trí ảnh';

  gestureHint.textContent = isMobile
    ? 'Mẹo: 1 ngón tay kéo di chuyển ảnh • 2 ngón tay chụm/mở để phóng to thu nhỏ.'
    : 'Mẹo: Giữ chuột trái kéo ảnh để chọn vị trí • Lăn chuột để phóng to / thu nhỏ.';

  canvasDropzone.classList.toggle('has-photo', hasPhoto);
  downloadBtn.disabled = !hasPhoto;
  adjustControls.disabled = !hasPhoto;

  if (isMobile) {
    uploadBtnLabel.textContent = hasPhoto ? 'Đổi ảnh khác' : 'Chọn ảnh';
    downloadBtnLabel.textContent = 'Tải ảnh HD';
  } else {
    uploadBtnLabel.textContent = hasPhoto ? 'Đổi bức ảnh khác' : 'Chọn ảnh từ thiết bị';
    downloadBtnLabel.textContent = 'Tải ảnh đã ghép (HD)';
  }

  if (hasPhoto) {
    zoomRange.value = String(placement.zoom);
    zoomValue.textContent = `${Math.round(placement.zoom * 100)}%`;
  } else {
    zoomRange.value = '1';
    zoomValue.textContent = '100%';
  }
  redraw();
}

function setViewMode(mode) {
  currentViewMode = mode === 'mobile' ? 'mobile' : 'desktop';
  syncUI();
}

modeDesktopBtn.addEventListener('click', () => setViewMode('desktop'));
modeMobileBtn.addEventListener('click', () => setViewMode('mobile'));

function nudgeOffset(dx, dy) {
  if (!userImage || !placement) return;
  placement = clampPlacement(
    {
      ...placement,
      offsetX: placement.offsetX + dx,
      offsetY: placement.offsetY + dy,
    },
    userImage.naturalWidth,
    userImage.naturalHeight,
    FRAME_SPECS
  );
  syncUI();
}

function stepZoom(delta) {
  if (!userImage || !placement) return;
  placement = zoomAroundPoint(
    placement,
    placement.zoom + delta,
    FRAME_SPECS.centerX,
    FRAME_SPECS.centerY,
    userImage.naturalWidth,
    userImage.naturalHeight,
    FRAME_SPECS
  );
  syncUI();
}

function bindHoldAction(button, actionFn) {
  const stopHold = () => {
    if (holdIntervalId !== null) {
      clearInterval(holdIntervalId);
      holdIntervalId = null;
    }
  };

  button.addEventListener('pointerdown', (e) => {
    if (button.disabled) return;
    e.preventDefault();
    actionFn();
    stopHold();
    holdIntervalId = setInterval(actionFn, 75);
  });

  button.addEventListener('pointerup', stopHold);
  button.addEventListener('pointerleave', stopHold);
  button.addEventListener('pointercancel', stopHold);
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      actionFn();
    }
  });
}

bindHoldAction(zoomOutBtn, () => stepZoom(-0.08));
bindHoldAction(zoomInBtn, () => stepZoom(0.08));
bindHoldAction(moveLeftBtn, () => nudgeOffset(-14, 0));
bindHoldAction(moveRightBtn, () => nudgeOffset(14, 0));
bindHoldAction(moveUpBtn, () => nudgeOffset(0, -14));
bindHoldAction(moveDownBtn, () => nudgeOffset(0, 14));

function loadUserFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('File vừa chọn không phải là định dạng hình ảnh hợp lệ.', 'error');
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    userImage = img;
    placement = computeInitialPlacement(img.naturalWidth, img.naturalHeight, FRAME_SPECS);
    syncUI();
    setStatus('Đã ghép ảnh! Hãy kéo ảnh trên khung hoặc dùng nút +/- để chỉnh vừa khít vòng tròn.', 'success');
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    setStatus('Không thể đọc được file ảnh này. Vui lòng thử một bức ảnh khác.', 'error');
  };
  img.src = objectUrl;
}

function initFrame() {
  syncUI();
  const img = new Image();
  img.onload = () => {
    frameImage = img;
    redraw();
  };
  img.onerror = () => {
    setStatus('Không thể tải khung ảnh mẫu. Vui lòng tải lại trang.', 'error');
  };
  img.src = './assets/frame.png';
}

uploadBtn.addEventListener('click', () => photoInput.click());
circleUploadPrompt.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    loadUserFile(file);
    photoInput.value = '';
  }
});

canvasDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasDropzone.classList.add('is-dragover');
});

canvasDropzone.addEventListener('dragleave', () => {
  canvasDropzone.classList.remove('is-dragover');
});

canvasDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasDropzone.classList.remove('is-dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) loadUserFile(file);
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      loadUserFile(item.getAsFile());
      break;
    }
  }
});

canvasDropzone.addEventListener('pointerdown', (e) => {
  if (!userImage || !placement) return;
  if (e.target === circleUploadPrompt || circleUploadPrompt.contains(e.target)) return;

  e.preventDefault();
  canvasDropzone.focus();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvasDropzone.classList.add('is-dragging');

  try {
    canvasDropzone.setPointerCapture(e.pointerId);
  } catch {
    // Ignore if synthetic pointer event
  }

  if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    pinchStartDistance = getTouchDistance(pts[0], pts[1]);
    pinchStartZoom = placement.zoom;
    pinchLastMidpoint = getMidpoint(pts[0], pts[1]);
  }
});

canvasDropzone.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId) || !userImage || !placement) return;
  e.preventDefault();

  const prev = activePointers.get(e.pointerId);
  const curr = { x: e.clientX, y: e.clientY };
  activePointers.set(e.pointerId, curr);

  if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    const dist = getTouchDistance(pts[0], pts[1]);
    const midpoint = getMidpoint(pts[0], pts[1]);
    const canvasFocal = clientToCanvasCoords(midpoint.x, midpoint.y);
    const nextZoom = computePinchZoom(pinchStartZoom, pinchStartDistance, dist, FRAME_SPECS);

    let nextPlacement = zoomAroundPoint(
      placement,
      nextZoom,
      canvasFocal.x,
      canvasFocal.y,
      userImage.naturalWidth,
      userImage.naturalHeight,
      FRAME_SPECS
    );

    if (pinchLastMidpoint) {
      const dx = (midpoint.x - pinchLastMidpoint.x) * canvasFocal.scale;
      const dy = (midpoint.y - pinchLastMidpoint.y) * canvasFocal.scale;
      nextPlacement = clampPlacement(
        {
          ...nextPlacement,
          offsetX: nextPlacement.offsetX + dx,
          offsetY: nextPlacement.offsetY + dy,
        },
        userImage.naturalWidth,
        userImage.naturalHeight,
        FRAME_SPECS
      );
    }

    pinchLastMidpoint = midpoint;
    placement = nextPlacement;
    syncUI();
    return;
  }

  if (activePointers.size === 1) {
    const { scale } = clientToCanvasCoords(curr.x, curr.y);
    const dx = (curr.x - prev.x) * scale;
    const dy = (curr.y - prev.y) * scale;

    placement = clampPlacement(
      {
        ...placement,
        offsetX: placement.offsetX + dx,
        offsetY: placement.offsetY + dy,
      },
      userImage.naturalWidth,
      userImage.naturalHeight,
      FRAME_SPECS
    );
    redraw();
  }
});

function endPointerDrag(e) {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) {
    pinchStartDistance = 0;
    pinchLastMidpoint = null;
  }
  if (activePointers.size === 0) {
    canvasDropzone.classList.remove('is-dragging');
  }
}

canvasDropzone.addEventListener('pointerup', endPointerDrag);
canvasDropzone.addEventListener('pointercancel', endPointerDrag);

canvasDropzone.addEventListener(
  'wheel',
  (e) => {
    if (!userImage || !placement) return;
    e.preventDefault();
    const focal = clientToCanvasCoords(e.clientX, e.clientY);
    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
    placement = zoomAroundPoint(
      placement,
      placement.zoom + zoomDelta,
      focal.x,
      focal.y,
      userImage.naturalWidth,
      userImage.naturalHeight,
      FRAME_SPECS
    );
    syncUI();
  },
  { passive: false }
);

canvasDropzone.addEventListener('keydown', (e) => {
  if (!userImage || !placement) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      photoInput.click();
    }
    return;
  }

  const step = 14;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    nudgeOffset(-step, 0);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nudgeOffset(step, 0);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    nudgeOffset(0, -step);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    nudgeOffset(0, step);
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    stepZoom(0.1);
  } else if (e.key === '-') {
    e.preventDefault();
    stepZoom(-0.1);
  }
});

zoomRange.addEventListener('input', () => {
  if (!userImage || !placement) return;
  placement = zoomAroundPoint(
    placement,
    Number(zoomRange.value),
    FRAME_SPECS.centerX,
    FRAME_SPECS.centerY,
    userImage.naturalWidth,
    userImage.naturalHeight,
    FRAME_SPECS
  );
  syncUI();
});

rotateBtn.addEventListener('click', () => {
  if (!userImage || !placement) return;
  placement = clampPlacement(
    { ...placement, rotationDeg: (placement.rotationDeg + 90) % 360 },
    userImage.naturalWidth,
    userImage.naturalHeight,
    FRAME_SPECS
  );
  syncUI();
});

resetBtn.addEventListener('click', () => {
  if (!userImage) return;
  placement = computeInitialPlacement(userImage.naturalWidth, userImage.naturalHeight, FRAME_SPECS);
  syncUI();
  setStatus('Đã đưa ảnh về vị trí căn giữa vừa khung tròn.', 'info');
});

downloadBtn.addEventListener('click', () => {
  if (!userImage || !placement) return;
  redraw();
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Không thể xuất file ảnh. Vui lòng thử lại.', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'khung-anh-55-nam-thpt-nguyen-viet-xuan.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Đã tải ảnh kỷ niệm 55 năm THPT Nguyễn Viết Xuân về máy!', 'success');
  }, 'image/png');
});

initFrame();
