# Hướng dẫn viết code TypeScript đúng chuẩn Strict Mode

> File này dùng để đưa cho AI (Claude, ChatGPT, Copilot...) làm system prompt / context
> khi nhờ AI viết code cho dự án Next.js / React / Node có bật `"strict": true` trong `tsconfig.json`.
> Mục tiêu: tránh các lỗi build trên Vercel do TypeScript strict mode gây ra.

---

## 1. Quy tắc bắt buộc khi AI viết code

### 1.1. Không bao giờ để tham số hàm bị implicit `any`
❌ **Sai:**
```ts
users.map((user) => user.name)
```
Nếu `users` không có kiểu rõ ràng, `user` sẽ bị lỗi `Parameter 'user' implicitly has an 'any' type`.

✅ **Đúng:**
```ts
users.map((user: User) => user.name)
```
Hoặc tốt hơn — đảm bảo `users` đã có kiểu từ nguồn:
```ts
const users: User[] = await getUsers();
users.map((user) => user.name) // TS tự suy luận đúng, không cần khai báo lại
```

### 1.2. Luôn định nghĩa `interface` hoặc `type` cho:
- Props của component (`interface Props { ... }`)
- Dữ liệu trả về từ API / database
- Tham số của mọi hàm (callback, event handler, arrow function...)
- State (`useState<Type>(...)`)

### 1.3. Không dùng `any` để "cho qua"
❌ Tránh:
```ts
function handleData(data: any) { ... }
```
✅ Thay bằng:
```ts
function handleData(data: UserData) { ... }
```
Nếu thực sự chưa biết kiểu chính xác, dùng `unknown` thay vì `any`, rồi kiểm tra kiểu (type narrowing) trước khi dùng.

### 1.4. Xử lý giá trị có thể `null` / `undefined`
❌ Sai:
```ts
function getName(user: User) {
  return user.profile.name; // lỗi nếu profile có thể undefined
}
```
✅ Đúng:
```ts
function getName(user: User) {
  return user.profile?.name ?? "Unknown";
}
```

### 1.5. Định nghĩa kiểu trả về của hàm khi hàm phức tạp
```ts
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### 1.6. Với React component, luôn khai báo Props type
```tsx
interface AccountsListProps {
  accounts: Account[];
  onSelect: (id: string) => void;
}

export function AccountsList({ accounts, onSelect }: AccountsListProps) {
  ...
}
```

### 1.7. Với event handler, luôn dùng đúng type của React
```tsx
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  console.log(e.target.value);
}

function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
  ...
}
```

### 1.8. Với dữ liệu từ API (fetch/axios), luôn ép kiểu rõ ràng
```ts
interface ApiResponse {
  data: User[];
  total: number;
}

const res = await fetch("/api/users");
const json: ApiResponse = await res.json();
```

### 1.9. Import type dùng chung, không định nghĩa lại nhiều nơi
```ts
import type { User, Account } from "@/types";
```

---

## 2. Checklist AI phải tự kiểm tra trước khi trả code

- [ ] Mọi tham số hàm/callback đều có kiểu tường minh hoặc được suy luận từ biến đã có kiểu.
- [ ] Không có `any` nào xuất hiện (trừ khi được yêu cầu rõ ràng).
- [ ] Mọi Props của component đều có `interface`/`type`.
- [ ] Mọi giá trị có khả năng `null`/`undefined` đều được xử lý bằng `?.` hoặc `??` hoặc kiểm tra `if`.
- [ ] Dữ liệu trả về từ API/database được ép kiểu hoặc validate (nên dùng `zod` nếu có).
- [ ] Không có biến nào được khai báo mà không có kiểu rõ ràng khi giá trị ban đầu là `[]`, `{}`, hoặc `null`.
- [ ] Chạy thử `tsc --noEmit` (hoặc tưởng tượng chạy) để đảm bảo không có lỗi type trước khi đưa code.

---

## 3. Câu lệnh mẫu để nhắc AI khi yêu cầu viết code

> "Hãy viết code tuân thủ TypeScript strict mode. Không dùng `any`. Định nghĩa đầy đủ interface/type cho mọi props, tham số hàm, và dữ liệu API. Xử lý rõ ràng các giá trị có thể null/undefined."

---

## 4. Quy trình kiểm tra trước khi deploy lên Vercel

1. Chạy `npm run build` ở local trước khi push code — Vercel dùng đúng chế độ này.
2. Nếu có lỗi type, sửa tận gốc (không tắt `strict` trong `tsconfig.json`).
3. Cân nhắc thêm bước kiểm tra tự động:
   - `npx tsc --noEmit` trong CI (GitHub Actions) trước khi merge.
   - `husky` + `lint-staged` để chặn commit nếu có lỗi type hoặc lỗi lint.
4. Gom các type dùng chung vào `src/types.ts` hoặc thư mục `src/types/` để tránh định nghĩa trùng lặp, không đồng nhất giữa các file do AI generate.
