# Security Policy

## Supported Versions

We actively maintain and provide security patches for the following versions:

| Version | Supported          | Status                                |
| ------- | ------------------ | ------------------------------------- |
| 1.0.x   | :white_check_mark: | Current active release branch (`main`)|
| < 1.0.0 | :x:                | Deprecated / Unsupported              |

---

## Reporting a Vulnerability

**DO NOT create public GitHub issues or discussions for suspected security vulnerabilities.**

To responsibly disclose a vulnerability:
1. **GitHub Private Security Advisory (Preferred):** Navigate to the **Security** tab of this repository, select **Advisories**, and click **New draft security advisory**.
2. **Direct Security Contact:** Email the DevSecOps response team directly at `security@lostandfound.app` (or repository maintainers). Include:
   - A detailed description of the vulnerability.
   - Exact steps or proof-of-concept (PoC) code to reproduce.
   - Affected routes, controllers, or dependencies.
   - Potential impact assessment.
3. **Response Timeline:**
   - **Initial Acknowledgement:** Within 24 hours.
   - **Triage & Severity Assessment:** Within 48 hours.
   - **Remediation & Patch Release:** Target within 5 business days for Critical/High vulnerabilities.
4. **Coordinated Disclosure:** We adhere to responsible coordinated disclosure guidelines. We request that reporters keep findings confidential until an official advisory and fix are released.

---

## CI/CD Security Gates

Every pull request and push to `main` or `development`, as well as a scheduled weekly cron scan, triggers automated gates defined in `.github/workflows/security.yml`:

1. **Dependency Vulnerability Gate (`dependency-audit`):**
   - Backend: Runs `npm audit --omit=dev --audit-level=high` on production dependencies.
   - Frontend: Runs `npm audit --audit-level=high`.
   - **Policy:** Fails automatically on any **High** or **Critical** vulnerability.
2. **Secret Scanning Gate (`secret-scanning`):**
   - Runs Gitleaks across full repository history (`fetch-depth: 0`).
   - Prevents accidental check-in of API keys, JWT secrets, database connection strings, or certificates.
3. **Static Application Security Testing (`sast`):**
   - Runs Semgrep using curated security rulesets (`p/javascript`, `p/nodejs`, `p/react`, and `p/secrets`).
   - Identifies injection vulnerabilities (SQL/NoSQL), prototype pollution, CSRF omissions, insecure deserialization, and XSS risks.
4. **Security Regression Tests (`security-tests`):**
   - Executes the server security integration test suite against an active `mongo:7.0` container.
   - Enforces rate limiting, CSRF protection, HttpOnly cookie isolation, BOLA checks, server-side JWT revocation (`tokenVersion`), email verification enforcement, and transactional cascade account deletion.

---

## Audit Exception Policy

We adhere to a strict Zero-High/Critical Vulnerability tolerance.

- **High and Critical Vulnerabilities:**
  - **NO EXCEPTIONS ALLOWED.**
  - All High and Critical CVEs must be patched, upgraded, or replaced prior to merging into `main` or `development`.
  - In cases where upstream packages lack immediate patches, the package must be overridden via `overrides` in `package.json`, isolated behind an architectural adapter, or swapped with an alternative library.
- **Low and Medium Vulnerabilities:**
  - Exceptions may be approved only under strict criteria:
    1. The affected code path is demonstrably unreachable in our deployment environment (e.g., pure build-time dev tooling not packaged into client production artifacts).
    2. An official fix is not yet available upstream.
    3. Documented written approval is obtained from the Security Lead.
  - Approved exceptions must be tracked in `.audit-exceptions.json` with:
    - CVE / GHSA ID.
    - Package name and version.
    - Risk analysis proving lack of exploitability.
    - Expiration date (maximum 30 days) and assigned ticket.

---

## Local Security Scans

Developers must run security checks locally prior to opening or updating a Pull Request:

### Prerequisites
- Node.js >= 20.x and npm >= 10.x
- [Gitleaks](https://github.com/gitleaks/gitleaks) (install via `brew install gitleaks`, `choco install gitleaks`, or download binary)
- [Semgrep](https://semgrep.dev) (install via `pip install semgrep` or `brew install semgrep`)

### Available Commands (from repository root)

```bash
# 1. Audit backend production dependencies (fails on High/Critical)
npm run audit:server

# 2. Audit frontend dependencies (fails on High/Critical)
npm run audit:client

# 3. Combined client and server dependency audit
npm run audit

# 4. Scan local repository and unstaged changes for hardcoded secrets
npm run scan:secrets

# 5. Run Semgrep SAST security rules locally
npm run scan:sast

# 6. Execute all automated security checks in sequence
npm run security

# 7. Run server security integration tests locally
npm test --prefix server
```
