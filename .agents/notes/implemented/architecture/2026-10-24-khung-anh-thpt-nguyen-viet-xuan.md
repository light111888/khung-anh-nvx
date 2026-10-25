# Agent Note: Kiến Trúc Trang Web Ghép Khung Ảnh Kỷ Niệm 55 Năm THPT Nguyễn Viết Xuân

Status: implemented

## Problem
Người dùng cung cấp file ảnh khung kỷ niệm 55 năm Trường THPT Nguyễn Viết Xuân - Phú Thọ (1972 - 2027) ở định dạng JPEG (`1024x1024`), trong đó vùng tròn ở giữa có nền caro xám-trắng (baked-in checkerboard) và dải lụa đỏ `"ĐÓN NHẬN HUÂN CHƯƠNG LAO ĐỘNG HẠNG NHẤT"` đè lên cạnh dưới của vòng tròn. Yêu cầu xây dựng một trang web miễn phí, chạy online được, tập trung duy nhất vào một chức năng: người dùng tải ảnh cá nhân lên thì ảnh được ghép vừa vặn vào phần tròn trong khung và tải ảnh kết quả về máy (bao gồm cả khi mở trực tiếp bên trong trình duyệt Zalo trên điện thoại).

## Decision
1. **Xử lý Asset Khung Ảnh (`assets/frame.png`)**:
   - Cập nhật mẫu khung chính thức mới có dòng chữ `"TRƯỜNG THPT NGUYỄN VIẾT XUÂN - PHÚ THỌ"`, cổng trường và dãy nhà học, chim bồ câu xanh, hoa phượng đỏ, hai nhánh nguyệt quế vàng và dải lụa `"ĐÓN NHẬN HUÂN CHƯƠNG LAO ĐỘNG HẠNG NHẤT"`.
   - Tách kênh Alpha chính xác cấp độ sub-pixel từ ảnh gốc `1024x1024` bằng đường cong nội suy biên vòng tròn xanh quanh tâm `(cx = 510.0, cy = 454.0, r_x = 326.0, r_y = 311.0)` kết hợp đa thức bậc 4 của viền trên dải lụa đỏ-vàng, khử nhiễu màu viền (color decontamination) để triệt tiêu hoàn toàn nền caro xám-trắng mà vẫn bảo toàn 100% hiệu ứng ánh sáng (lens flare).
2. **Kiến Trúc Ứng Dụng Web Tĩnh (Client-Side Zero-Backend)**:
   - Tách biệt module tính toán hình học và kết xuất Canvas tại [`src/compositor.js`](file:///C:/Users/light/.gemini/antigravity/scratch/khung-anh-nvx/src/compositor.js) (pure ES module, không phụ thuộc DOM, kiểm thử trực tiếp bằng `node:test`).
   - Luồng kết xuất 2 lớp trên `<canvas width="1024" height="1024">`:
     - **Lớp 1 (Dưới)**: Ảnh người dùng được tự động căn vừa khít (cover) vùng lỗ tròn `(cx = 510, cy = 454, holeRadiusX = 328, holeRadiusY = 314, clipRadius = 336)`, hỗ trợ kéo thả tự do bằng chuột/cảm ứng (pan 360° kể cả ở mức zoom 100% hoặc thu nhỏ), phóng to/thu nhỏ từ `25%` đến `400%` quanh tâm con trỏ/điểm chạm qua [`zoomAroundPoint`](file:///C:/Users/light/.gemini/antigravity/scratch/khung-anh-nvx/src/compositor.js#L52-L83), bộ nút `+/-` và 4 hướng (`Trái`, `Lên`, `Xuống`, `Phải`), cùng xoay 90°.
     - **Lớp 2 (Trên)**: Lớp khung `frame.png` có kênh Alpha trong suốt ở vùng tròn, giúp viền xanh phát sáng và dải lụa nằm đè tự nhiên lên trên ảnh người dùng.
   - **Hai Chế Độ Hiển Thị (`Máy tính` & `Điện thoại`)**:
     - Tự động nhận diện chế độ mặc định qua [`detectDefaultViewMode`](file:///C:/Users/light/.gemini/antigravity/scratch/khung-anh-nvx/src/compositor.js#L119-L121) (`<= 768px` chọn `mobile`, `> 768px` chọn `desktop`) kết hợp thanh chuyển đổi thủ công ở đầu trang.
   - **Cơ Chế Tải Ảnh Tương Thích Trình Duyệt Zalo (`#saveModal`)**:
     - Phát hiện môi trường In-App WebView (Zalo, Messenger, Facebook, Instagram, TikTok) và chế độ Điện thoại qua [`isInAppWebView`](file:///C:/Users/light/.gemini/antigravity/scratch/khung-anh-nvx/src/compositor.js#L131-L135) và [`shouldUseModalImageSave`](file:///C:/Users/light/.gemini/antigravity/scratch/khung-anh-nvx/src/compositor.js#L137-L141).
     - Thay vì kích hoạt `<a href="blob:..." download>` (vốn bị Zalo chặn và báo `"Bạn sẽ thoát Zalo và mở một ứng dụng khác"` rồi lỗi), ứng dụng mở hộp thoại `#saveModal` hiển thị thẻ `<img id="saveModalImg">` chứa `canvas.toDataURL('image/jpeg', 0.95)` để người dùng nhấn giữ 1 giây chọn **"Lưu ảnh"** trực tiếp trong Zalo, đồng thời tích hợp Web Share API (`navigator.share({ files })`) qua nút `#nativeShareBtn`.

## Alternatives Considered
- **Dùng `<a href="blob:..." download>` cho mọi trình duyệt**: Bị loại bỏ trên Zalo/Mobile vì Zalo In-App Browser coi `blob:` là giao thức ngoài, bật hộp thoại thoát Zalo sang trình duyệt hệ thống nhưng trình duyệt ngoài không đọc được vùng nhớ `blob:` của Zalo WebView.
- **Dùng `canvas.toDataURL('image/png')` trong thẻ `<img>` trên Android WebView**: Bị loại bỏ vì chuỗi Base64 PNG `1024x1024` nặng ~2MB có thể vượt giới hạn bộ đệm IPC của Android WebView khi người dùng nhấn giữ lưu ảnh; dùng `image/jpeg` chất lượng `0.95` (~220KB) cho chất lượng sắc nét tương đương (do ảnh xuất ra không có vùng trong suốt) và tương thích 100% với tính năng nhấn giữ `"Lưu ảnh"` của Zalo iOS & Android.

## Consequences
- Người dùng mở link web trên Zalo, Messenger, trình duyệt điện thoại hoặc máy tính đều có thể chọn ảnh, căn chỉnh và lưu ảnh ghép sắc nét chuẩn `1024x1024` ngay lập tức.
- Mọi phép toán tọa độ và nhận diện môi trường Zalo đều được bảo vệ bởi 8 bài unit test tự động theo phương pháp TDD.
