import Link from "next/link";
import { BRAND } from "@/lib/branding";

export default function TermsOfServicePage() {
  return (
    <div className="legal-page-shell">
      <div className="legal-art-layer legal-art-layer--light dark:hidden" aria-hidden />
      <div className="legal-art-layer legal-art-layer--dark hidden dark:block" aria-hidden />
      <div className="legal-page-content px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm font-semibold text-theme-muted hover:text-theme">
              ← Home
            </Link>
            <Link href="/login" className="text-sm font-semibold text-theme-muted hover:text-theme">
              Sign in
            </Link>
          </div>

          <div className="legal-card-frame">
            <main className="legal-card-inner px-6 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-theme-muted">Cheque-Inn Systems</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-theme-muted" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
              <span className="text-theme">Effective Date:</span> 1st April 2026
            </div>
          </header>

          <div className="space-y-8 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
        <section>
          <h2 className="text-base font-semibold">1. Introduction</h2>
          <p className="mt-2">Welcome to Cheque-Inn Systems.</p>
          <p className="mt-2">By using our platform, you agree to these Terms of Service.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. Description of Service</h2>
          <p className="mt-2">Cheque-Inn Systems provides:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Attendance tracking (QR + GPS)</li>
            <li>Payroll and earnings insights</li>
            <li>Employee and company management tools</li>
          </ul>
          <p className="mt-2">Available via web and mobile applications.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. User Roles</h2>
          <p className="mt-2">The platform includes different roles:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Platform Admin</li>
            <li>Company Admin</li>
            <li>Managers / HR</li>
            <li>Employees</li>
          </ul>
          <p className="mt-2">Each role has different permissions and responsibilities.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. Account Responsibility</h2>
          <p className="mt-2">You are responsible for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Keeping your login credentials secure</li>
            <li>All activity under your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. Acceptable Use</h2>
          <p className="mt-2">You agree NOT to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Misuse the system</li>
            <li>Attempt unauthorized access</li>
            <li>Falsify attendance records</li>
            <li>Disrupt system functionality</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. Attendance Integrity</h2>
          <p className="mt-2">The system uses:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>GPS verification</li>
            <li>QR validation</li>
          </ul>
          <p className="mt-2">Users must not attempt to manipulate attendance records.</p>
          <p className="mt-2">Future versions may include enhanced verification (e.g., facial verification).</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Payroll &amp; Earnings</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Payroll calculations are based on company-defined configurations</li>
            <li>Cheque-Inn Systems does not guarantee financial accuracy if incorrect data is provided by the company</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Company Responsibility</h2>
          <p className="mt-2">Company administrators are responsible for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Managing employees</li>
            <li>Setting policies (shifts, payroll, etc.)</li>
            <li>Ensuring correct data input</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">9. Availability</h2>
          <p className="mt-2">We aim to provide reliable service but do not guarantee:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>uninterrupted access</li>
            <li>error-free operation at all times</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">10. Limitation of Liability</h2>
          <p className="mt-2">Cheque-Inn Systems is not liable for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>data inaccuracies caused by user input</li>
            <li>financial decisions made using the system</li>
            <li>indirect or consequential damages</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">11. Termination</h2>
          <p className="mt-2">We may suspend or terminate access if:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>terms are violated</li>
            <li>system misuse is detected</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">12. Changes to Terms</h2>
          <p className="mt-2">We may update these Terms at any time.</p>
          <p className="mt-2">Continued use of the system means you accept the updated terms.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">13. Governing Law</h2>
          <p className="mt-2">These Terms are governed by the laws of Ghana.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">14. Contact</h2>
          <div className="legal-contact-panel mt-3 text-sm">
            <div
              className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Support</span>
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="text-right font-semibold text-primary-600 underline-offset-2 hover:underline sm:text-left dark:text-primary-400"
              >
                {BRAND.supportEmail}
              </a>
            </div>
            <div className="flex flex-col gap-1 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Website</span>
              <a
                href="https://chequeinn.com"
                target="_blank"
                rel="noreferrer"
                className="text-right font-semibold text-primary-600 underline-offset-2 hover:underline sm:text-left dark:text-primary-400"
              >
                chequeinn.com
              </a>
            </div>
          </div>
        </section>
          </div>

              <div className="mt-12 flex flex-wrap items-center gap-3">
                <Link href="/login" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  ← Back to sign in
                </Link>
                <span className="text-xs text-theme-muted">•</span>
                <Link href="/" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  Back to home
                </Link>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

