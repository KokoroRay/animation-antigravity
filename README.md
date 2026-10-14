# Antigravity Cinematic Startup Animation & Live Wallpaper

Hoạt cảnh khởi động phong cách anime/cyberpunk và bộ tùy chỉnh giao diện dành cho **Google Antigravity IDE**. Dự án có trang xem trước chạy cục bộ, hiệu ứng hoạt cảnh, các tùy chọn theme và live wallpaper.

Dự án được chuyển thể từ [Codex Startup Animation](https://github.com/panding999/codex-startup-animation) của [@panding999](https://github.com/panding999).

## Demo

Video giới thiệu hoạt cảnh:

<video src="./2026-10-14%2011-55-54.mp4" controls preload="metadata" width="100%">
  Trình duyệt của bạn không hỗ trợ phát video. Hãy
  <a href="./2026-10-14%2011-55-54.mp4">mở hoặc tải video demo</a>.
</video>

Nếu trình xem Markdown không phát video trực tiếp, [mở hoặc tải video demo](./2026-10-14%2011-55-54.mp4).

## Tính năng

- Hoạt cảnh mở đầu gồm màn hình khởi động, code chạy, hiệu ứng nét vẽ neon, video nhân vật và lớp HUD.
- Trang preview độc lập có thể tua, tạm dừng, phát lại và mở hộp thoại cài đặt.
- Tùy chỉnh video MP4/WebM và hình ảnh artwork; dữ liệu tùy chỉnh được lưu trong IndexedDB trên trình duyệt.
- Chọn các preset giao diện Aura Dark Cyber, Elaina Starlight Cyber, tự đồng bộ màu từ video, Cyber Neon Matrix và Deep Space Noir.
- Điều chỉnh độ rõ của editor và cường độ live wallpaper.
- Launcher tích hợp để áp dụng hoạt cảnh và giao diện vào Antigravity trên Windows.

## Yêu cầu

- **Node.js** phiên bản hỗ trợ ES modules (khuyến nghị bản LTS hiện hành).
- **Windows** và Google Antigravity IDE nếu muốn chạy launcher tích hợp.
- Không cần cài package npm riêng cho preview và bộ kiểm thử hiện tại.

## Bắt đầu nhanh

Mở PowerShell hoặc terminal tại thư mục dự án.

### Xem trước hoạt cảnh trong trình duyệt

```bash
npm run preview
```

Máy chủ preview chạy tại `http://127.0.0.1:8765` và tự mở trình duyệt. Có thể chạy `Preview-Animation.bat` trên Windows thay cho lệnh npm.

### Chạy launcher tích hợp trên Windows

```cmd
Start-Antigravity.bat
```

Hoặc khởi chạy trực tiếp bằng Node.js:

```bash
npm start
```

Nếu Antigravity đang mở mà hoạt cảnh không xuất hiện, hãy đóng hoàn toàn các tiến trình Antigravity rồi chạy lại launcher.

### Tạo lối tắt Desktop trên Windows

```powershell
powershell -ExecutionPolicy Bypass -File Create-Desktop-Shortcut.ps1
```

## Tùy chỉnh

Trong preview hoặc Antigravity, mở **Cài đặt giao diện**. Trong Antigravity, có thể dùng phím tắt **Ctrl+Alt+B**.

Tại hộp thoại cài đặt, bạn có thể:

1. Chọn video MP4/WebM hoặc ảnh artwork khác từ máy.
2. Chọn một preset màu giao diện.
3. Điều chỉnh độ rõ nền editor và cường độ live wallpaper.
4. Lưu thay đổi, áp dụng và phát lại hoạt cảnh.

Các video và hình ảnh do người dùng chọn được lưu cục bộ trong IndexedDB của trình duyệt; cài đặt không yêu cầu tải nội dung lên dịch vụ bên ngoài.

## Kiểm thử

Chạy toàn bộ unit test:

```bash
npm test
```

Bộ test hiện có kiểm tra nhận diện cửa sổ qua CDP, bảo vệ CDP local socket, cú pháp các script được tiêm và thuật toán vector hóa đường viền.

## Cấu trúc dự án

| Đường dẫn | Mô tả |
| --- | --- |
| `index.html`, `style.css` | Giao diện preview và kiểu dáng hoạt cảnh |
| `animation.js` | Điều khiển trình tự hoạt cảnh |
| `image-settings.js` | Hộp thoại cài đặt video, ảnh và giao diện |
| `bin/preview-server.mjs` | Máy chủ preview cục bộ |
| `bin/launcher.mjs` | Điểm vào của launcher |
| `extension/` | Tích hợp CDP, renderer và live wallpaper |
| `assets/` | Media, ảnh artwork và tài nguyên của hoạt cảnh |
| `test/` | Unit test |
| `2026-10-14 11-55-54.mp4` | Video demo được nhúng ở phần trên |

## Ghi nhận và giấy phép

- Mã nguồn nền tảng: [panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation).
- Dự án khai báo giấy phép MIT trong `package.json`; hãy kiểm tra giấy phép và quyền sử dụng riêng của từng video, hình ảnh hoặc tài nguyên bên thứ ba đi kèm trước khi phân phối lại.
