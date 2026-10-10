"use client";
import { useState } from "react";
export default function VerifyAdminEmail() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/api/auth/send-verification-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-aim4price-client-realm": "website",
              },
              body: JSON.stringify({
                email: "aim4price@gmail.com",
                callbackURL: "/admin/ai-connect",
              }),
            });
            if (!response.ok)
              throw new Error("Unable to send verification. Please try again.");
            setMessage(
              "Check the admin inbox for the verification link, then restart the AI connection.",
            );
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Verify admin email"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
