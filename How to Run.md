Đã build xong bản hiện tại.
Kết quả:
npm run build -> pass
Production server -> http://localhost:3001
Dev server hiện có -> http://localhost:3000
Bạn có thể mở:
http://localhost:3001
Tài khoản seed hiện còn giữ lại, mật khẩu mặc định:
Admin:      0983171982 / 1234
Bank admin: 0922076868 / 1234
Account:    1505 / 1234
Account:    1403 / 1234
Dữ liệu tiền, tiết kiệm, vay, chứng khoán và log đã được xóa/reset về 0, nên app đang ở trạng thái sạch để bắt đầu dùng thật.
Các bước sử dụng thực tế
Đảm bảo database chạy:
cd C:\Users\Minh\credit-app
docker-compose up -d
Chạy bản production:
cd C:\Users\Minh\credit-app
npm run build
npm run start
Mở app:
http://localhost:3000
Việc nên làm ngay sau khi đăng nhập:Đổi mật khẩu các tài khoản mặc định.
Dùng admin tạo/cấu hình bank.
Dùng bank admin tạo account người dùng thật.
Cấu hình lãi suất tiết kiệm/vay.
Nạp tiền ban đầu qua chức năng Nạp tiền tài khoản.
Kiểm tra dashboard bằng tài khoản cấp ACCOUNT.

Trước khi dùng lâu dài:Backup database PostgreSQL định kỳ.
Không dùng npm run dev cho vận hành thật.
Đặt NEXTAUTH_SECRET / AUTH_SECRET mạnh trong .env.local.
Nếu chạy cho máy khác trong LAN, cập nhật NEXTAUTH_URL theo IP máy chủ, ví dụ:

NEXTAUTH_URL=http://192.168.1.10:3000
Bản build hiện tại đã sẵn sàng để bạn bắt đầu vận hành local.

Nếu bạn muốn dùng cổng khác, ví dụ 3001, sửa .env.local thành:
NEXTAUTH_URL="http://localhost:3001"
AUTH_URL="http://localhost:3001"
AUTH_TRUST_HOST="true"
rồi build/restart lại.