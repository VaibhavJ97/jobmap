"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not create the account.");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(mode === "signup" ? "Account created, but sign-in failed. Try signing in." : "Wrong email or password.");
        setBusy(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-card modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h1 className="site-title" style={{ marginBottom: "0.25rem" }}>
          Job<span>Map</span>
        </h1>
        <p className="site-sub" style={{ marginBottom: "1.25rem" }}>
          {mode === "signin" ? "Sign in to save and check match with CV." : "Create an account to save and check match with CV."}
        </p>

        <form onSubmit={submit} className="auth-form">
          <label className="auth-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            />
          </label>

          {error && <div className="warn">{error}</div>}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button className="link-btn" onClick={() => { setMode("signup"); setError(""); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="link-btn" onClick={() => { setMode("signin"); setError(""); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
