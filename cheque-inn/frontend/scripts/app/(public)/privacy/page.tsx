import Link from "next/link";
import { BRAND } from "@/lib/branding";

export default function PrivacyPolicyPage() {
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
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-theme-muted">Cheque-Inn Systems</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-theme-muted" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
              <span className="text-theme">Effective Date:</span> 1st April 2026
            </div>
          </header>

          <div className="space-y-8 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
        <section>
          <h2 className="text-base font-semibold">1. Introduction</h2>
          <p className="mt-2">
            Cheque-Inn Systems; we provides a workforce management platform that includes attendance tracking, payroll
            insights, and employee management tools via web and mobile applications.
          </p>
          <p className="mt-2">
            This Privacy Policy explains how we collect, use, and protect your information when you use our services.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. Information We Collect</h2>
          <p className="mt-2">We may collect the following types of information:</p>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">a. Personal Information</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Company and role information</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">b. Employment &amp; Attendance Data</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
                <li>Clock-in and clock-out records</li>
                <li>Work sessions and attendance history</li>
                <li>Shift assignments</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">c. Location Data (Important)</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
                <li>GPS location is collected only during attendance actions (clock-in / clock-out)</li>
                <li>We do not track users continuously in the background</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">d. Payroll &amp; Earnings Data</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
                <li>Salary configurations</li>
                <li>Earnings calculations</li>
                <li>Work hours and overtime</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">e. Device &amp; Usage Information</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
                <li>Device type</li>
                <li>App usage logs</li>
                <li>IP address (web)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. How We Use Your Information</h2>
          <p className="mt-2">We use your data to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Provide attendance tracking services</li>
            <li>Verify location during clock-in/out</li>
            <li>Calculate earnings and payroll insights</li>
            <li>Manage employee and company accounts</li>
            <li>Improve system performance and user experience</li>
            <li>Provide support and respond to inquiries</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. Data Sharing</h2>
          <p className="mt-2">We do not sell your personal data.</p>
          <p className="mt-2">We may share data only:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Within your company (e.g., admins viewing employee data)</li>
            <li>With trusted service providers (e.g., hosting, authentication)</li>
            <li>When required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. Data Security</h2>
          <p className="mt-2">We take reasonable measures to protect your data, including:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Secure authentication systems</li>
            <li>Encrypted connections (HTTPS)</li>
            <li>Controlled access to company data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. Data Ownership</h2>
          <p className="mt-2">Each company controls its own employee data.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Company administrators can manage and access employee records</li>
            <li>Employees can view their own data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Your Rights</h2>
          <p className="mt-2">You may:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Request access to your data</li>
            <li>Request corrections</li>
            <li>Request deletion (subject to company/admin policies)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Data Retention</h2>
          <p className="mt-2">We retain data as long as necessary to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Provide services</li>
            <li>Meet legal or operational requirements</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">9. Third-Party Services</h2>
          <p className="mt-2">We may use third-party services such as:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--text-muted)" }}>
            <li>Authentication providers</li>
            <li>Cloud storage and hosting</li>
          </ul>
          <p className="mt-2">These services follow their own privacy practices.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">10. Changes to This Policy</h2>
          <p className="mt-2">We may update this Privacy Policy from time to time.</p>
          <p className="mt-2">Changes will be reflected with an updated &quot;Effective Date&quot;.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold">11. Contact Us</h2>
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

