"use client";

import {
  LogOut,
  Maximize2,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type FloatingCommandMenuProps = {
  panelOpen: boolean;
  onTogglePanel: () => void;
};

export function FloatingCommandMenu({
  panelOpen,
  onTogglePanel,
}: FloatingCommandMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  function openAccount() {
    setOpen(false);
    router.push("/account");
  }

  async function handleLogout() {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div ref={menuRef} className="fixed bottom-20 right-5 z-50 md:bottom-5">
      {open ? (
        <div className="absolute bottom-14 right-0 w-56 rounded-2xl border border-[var(--color-border)] bg-white/95 p-2 shadow-[0_22px_54px_rgba(49,54,49,0.18)] backdrop-blur">
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]"
            type="button"
            onClick={onTogglePanel}
          >
            {panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            {panelOpen ? "Close panel" : "Open panel"}
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]"
            type="button"
            onClick={toggleFullscreen}
          >
            <Maximize2 size={17} />
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]"
            type="button"
            onClick={openAccount}
          >
            <Settings size={17} />
            Tài khoản
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            Log out
          </button>
        </div>
      ) : null}

      <button
        aria-label="Open quick menu"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-charcoal)] text-white opacity-50 shadow-[0_16px_36px_rgba(49,54,49,0.35)] transition-all hover:scale-105 hover:opacity-80"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={22} />
      </button>
    </div>
  );
}
