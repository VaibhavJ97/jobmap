"use client";

import { useEffect, useRef, useState } from "react";
import { getCvStatus, uploadCvFile, uploadCvText, deleteCv } from "@/lib/cv";

export default function CvUpload() {
  const [hasCv, setHasCv] = useState(false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    getCvStatus().then((s) => {
      setHasCv(s.hasCv);
      setPreview(s.preview ?? "");
    });
  }
  useEffect(refresh, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    const res = await uploadCvFile(file);
    setBusy(false);
    if (res.ok) {
      setMsg("CV saved. Check match and Match my CV now use it.");
      refresh();
    } else {
      setMsg(res.error ?? "Upload failed.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPaste() {
    if (pasteText.trim().length < 50) {
      setMsg("Please paste a bit more of your CV text.");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await uploadCvText(pasteText);
    setBusy(false);
    if (res.ok) {
      setMsg("CV saved. Check match and Match my CV now use it.");
      setShowPaste(false);
      setPasteText("");
      refresh();
    } else {
      setMsg(res.error ?? "Save failed.");
    }
  }

  async function onDelete() {
    setBusy(true);
    await deleteCv();
    setBusy(false);
    setHasCv(false);
    setPreview("");
    setMsg("CV removed.");
  }

  return (
    <div className="cv-box">
      <div className="cv-head">
        <span className="cv-title">&#128196; Your CV {hasCv ? "· personalizes tailored bullets" : ""}</span>
        {hasCv && (
          <button className="link-btn" onClick={onDelete} disabled={busy}>Remove</button>
        )}
      </div>

      {hasCv ? (
        <p className="cv-preview">Saved: “{preview}…”</p>
      ) : (
        <p className="cv-sub">Upload your CV (PDF or Word) so Check match and Match my CV can compare it to each job. Private to your account.</p>
      )}

      <div className="cv-actions">
        <button className="ai-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {hasCv ? "Replace file" : "Upload PDF / Word"}
        </button>
        <button className="save-btn" onClick={() => setShowPaste((s) => !s)} disabled={busy}>
          {showPaste ? "Cancel" : "Paste text instead"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onFile}
          style={{ display: "none" }}
        />
      </div>

      {showPaste && (
        <div className="cv-paste">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your CV text here…"
            rows={6}
          />
          <button className="btn" onClick={onPaste} disabled={busy}>
            {busy ? "Saving…" : "Save CV text"}
          </button>
        </div>
      )}

      {busy && <p className="cv-msg">Working…</p>}
      {msg && !busy && <p className="cv-msg">{msg}</p>}
    </div>
  );
}
