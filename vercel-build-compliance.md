---
name: vercel-build-compliance
description: Pre-build validation rule to guarantee code compiles perfectly under Vercel specifications before Git commits.
---

## Vercel Compliance Rules

### 1. Zero-Tolerance Type Safety
* Always run `tsc --noEmit` before proposing code changes.
* Never use `any` unless explicitly required by a strict third-party type.
* Ensure all dynamic routing params match the exact template typing.
* When a branch returns an empty array or generic Promise, type it explicitly (for example `Promise.resolve<Bank[]>([])`) to preserve inference.
* Annotate callback parameters in `map`, `filter`, `reduce`, and similar array helpers when the source array has conditional or inferred types.
* Avoid allowing `Promise.resolve([])` to infer `any[]`; always wrap with an explicit model type or known value type.
* If a response value may be returned from multiple promise branches, ensure all branches resolve to the same typed array shape.
* Avoid direct model type imports from `@prisma/client` root exports for build-critical code; prefer derived types from actual client calls like `Awaited<ReturnType<typeof prisma.bank.findMany>>[number]` or explicit local record shapes.

### 2. Linting & Next.js Constraints
* Run `next lint` or equivalent framework linters.
* Do not leave unescaped single/double quotes inside JSX. Use `{'text'}` or HTML entities.
* Do not use standard `<img>` tags inside Next.js; enforce `<Image />` component usage.

### 3. Environment Variable Integrity
* Confirm any required process.env variables are accounted for locally or mocked.
* Inform the user immediately if a newly introduced variable needs to be added to the Vercel Dashboard.

# Vercel Deployment Compliance Rules

Mỗi khi viết code cho tôi, bạn phải tuân thủ nghiêm ngặt các quy tắc biên dịch của Vercel:
1. KHÔNG được sử dụng kiểu dữ liệu 'any' bừa bãi trong TypeScript. Hãy viết rõ Type/Interface.
2. KHÔNG để các ký tự như (', ", <, >) đứng trơ trọi trong JSX/HTML. Phải bọc chúng trong {' '} hoặc dùng thực thể HTML (ví dụ: &apos; thay cho dấu nháy đơn).
3. Đảm bảo tất cả các component/file được import phải viết ĐÚNG CHÍNH TÁC từng chữ hoa, chữ thường (Vercel phân biệt chữ hoa chữ thường, Localhost thì không).
4. Nhắc nhở tôi nếu có biến môi trường (process.env) nào chưa được khai báo.
5. hãy định nghĩa interface cho các object và không dùng any


### 4. Verification Step
* Before completing a coding task, simulate the environment locally by running:
  `vercel build`
