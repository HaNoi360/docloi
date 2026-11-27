# Teleprompter Web v0.9

Ứng dụng web teleprompter quay camera trước, giao diện camera toàn màn hình và bảng điều khiển dạng lớp phủ.

## Chạy thử

- Triển khai toàn bộ thư mục `Teleprompter` lên GitHub Pages hoặc Cloudflare Pages.
- Mở trang bằng HTTPS trên Chrome Android.
- Cấp quyền Camera và Microphone.
- Nhấn **Bật camera**. Ứng dụng sẽ yêu cầu chế độ toàn màn hình nếu trình duyệt cho phép.
- Vuốt xuống để mở bảng điều khiển; vuốt lên để đóng. Có thể dùng nút ☰ và ×.
- Nhập kịch bản, chỉnh tốc độ/cỡ chữ/tỷ lệ/đếm ngược.
- Nhấn **Bắt đầu quay**. Bộ đếm ngược xuất hiện giữa màn hình; sau đó video bắt đầu ghi và lời thoại tự cuộn.
- Nhấn **Kết thúc**, sau đó chọn **Lưu video**.

## Ghi chú

- Video chỉ lấy hình ảnh từ camera qua Canvas và âm thanh từ microphone; giao diện và chữ nhắc không được vẽ vào video.
- Trình duyệt có thể xuất WebM hoặc MP4 tùy khả năng MediaRecorder. Không đổi đuôi file thủ công.
- Fullscreen API có thể bị giới hạn bởi phiên bản/trạng thái trình duyệt. Bố cục vẫn dùng chế độ immersive toàn màn hình trong vùng trang; để ẩn cả thanh trình duyệt, có thể cài website ra màn hình chính nếu trình duyệt hỗ trợ.
- Dữ liệu video được xử lý cục bộ trên thiết bị.


## v0.4 – Đồng bộ ghi hình và cuộn chữ
- Nút Bắt đầu quay khởi động bộ ghi hình trước, sau đó dùng cùng mốc thời gian để cuộn lời thoại.
- Tốc độ cuộn tính theo thời gian thực (pixel/giây), không phụ thuộc tần số quét màn hình.
- Hạn chế nhảy chữ khi Android tạm thời giảm nhịp khung hình.
- Service Worker cache được nâng lên v4.


## v0.5 – Tối ưu micro USB-C / GoChek
- Mặc định tắt AGC, khử nhiễu và khử tiếng vọng của trình duyệt để tránh xử lý âm thanh hai lần với micro không dây có đầu thu USB-C.
- Bổ sung lựa chọn chế độ âm thanh: giữ tín hiệu gốc, tự động hoặc giảm tiếng ồn.
- Liệt kê micro đầu vào để chọn thiết bị cụ thể; có thể áp dụng lại cấu hình mà không tải lại trang.
- Hiển thị tên micro, sample rate, số kênh và trạng thái xử lý âm thanh mà Chrome báo cáo.
- Bổ sung thu âm thử 10 giây và phát lại ngay trên điện thoại trước khi quay.
- Đặt bitrate mục tiêu âm thanh 192 kbps và video 8 Mbps khi MediaRecorder hỗ trợ.
- Nâng Service Worker cache lên v5 để tránh dùng mã JavaScript cũ.
- Lưu ý: trình duyệt/Android có thể bỏ qua một số constraint hoặc báo cáo không đầy đủ; bitrate là mục tiêu mã hóa, không đảm bảo tín hiệu đầu vào không méo.


## v0.6 – Lưu cấu hình và phát theo file SRT
- Cấu hình tự động lưu trong bộ nhớ trình duyệt (localStorage) và nạp lại lần mở sau: lời thoại, tốc độ cuộn, cỡ chữ, độ tối nền, căn chữ, tỷ lệ video, đếm ngược, chế độ micro, thiết bị micro, file SRT đã nạp và nhịp SRT. Có nút **Đặt lại cấu hình mặc định**.
- Nếu micro đã lưu không còn kết nối, ứng dụng tự dùng micro mặc định.
- **Phát theo file SRT**: bấm **Chọn file .srt**. Mỗi cue hiện thành một đoạn; chữ cuộn sao cho đầu mỗi cue nằm đúng vạch đọc vào giây bắt đầu của cue (nội suy tuyến tính giữa các cue, nên khoảng lặng dài sẽ cuộn chậm lại). Cue đang đọc sáng rõ, các cue khác mờ hơn.
- Khi bấm **Bắt đầu quay**, giây 0 của SRT trùng với mốc bắt đầu ghi video, nên lời thoại khớp với timeline phụ đề. Nút **Chạy chữ** cũng chạy theo SRT để tập thử.
- Thanh **Nhịp theo SRT** (50–150%) tăng/giảm tốc toàn bộ timeline. Khi đang dùng SRT, thanh tốc độ cố định bị khóa. Bấm **Gỡ SRT** để quay về chế độ cố định.
- Đã sửa lỗi lời thoại mẫu hiển thị ký tự `\n` thay vì xuống dòng.
- Service Worker cache nâng lên v6.


## v0.7 – Cài đặt như ứng dụng, chạy offline
- Thêm icon (192/512, kèm bản maskable) và hoàn thiện `manifest.json` để Chrome cho phép cài đặt.
- Bản chạy trong trình duyệt hiện nút **Cài đặt ứng dụng (chạy offline)** ở màn hình đầu. Bản đã cài sẽ tự ẩn nút này.
- Service Worker lưu toàn bộ mã và icon; sau lần mở đầu tiên bằng HTTPS, app mở và hoạt động khi không có mạng. Cache nâng lên v7.
- iPhone/iPad: không có nút cài đặt tự động, dùng Chia sẻ → Thêm vào MH chính (app hiển thị hướng dẫn).
- Cập nhật: khi đưa bản mới lên, mở app khi có mạng một lần để tải bản mới; có thể cần mở lại app lần nữa để áp dụng.


## v0.8 – Tự lưu toàn bộ trạng thái làm việc
- Tắt app rồi mở lại vẫn còn nguyên: lời thoại, file SRT, cấu hình, **vị trí chữ đang cuộn** (mở lại ở trạng thái tạm dừng), bảng điều khiển đang mở hay đóng.
- Camera tự bật lại nếu lần trước đang bật và trình duyệt đã cấp quyền (không cần chạm màn hình). Chế độ toàn màn hình chỉ vào lại khi người dùng bấm, do giới hạn của trình duyệt.
- **Video không bị mất**: khi quay, từng đoạn 0,5 giây được ghi ngay vào IndexedDB. Nếu app bị tắt, điện thoại hết pin hoặc trình duyệt bị hệ thống đóng giữa chừng, lần mở sau app tự ghép phần đã ghi thành video để lưu về (có thể thiếu vài giây cuối).
- Video của lần quay gần nhất được giữ trong app cho tới khi anh bấm **Xóa bản lưu** hoặc quay video mới (chỉ giữ 1 bản để tiết kiệm dung lượng). File đã tải về máy không bị ảnh hưởng.
- Xin trình duyệt giữ dữ liệu lâu dài (storage.persist) để hạn chế bị dọn khi thiếu bộ nhớ.
- Lưu ý: xóa dữ liệu trang/cache của Chrome sẽ xóa cả các bản lưu này. Service Worker cache nâng lên v8.


## v0.9 – Vuốt để tua chữ khi đang quay
- Đặt ngón tay lên vùng chữ và vuốt xuống để tua lại (chữ đi lùi), vuốt lên để tua tới. Trong lúc giữ tay, chữ đứng yên; nhả tay thì chữ tiếp tục trôi theo tốc độ đã đặt.
- Với SRT: vị trí kéo được quy ra thời gian trong file SRT, nhả tay thì chạy tiếp theo nhịp SRT từ điểm đó (đoạn lệch so với giây quay thực là phần anh đã tua lại).
- Kéo hoạt động cả khi đang tạm dừng; vị trí được lưu lại như các thao tác khác. Không kéo quá đầu văn bản.
- Vùng chữ giờ nhận cảm ứng nên cử chỉ vuốt xuống để mở bảng điều khiển chỉ hoạt động ngoài vùng chữ (mép trên, hai bên). Vẫn có thể mở bằng nút ☰ hoặc thanh "Vuốt xuống để mở điều khiển" ở dưới.
- Service Worker cache nâng lên v9.
