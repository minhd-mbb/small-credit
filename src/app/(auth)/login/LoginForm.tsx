"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import supabase from "@/lib/supabaseClient";
import { resolveLoginEmail } from "@/lib/login-identity";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deriveSupabasePassword } from "@/lib/supabase-password";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [forgotPreview, setForgotPreview] = useState<{
    username: string;
    fullName: string;
  } | null>(null);
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [identityError, setIdentityError] = useState("");

  function showAlert(message: string) {
    setAlertMessage(message);
  }

  function closeAlert() {
    setAlertMessage("");
  }

  useEffect(() => {
    if (!alertMessage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        closeAlert();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [alertMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlertMessage("");
    setMessage("");

    const email = resolveLoginEmail(username);

    if (!email) {
      showAlert(`User ${username} sai username hoặc mật khẩu. Mời kiểm tra lại`);
      return;
    }

    setIsPending(true);

    const syncResponse = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const supabasePassword = syncResponse.ok
      ? await deriveSupabasePassword(password)
      : null;

    const { data, error } = supabasePassword
      ? await supabase.auth.signInWithPassword({
      email,
          password: supabasePassword,
        })
      : { data: { user: null }, error: new Error("Login synchronization failed") };

    setIsPending(false);

    if (error || !data?.user) {
      const statusResponse = await fetch("/api/auth/account-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email }),
      });
      const statusPayload = await statusResponse.json();

      if (statusPayload.data?.inactive) {
        showAlert(`User ${email} cần liên hệ Quản trị ngân hàng để activate`);
        return;
      }

      showAlert(`User ${email} sai username hoặc mật khẩu. Mời kiểm tra lại`);
      return;
    }

    // Successful login — navigate to callback or dashboard
    const requestedCallback = searchParams.get("callbackUrl");
    const callback = requestedCallback?.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : "/dashboard";
    router.push(callback);
    router.refresh();
  }

  async function requestPasswordReset() {
    setAlertMessage("");
    setMessage("");
    setForgotPreview(null);

    const email = resolveLoginEmail(username);

    if (!email) {
      showAlert("Nhập email hoặc username trước khi yêu cầu reset mật khẩu.");
      return;
    }

    const response = await fetch("/api/auth/forgot-password/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email }),
    });
    const payload = await response.json();

    if (!response.ok) {
      showAlert(payload.error ?? "Không tìm thấy tài khoản.");
      return;
    }

    setForgotPreview({
      username: payload.data.username,
      fullName: payload.data.fullName,
    });
  }

  async function confirmPasswordReset() {
    if (!forgotPreview) {
      return;
    }

    setAlertMessage("");
    setMessage("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: forgotPreview.username }),
    });

    if (!response.ok) {
      showAlert("Không thể ghi nhận yêu cầu reset mật khẩu.");
      return;
    }

    setForgotPreview(null);
    setMessage("Password reset request has been sent to account management.");
  }

  return (
    <>
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block">
        <span className="text-xs font-bold text-[var(--text-secondary)]">
          Email
        </span>
        <div className="mt-2 flex h-11 items-center gap-2 rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_rgba(26,92,46,0.12)]">
          <Mail size={16} className="text-[var(--text-muted)]" />
          <input
            autoComplete="username"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            inputMode="email"
            maxLength={100}
            placeholder="user@example.com"
            type="email"
            value={username}
            onChange={(event) => {
              const v = event.target.value.toLowerCase();
              setUsername(v);
              if (!touchedUsername) setTouchedUsername(true);

              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

              setIdentityError(emailRegex.test(v) ? "" : "Email không hợp lệ.");
            }}
            onBlur={() => setTouchedUsername(true)}
          />
        {touchedUsername && identityError ? (
          <p className="mt-2 text-sm font-medium text-red-600">{identityError}</p>
        ) : null}
        </div>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-[var(--text-secondary)]">
          Password
        </span>
        <div className="mt-2 flex h-11 items-center gap-2 rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 transition-all focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_rgba(26,92,46,0.12)]">
          <Lock size={16} className="text-[var(--text-muted)]" />
          <input
            autoComplete="current-password"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            placeholder="1234"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      {message ? (
        <p className="rounded-xl bg-[var(--status-done)] px-3 py-2 text-xs font-bold text-[var(--status-done-text)]">
          {message}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Login"}
        <ArrowRight size={17} />
      </Button>

      <button
        className="w-full text-center text-sm font-bold text-[var(--primary)] transition-colors hover:text-[var(--primary-dark)]"
        type="button"
        onClick={requestPasswordReset}
      >
        Quên mật khẩu
      </button>
    </form>

    {alertMessage ? (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4">
        <div
          className="w-full max-w-md rounded-[var(--radius-card)] border border-red-200 bg-white p-5 shadow-[var(--shadow-hover)]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="login-alert-title"
        >
          <p
            id="login-alert-title"
            className="text-xs font-bold uppercase text-red-600"
          >
            Cảnh báo
          </p>
          <p className="mt-3 text-base font-bold leading-6 text-[var(--text-primary)]">
            {alertMessage}
          </p>
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={closeAlert}>
              OK
            </Button>
          </div>
        </div>
      </div>
    ) : null}

    {forgotPreview ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-hover)]">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Confirm password reset
          </p>
          <h3 className="font-display mt-2 text-xl font-bold text-[var(--text-primary)]">
            Quên mật khẩu
          </h3>
          <div className="mt-4 space-y-2 rounded-xl bg-[var(--primary-light)] p-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Email: {forgotPreview.username}
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Full name: {forgotPreview.fullName}
            </p>
          </div>
          <p className="mt-3 text-sm font-medium leading-6 text-[var(--text-secondary)]">
            Xác nhận gửi yêu cầu reset mật khẩu cho tài khoản này?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForgotPreview(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmPasswordReset}>
              Confirm
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
