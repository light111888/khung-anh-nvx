import {
  FRAME_SPECS,
  computeInitialPlacement,
  clampPlacement,
  renderAvatarComposite,
} from './compositor.js';

const canvas = document.getElementById('avatarCanvas');
const ctx = canvas.getContext('2d');
const canvasDropzone = document.getElementById('canvasDropzone');
const circleUploadPrompt = document.getElementById('circleUploadPrompt');
const gestureHint = document.getElementById('gestureHint');
const photoInput = document.getElementById('photoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadBtnLabel = document.getElementById('uploadBtnLabel');
const downloadBtn = document.getElementById('downloadBtn');
const adjustControls = document.getElementById('adjustControls');
const zoomRange = document.getElementById('zoomRange');
const zoomValue = document.getElementById('zoomValue');
const rotateBtn = document.getElementById('rotateBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

let frameImage = null;
let userImage = null;
let placement = null;
let activePointerId = null;
let lastPointerPos = { x: 0, y: 0 };

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
  circleUploadPrompt.hidden = hasPhoto;
  gestureHint.hidden = !hasPhoto;
  canvasDropzone.classList.toggle('has-photo', hasPhoto);
  downloadBtn.disabled = !hasPhoto;
  adjustControls.disabled = !hasPhoto;
  uploadBtnLabel.textContent = hasPhoto ? 'Đổi bức ảnh khác' : 'Chọn ảnh từ thiết bị';

  if (hasPhoto) {
    zoomRange.value = String(placement.zoom);
    zoomValue.textContent = `${Math.round(placement.zoom * 100)}%`;
  } else {
    zoomRange.value = '1';
    zoomValue.textContent = '100%';
  }
  redraw();
}

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
    setStatus('Đã ghép ảnh vào khung tròn! Bạn có thể kéo ảnh để căn chỉnh hoặc tải về ngay.', 'success');
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    setStatus('Không thể đọc được file ảnh này. Vui lòng thử một bức ảnh khác.', 'error');
  };
  img.src = objectUrl;
}

function initFrame() {
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
  activePointerId = e.pointerId;
  lastPointerPos = { x: e.clientX, y: e.clientY };
  canvasDropzone.setPointerCapture(e.pointerId);
});

canvasDropzone.addEventListener('pointermove', (e) => {
  if (activePointerId !== e.pointerId || !userImage || !placement) return;
  const rect = canvas.getBoundingClientRect();
  const scaleToCanvas = FRAME_SPECS.canvasSize / (rect.width || FRAME_SPECS.canvasSize);
  const dx = (e.clientX - lastPointerPos.x) * scaleToCanvas;
  const dy = (e.clientY - lastPointerPos.y) * scaleToCanvas;
  lastPointerPos = { x: e.clientX, y: e.clientY };

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
});

function endPointerDrag(e) {
  if (activePointerId === e.pointerId) {
    activePointerId = null;
  }
}

canvasDropzone.addEventListener('pointerup', endPointerDrag);
canvasDropzone.addEventListener('pointercancel', endPointerDrag);

canvasDropzone.addEventListener(
  'wheel',
  (e) => {
    if (!userImage || !placement) return;
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    placement = clampPlacement(
      { ...placement, zoom: placement.zoom + zoomDelta },
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

  const step = 12;
  let nextState = null;
  if (e.key === 'ArrowLeft') nextState = { ...placement, offsetX: placement.offsetX - step };
  if (e.key === 'ArrowRight') nextState = { ...placement, offsetX: placement.offsetX + step };
  if (e.key === 'ArrowUp') nextState = { ...placement, offsetY: placement.offsetY - step };
  if (e.key === 'ArrowDown') nextState = { ...placement, offsetY: placement.offsetY + step };
  if (e.key === '+' || e.key === '=') nextState = { ...placement, zoom: placement.zoom + 0.1 };
  if (e.key === '-') nextState = { ...placement, zoom: placement.zoom - 0.1 };

  if (nextState) {
    e.preventDefault();
    placement = clampPlacement(
      nextState,
      userImage.naturalWidth,
      userImage.naturalHeight,
      FRAME_SPECS
    );
    syncUI();
  }
});

zoomRange.addEventListener('input', () => {
  if (!userImage || !placement) return;
  placement = clampPlacement(
    { ...placement, zoom: Number(zoomRange.value) },
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
  setStatus('Đã đưa ảnh về vị trí căn giữa mặc định.', 'info');
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
