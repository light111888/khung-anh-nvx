# Agent Note: Kiến Trúc Trang Web Ghép Khung Ảnh Kỷ Niệm 55 Năm THPT Nguyễn Viết Xuân

Status: implemented

## Problem
Người dùng cung cấp một file ảnh khung kỷ niệm 55 năm Trường THPT Nguyễn Viết Xuân - Phú Thọ (1972 - 2027) ở định dạng JPEG (`1024x1024`), trong đó vùng tròn ở giữa có nền caro xám-trắng (baked-in checkerboard) và góc trên bên phải của cụm số "55" đè nhẹ vào cạnh dưới bên trái của vòng tròn. Yêu cầu xây dựng một trang web miễn phí, chạy online được, tập trung duy nhất vào một chức năng: người dùng tải ảnh cá nhân lên thì ảnh được ghép vừa vặn vào phần tròn trong khung và tải ảnh kết quả về máy.

## Decision
1. **Xử lý Asset Khung Ảnh (`assets/frame.png`)**:
   - Tách kênh Alpha chính xác cấp độ sub-pixel từ ảnh gốc `1024x1024` bằng chuỗi điều hòa Fourier bậc 4 quanh tâm `(cx = 504.0, cy = 434.0)` kết hợp miền đa giác bảo toàn góc serif vàng của cụm số `"55"` (`y ∈ [668.4, 685]`, `x ∈ [332, 370.6]`) và khử nhiễu màu viền (color decontamination) để triệt tiêu hoàn toàn viền xám-trắng khi đè lên ảnh tối.
2. **Kiến Trúc Ứng Dụng Web Tĩnh (Client-Side Zero-Backend)**:
   - Tách biệt module tính toán hình học và kết xuất Canvas tại `src/compositor.js` (pure ES module, không phụ thuộc DOM, kiểm thử trực tiếp bằng `node:test`).
   - Luồng kết xuất 2 lớp trên `<canvas width="1024" height="1024">`:
     - **Lớp 1 (Dưới)**: Ảnh người dùng được tự động căn vừa khít (cover) vùng lỗ tròn `(cx = 504, cy = 434, r_clip = 302)`, hỗ trợ kéo thả vị trí (pan), phóng to/thu nhỏ (zoom), xoay 90° và khóa biên (boundary clamping) để ảnh không bao giờ bị kéo lệch hở khoảng trống trong vòng tròn.
     - **Lớp 2 (Trên)**: Lớp khung `frame.png` có kênh Alpha trong suốt ở vùng tròn, giúp viền xanh phát sáng và góc chữ "55" nằm đè tự nhiên lên trên ảnh người dùng.
3. **Triển Khai Online Miễn Phí**:
   - Đóng gói hoàn toàn tĩnh (HTML5 + CSS3 + ES Module JavaScript), không cần máy chủ backend, đảm bảo quyền riêng tư 100% (ảnh xử lý trực tiếp trên trình duyệt của người dùng) và triển khai trực tuyến miễn phí.

## Alternatives Considered
- **Chỉ cắt ảnh người dùng theo hình tròn `arc()` rồi vẽ đè lên trên ảnh JPEG gốc**: Bị loại bỏ vì góc trên bên phải của số `"55"` vàng và ánh sáng flare của viền xanh trong khung gốc nằm đè lên phần rìa của vòng tròn; nếu vẽ ảnh người dùng đè lên trên ảnh JPEG gốc sẽ làm mất góc chữ `"55"` và mất độ sâu tự nhiên của khung.
- **Dùng thuật toán Flood-Fill / Magic Wand đơn giản để xóa nền caro**: Bị loại bỏ vì vùng ánh sáng trắng (lens flare) trên chữ `"55"` và trên viền xanh có độ bão hòa màu bằng 0 (`RGB = [255, 255, 255]`), trùng màu với ô vuông trắng của nền caro, khiến Flood-Fill ăn lẹm vào chi tiết đồ họa của khung.
- **Xử lý ghép ảnh phía Server (Node/Python Backend)**: Bị loại bỏ vì tốn chi phí duy trì server, tăng độ trễ khi tải ảnh dung lượng lớn qua mạng và không cần thiết cho bài toán ghép khung 2D vốn thực thi tức thời ở tốc độ 60fps bằng HTML5 Canvas API.

## Consequences
- Người dùng mở link web trên điện thoại hoặc máy tính có thể chọn ảnh và nhận ngay ảnh ghép sắc nét chuẩn `1024x1024` trong chưa đầy 1 giây mà không cần đăng nhập hay tải ứng dụng.
- Mọi phép toán tọa độ (auto-fit cover, pan clamping, zoom quanh tâm khung tròn) đều được bảo vệ bởi bộ unit test tự động theo phương pháp TDD.
