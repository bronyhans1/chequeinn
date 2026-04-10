"use client";

/** Non-blocking confirmation after a file download is triggered. */
export function ExportSuccessNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
