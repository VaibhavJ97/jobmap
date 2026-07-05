"use client";

export async function getCvStatus(): Promise<{ hasCv: boolean; preview?: string; length?: number }> {
  try {
    const res = await fetch("/api/cv");
    return (await res.json()) as { hasCv: boolean; preview?: string; length?: number };
  } catch {
    return { hasCv: false };
  }
}

export async function uploadCvFile(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/cv", { method: "POST", body: form });
    const data = (await res.json()) as { error?: string };
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function uploadCvText(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as { error?: string };
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function deleteCv(): Promise<boolean> {
  try {
    const res = await fetch("/api/cv", { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
