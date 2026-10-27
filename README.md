# Campus Lost & Found — Secure Chain-of-Custody MERN Application

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js_5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> **A production-grade, enterprise-hardened Lost & Found management platform built for college campus environments, featuring strict physical chain-of-custody tracking, automated item similarity matching, dispute arbitration, and multi-layered DevSecOps controls.**

---

## 📌 About The Project

Campus lost and found workflows are traditionally fragmented, informal, and vulnerable to false claims, item misplacement, and theft. Lost property turns up across dozens of academic buildings, student union desks, and departmental offices without a centralized, auditable log of physical possession.

**Campus Lost & Found** solves these challenges by combining:
1. **Departmental Chain-of-Custody**: Found items must be physically verified by authorized department faculty or staff before claims can be filed, preventing unauthorized recovery of items not yet in campus custody.
2. **Automated Matchmaking & Manual Review**: Proprietary keyword extraction and synonym matching evaluate similarity between lost and found listings, while accommodating manual dispute claims for unique serial numbers or personal engravings.
3. **Formal Dispute Arbitration**: A dedicated dispute state machine enables rightful owners to contest incorrect handovers, automatically triggering immediate recall notices, custody freezes, and administrative arbitration.
4. **Zero-Trust Web Security**: Every endpoint is protected by an 8-layer defense-in-depth middleware pipeline that strictly stops injection attacks, unauthorized cross-origin requests, privilege escalation, and data exfiltration.

---

## 🛡️ Key Security & Architecture Highlights

* **8-Layer Middleware Defense Pipeline**: Enforces request hardening in strict sequence:
  1. *Helmet Hardening* (`nosniff`, CSP, HSTS, removal of `X-Powered-By`).
  2. *Payload Size Caps & Cookie Parsing* (`express.json({ limit: '10kb' })`).
  3. *NoSQL & Prototype Pollution Shield* (`validateStrict` regex blocking `$` operators, `__proto__`, `constructor`).
  4. *Exact-Match CORS Gatekeeper* (Zero wildcard/suffix matches; rejections logged under `CORS_REQUEST_BLOCKED`).
  5. *Dual-Token CSRF Protection* (Strict `Origin`/`Referer` checks + constant-time `X-CSRF-Token` header verification).
  6. *Granular Rate Limiters* (Protects auth routes with 5-attempt brute-force thresholds).
  7. *Identity & RBAC Gatekeepers* (`protect`, `requireVerifiedEmail`, `authorize('faculty', 'admin')`, `validateObjectId`).
  8. *Centralized Error Boundary & Audit Logger* (Suppresses production stack traces; scrubs passwords/tokens from logs).
* **Magic-Byte Image Validation**: Rejects disguised malicious payloads (such as PHP scripts renamed with `.jpg` extensions) by directly inspecting buffer magic bytes (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, WebP RIFF headers) and re-encoding files through Sharp to strip EXIF/ICC metadata.
* **Instant Session Revocation (`tokenVersion`)**: Changing a password or logging out atomically increments the user's `tokenVersion`, instantly invalidating all active JWT sessions across devices.
* **ACID Transactional Cascade Deletions**: Deleting an account initiates a Mongoose replica transaction that cleanly deletes user claims, resolves or removes disputes, anonymizes activity feeds, unlinks orphaned physical image files post-commit, and deletes the user profile with zero partial failures.
* **Public PII Projection**: Explicit MongoDB query projections (`select(PUBLIC_ITEM_FIELDS)`) prevent internal fields, contact emails, phone numbers, password hashes, and verification tokens from ever leaking to unauthorized users.

---

## 💻 Tech Stack Breakdown

### Frontend
* **Core**: React 18 with TypeScript
* **Build Tool**: Vite (Rolldown / Fast Refresh)
* **Styling**: Tailwind CSS
* **Routing**: React Router DOM v6 (Nested Protected Routes, Role Guards)
* **Icons & UI**: Lucide React
* **State Management**: React Context API (`AuthContext`)

### Backend & Database
* **Runtime**: Node.js (CommonJS)
* **Framework**: Express.js 5.x
* **Database**: MongoDB via Mongoose 9.x ODM
* **Security & Auth**: Helmet 8, bcryptjs, jsonwebtoken, express-rate-limit, crypto
* **File Processing**: Multer (Memory Storage) + Sharp (WebP re-encoding & resizing)
* **Testing & Simulation**: Jest 30, Supertest 7

---

## 🚀 Getting Started & Setup

### Prerequisites
* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher
* **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster connection string

---

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/campus-lost-and-found.git
   cd campus-lost-and-found
   ```

2. **Install Root & Server Dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies**:
   ```bash
   cd ../client
   npm install --legacy-peer-deps
   ```

4. **Return to the root directory**:
   ```bash
   cd ..
   ```

---

### Environment Configuration

1. **Configure Backend Environment (`server/.env`)**:
   Create a `.env` file in the `server` directory based on `server/.env.example`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/lostandfound
   JWT_SECRET=your_super_secret_jwt_key_min_32_characters
   FRONTEND_URL=http://localhost:5173
   LOCAL_FRONTEND_URL_1=http://localhost:5173
   LOCAL_FRONTEND_URL_2=http://localhost:5174
   ADMIN_EMAIL=admin@campus.edu
   ADMIN_PASSWORD=AdminPassword123!
   ```

2. **Configure Frontend Environment (`client/.env`)**:
   Create a `.env` file in the `client` directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

---

### Running Locally

You can launch both the frontend and backend using root convenience scripts:

* **Start the Backend API Server**:
  ```bash
  npm run dev:server
  ```
  *Server runs at `http://localhost:5000`*

* **Start the Frontend Vite Dev Server**:
  ```bash
  npm run dev:client
  ```
  *Client runs at `http://localhost:5173`*

---

## 🧪 Testing & Verification

The repository contains both unit/integration test suites and end-to-end security simulation suites covering all 7 phases of application hardening.

### 1. Server Security Integration Tests
Executes 63 unit and integration tests verifying authentication, BOLA ownership guards, rate limiting, error handling, token revocation, email verification, cascade deletion, NoSQL sanitization, and audit logging:
```bash
npm test --prefix server
```

### 2. End-to-End (E2E) Security Simulation Suite
Executes the comprehensive 17-test end-to-end security simulation suite verifying HTTP hardening, CORS blocking, CSRF timing verification, token revocation replay attacks, role escalation prevention, magic-byte upload rejections, and master audit log scrubbing:
```bash
npm run test:e2e
```

### 3. Automated Security Scans (SAST & Secrets)
Run automated vulnerability audits and pre-commit scans:
```bash
# Run npm audit across packages
npm run audit

# Scan for committed secrets with Gitleaks
npm run scan:secrets

# Run Semgrep static analysis
npm run scan:sast
```

---

## 📖 Architectural Documentation

For an exhaustive, reverse-engineered technical breakdown of the entire application architecture—including the complete **Item Custody State Machine**, **Claim Resolution Flow**, **Dispute Arbitration Flow**, and **Database Entity Relationship Matrix**—refer to our dedicated technical specification:

👉 **[View Technical Specification & State Machine Documentation (docs/project_state.md)](docs/project_state.md)**

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
