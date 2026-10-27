# Full-Stack Application Technical Specification & State Machine Documentation

## 1. Executive Summary & Architecture Overview

This document provides the definitive, reverse-engineered technical specification and state machine architecture for the campus **Lost & Found** web application. It maps end-to-end execution flows across frontend React components, HTTP/middleware pipelines, controllers, and MongoDB models.

### Technology Stack
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router DOM v6.
* **Backend**: Node.js, Express.js 5.x REST API, MongoDB via Mongoose 9.x ODM.
* **Authentication & Session**: Dual-token transport (JWT signed via HMAC SHA-256 stored in `HttpOnly`, `SameSite=Strict` cookies, alongside cryptographic anti-CSRF double-submit cookies and `X-CSRF-Token` headers).
* **Security & Hardening**: Helmet HTTP headers, strict exact-match CORS, MongoDB injection sanitization (`validateStrict`), ReDoS escape regex, magic-byte image validation via Sharp, rate-limiting, and auditable event logging.

---

## 2. Express Middleware Pipeline & Execution Order

Every incoming HTTP request traverses an exact 8-layer middleware pipeline before reaching route controllers:

```
[Incoming HTTP Request]
         │
         ▼
 1. Helmet Hardening           (Sets X-Content-Type-Options, CSP, HSTS; removes X-Powered-By)
         │
         ▼
 2. Body & Cookie Parsing      (express.json({ limit: '10kb' }) + cookieParser())
         │
         ▼
 3. NoSQL Injection Shield     (mongoSanitizeMiddleware: validates and rejects $, __proto__, constructor)
         │
         ▼
 4. Strict CORS Gatekeeper     (Exact allowlist matching against FRONTEND_URL & dev origins; blocks evil origins)
         │
         ▼
 5. CSRF & Origin Validation   (validateOriginAndCsrf: verifies Origin/Referer and double-submit CSRF cookie)
         │
         ▼
 6. Rate Limiters              (globalLimiter, loginLimiter [5 req/window], registerLimiter, sensitiveActionLimiter)
         │
         ▼
 7. Route Handlers & Guards    (protect, requireVerifiedEmail, authorize, validateObjectId, upload/imageProcessor)
         │
         ▼
 8. Centralized Error Handler  (errorHandler: formats Multer/Mongoose errors, logs audit events, hides stack traces)
```

### Detailed Middleware Specifications
1. **Helmet Hardening (`server.js`)**:
   - Injects `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, and `Strict-Transport-Security`.
   - Explicitly removes `X-Powered-By` header to mitigate technology fingerprinting.
2. **NoSQL & Prototype Pollution Protection (`utils/sanitizeMongoInput.js`)**:
   - Operates in `validateStrict` mode on `req.body`, `req.query`, and `req.params`.
   - Rejects payloads containing keys prefixed with `$` (`$gt`, `$ne`, `$where`, `$regex`, `$expr`) or prototype pollution keys (`__proto__`, `constructor`, `prototype`). Returns `400 Bad Request` with `{ message: "Invalid request input." }`.
3. **CORS Gatekeeper (`server.js`)**:
   - Strictly enforces exact-match verification against configured URLs (`FRONTEND_URL`, `LOCAL_FRONTEND_URL_1`, `LOCAL_FRONTEND_URL_2`).
   - Suffix/wildcard matches are blocked. Unauthorized origins are rejected with `403 Forbidden` and logged under audit action `CORS_REQUEST_BLOCKED`.
4. **CSRF & Origin Verification (`middleware/csrf.js`)**:
   - Enforced on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Extracts request origin from `Origin` or `Referer` headers and asserts allowlist membership.
   - Validates that `req.headers['x-csrf-token']` matches `req.cookies.csrfToken` using constant-time string comparison (`crypto.timingSafeEqual`).
   - Bootstrap paths (`/api/auth/login`, `/api/auth/register`, `/api/admin/login`, `/api/auth/verify-email`) bypass CSRF checks to establish new sessions.
   - Denials return `403 Forbidden` with `{ message: "Invalid or missing CSRF token" }` and log `CSRF_VALIDATION_FAILED`.
5. **Rate Limiting (`middleware/rateLimiters.js`)**:
   - `loginLimiter`: Caps failed attempts to 5 per 15-minute window per IP. Exceeding returns `429 Too Many Requests` and logs `LOGIN_RATE_LIMIT_EXCEEDED`.
   - `registerLimiter`: Prevents automated account creation spam.
   - `sensitiveActionLimiter`: Restricts password changes, profile updates, and account deletions.
6. **Authentication & Token Revocation (`middleware/authMiddleware.js`)**:
   - `protect`: Extracts JWT from `token` cookie or `Authorization: Bearer <token>`. Decodes payload, checks database user existence, and asserts `decoded.tokenVersion === user.tokenVersion`. Revoked or mismatched tokens return `401 Unauthorized` (`USER_TOKEN_REVOKED`).
   - `requireVerifiedEmail`: Asserts `req.user.isVerified === true`. Unverified users attempting state changes are blocked with `403 Forbidden` (`UNVERIFIED_EMAIL_BLOCKED`).
   - `authorize(...roles)`: Restricts routes to specified roles (`admin`, `faculty`). Unauthorized roles receive `403 Forbidden` (`ROLE_AUTHORIZATION_DENIED`).
   - `protectAdmin`: Validates that `req.user.role === 'admin'`. Blocked attempts log `ADMIN_ACCESS_DENIED`.
7. **Parameter Validation (`middleware/validateObjectId.js`)**:
   - Validates that MongoDB `:id` or named parameters match `/^[0-9a-fA-F]{24}$/`.
   - Rejects malformed IDs with `400 Bad Request` (`Invalid ID format`), preventing Mongoose `CastError` leaks.
8. **Magic-Byte Upload Inspection (`middleware/imageProcessor.js`)**:
   - Limits file size to 5MB (via Multer memory storage).
   - Inspects the raw buffer magic bytes:
     - JPEG: `FF D8 FF`
     - PNG: `89 50 4E 47`
     - WebP: `52 49 46 46 ... 57 45 42 50`
   - Re-encodes uploaded images to WebP via Sharp, strips EXIF/metadata, and constrains max width to 2000px.
   - Rejects spoofed scripts (e.g. PHP scripts disguised as `.jpg`) with `400 Bad Request`.

---

## 3. Core Database Entities & Schemas

### 3.1 User (`server/models/User.js`)
* `name`: String (Required, trimmed).
* `email`: String (Required, unique, lowercase, trimmed).
* `password`: String (Required, bcrypt hash, minlength 8, `select: false`).
* `role`: String enum `['user', 'faculty', 'admin']` (Default: `'user'`).
* `department`: String (Nullable, for faculty routing).
* `tokenVersion`: Number (Default: `0`, `select: false` — used for global session invalidation).
* `isVerified`: Boolean (Default: `false`).
* `emailVerificationToken`: String (SHA-256 hashed, `select: false`).
* `emailVerificationTokenExpires`: Date (`select: false`).
* `pendingEmail`: String (Nullable, stores staged email updates).
* `pendingEmailToken`: String (SHA-256 hashed, `select: false`).
* `pendingEmailTokenExpires`: Date (`select: false`).

### 3.2 Item (`server/models/Item.js`)
* `title`: String (Required).
* `description`: String (Required).
* `category`: String (Required).
* `type`: String enum `['lost', 'found']` (Required).
* `location`: String (Required).
* `date_occurred`: String (Required).
* `image_url`: String (Nullable).
* `contact_email`: String (Required, private).
* `contact_phone`: String (Nullable, private).
* `postedBy`: ObjectId -> `User` (Required).
* `status`: String enum `['pending', 'resolved']` (Default: `'pending'`).
* `is_resolved`: Boolean (Default: `false`).
* `custodyStatus`: String enum `['not_handed_over', 'awaiting_confirmation', 'department_received', 'returned', 'rejected', 'recall_pending', 'ready_for_pickup']` (Default: `'not_handed_over'`).
* `custodyLocation`: String (Nullable).
* `custodyDepartment`: String (Nullable).
* `receiverName`: String (Nullable, private).
* `receiverRole`: String (Nullable, private).
* `handoverNotes`: String (Nullable, private).
* `handoverDate`: Date (Nullable).
* `isDisputed`: Boolean (Default: `false`).
* `disputeReason`: String (Nullable, private).
* `disputeProofUrl`: String (Nullable, validated HTTPS URL).
* `isHidden`: Boolean (Default: `false`).

### 3.3 Claim (`server/models/Claim.js`)
* `itemId`: ObjectId -> `Item` (Found item, Required).
* `lostItemId`: ObjectId -> `Item` (User's lost item, Required).
* `claimant`: ObjectId -> `User` (Required).
* `status`: String enum `['pending', 'approved', 'rejected', 'revoked']` (Default: `'pending'`).
* `claimType`: String enum `['automatic', 'manual_review']` (Default: `'automatic'`).
* `manualReasonType`: String (Nullable).
* `manualReasonText`: String (Nullable).
* `department`: String (Nullable).
* `verificationMethod`: String (Nullable).
* `verificationNotes`: String (Nullable).
* `retryCount`: Number (Default: `0`, max 1 resubmission allowed).
* `isPermanentlyRejected`: Boolean (Default: `false`).
* `reason`: String (Nullable, faculty rejection notes).
* **Indexes**: Unique compound index `{ itemId: 1, claimant: 1 }` (enforces exactly 1 active claim per user per found item).

### 3.4 Dispute (`server/models/Dispute.js`)
* `itemId`: ObjectId -> `Item` (Required).
* `challengerId`: ObjectId -> `User` (Required).
* `currentOwnerId`: ObjectId -> `User` (Required).
* `reason`: String (Required, trimmed).
* `proofUrl`: String (Nullable, validated HTTPS URL).
* `status`: String enum `['pending', 'recall_pending', 'ready_for_pickup', 'resolved', 'rejected']` (Default: `'pending'`).
* `adminNotes`: String (Nullable).

### 3.5 Notification (`server/models/Notification.js`)
* `userId`: ObjectId -> `User` (Required).
* `message`: String (Required).
* `type`: String (`'general'`, `'handover_denied'`, `'dispute_resolved'`, `'item_recovered'`).
* `itemId`: ObjectId -> `Item` (Nullable).
* `itemTitle`: String (Nullable).
* `disputeId`: ObjectId -> `Dispute` (Nullable).
* `isRead`: Boolean (Default: `false`).
* `priority`: String enum `['normal', 'high', 'urgent']` (Default: `'normal'`).

### 3.6 AuditLog (`server/models/AuditLog.js`)
* `actorId`: Mixed (ObjectId -> `User` or string system ID).
* `actorRole`: String enum `['user', 'faculty', 'admin', 'anonymous', 'system']`.
* `action`: String (Required).
* `category`: String enum `['AUTH', 'AUTHZ', 'ITEM', 'CLAIM', 'DISPUTE', 'ADMIN', 'SECURITY', 'UPLOAD']`.
* `severity`: String enum `['INFO', 'WARNING', 'CRITICAL']`.
* `targetType`: String (Nullable).
* `targetId`: Mixed (Nullable).
* `outcome`: String enum `['SUCCESS', 'FAILURE', 'BLOCKED']`.
* `ip`: String (Nullable).
* `statusCode`: Number (Nullable).
* `metadata`: Mixed (Strictly sanitized — keys like `password`, `token`, `jwt`, `cookie` are recursively stripped).
* `createdAt`: Date (Default: `Date.now`).
* **Indexes**: Indexed on `createdAt: -1`, `actorId: 1`, `action: 1`, `category: 1`, `targetType: 1`, `severity: 1`.

---

## 4. Item Custody Lifecycle & State Machine

The custody status of a found item represents its physical chain of custody across campus departments:

```
[Item Posted by Finder]
         │
         ▼
   not_handed_over
         │
         │ (Finder provides custody location/department details)
         ▼
 awaiting_confirmation
         │
         ├───► Faculty Denies Receipt ────► rejected (Hidden from search)
         │
         │ (Faculty verifies physical possession via PATCH /confirm-receipt)
         ▼
department_received ◄──────────────────────────────────┐
         │                                             │
         │ (Faculty/Admin approves Claim)              │
         ▼                                             │
      returned (Item marked resolved)                  │
         │                                             │
         │ (Challenger raises Dispute on returned item)│
         ▼                                             │
  recall_pending                                       │
         │                                             │
         │ (Item physically returned by previous owner)│
         ▼                                             │
 ready_for_pickup                                      │
         │                                             │
         │ (Challenger picks up item or new handover)  │
         ▼                                             │
      returned (Dispute resolved) ─────────────────────┘
```

### State Definitions & Guards
1. **`not_handed_over`**: Initial state for newly reported found items where the finder has not submitted department handover details.
2. **`awaiting_confirmation`**: Finder submitted details indicating the item was handed over to a faculty office or security desk.
3. **`department_received`**: Faculty member located in that department clicked **Confirm Receipt** (`PATCH /api/items/:id/confirm-receipt`). **Mandatory prerequisite for any claim submission.**
4. **`rejected`**: Faculty member verified that the item was never delivered (`PATCH /api/items/:id/deny-receipt`). Excluded from public search queries.
5. **`returned`**: Item physically handed over to a verified claimant. `status` becomes `'resolved'`, `is_resolved` becomes `true`, and `handoverDate` is stamped.
6. **`recall_pending`**: A dispute was approved by Admin/Faculty. An urgent return request notification is delivered to the previous recipient.
7. **`ready_for_pickup`**: Department verified physical return of recalled item (`PATCH /api/disputes/:id/confirm-return`). High-priority pickup notification sent to challenger.

---

## 5. Claim Processing & Resolution State Machine

Claims link a user's lost item listing to a department-verified found item.

```
                    [Claim Submission]
            (Automatic Match OR Manual Review)
                            │
                            ▼
                         pending
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
        rejected                         approved
            │                               │
    ┌───────┴───────┐                       ├──► Item status = resolved
    │               │                       ├──► Item custodyStatus = returned
    ▼               ▼                       ├──► Linked lost item = resolved
Permanent       Resubmitted                 └──► Competing pending claims = rejected
Rejection      (retryCount = 1)
                    │
                    ▼
                 pending
```

### 5.1 Claim Submission Rules
* **Prerequisites**:
  - Found item must exist, have `type: 'found'`, and `custodyStatus: 'department_received'`.
  - Found item cannot be `status: 'resolved'` or `is_resolved: true`.
  - Claimant cannot claim their own listing (`item.postedBy !== req.user._id`).
  - User cannot submit multiple claims for the same found item (enforced via unique compound index).
  - Claimant must possess an active lost item listing in the same category.
* **Automatic Matching (`POST /api/claims/:itemId`)**:
  - Evaluates similarity score between found item and claimant's eligible lost items using keyword extraction and synonym matching.
  - Automatically selects best matching lost item (`best.lost._id`).
* **Manual Review (`POST /api/claims/manual/:itemId`)**:
  - Allows claimant to select their lost item explicitly and provide `reasonType` (`distinctive_mark`, `serial_number`, `proof_of_purchase`, `other`) and `reasonText`.

### 5.2 Claim Approval (`PATCH /api/claims/:id/approve` or `:id/faculty-approve`)
* **Role Guard**: Faculty or Admin only.
* **Audit Inputs**: Requires non-empty `verificationMethod` and `verificationNotes`.
* **Database State Transitions (ACID Transaction)**:
  1. Claim status updated to `'approved'`, storing `verificationMethod` and `verificationNotes`.
  2. Found item: `status = 'resolved'`, `is_resolved = true`, `custodyStatus = 'returned'`, `handoverDate = new Date()`.
  3. Linked lost item: `status = 'resolved'`, `is_resolved = true`.
  4. All other pending claims for this `itemId`: Atomically set to `status = 'rejected'`, `reason = 'Item was successfully claimed by another user.'`, `isPermanentlyRejected = true`.
  5. Activity logs and audit events logged under `CLAIM_APPROVED`.

### 5.3 Claim Rejection & Resubmission
* **Rejection (`PATCH /api/claims/:id/reject`)**:
  - Sets `status = 'rejected'` and records faculty `reason`.
  - If `preventResubmit === true`: sets `isPermanentlyRejected = true`.
  - Associated lost item is marked `isHidden = true` to prevent automatic re-matching until reviewed.
* **Resubmission (`PATCH /api/claims/:id/resubmit`)**:
  - Permitted only if `claim.isPermanentlyRejected === false` and `(claim.retryCount || 0) < 1`.
  - Item must not already be in `returned` custody status.
  - Resets claim `status = 'pending'`, increments `retryCount` to 1, unhides lost item (`isHidden: false`), and logs `claim_submitted` (Attempt 2 of 2).

---

## 6. Dispute Resolution State Machine

Disputes occur when a rightful owner discovers their item was erroneously returned to another claimant.

```
       [Dispute Submitted on Returned Item]
                        │
                        ▼
                     pending
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
     rejected                   recall_pending
(Dispute closed;           (Recall initiated; Urgent
 owner retains item)        notification sent to owner)
                                       │
                                       │ (Item returned to department)
                                       ▼
                                ready_for_pickup
                                       │
                                       │ (Handover to challenger)
                                       ▼
                                   resolved
                        (Original claim revoked;
                         Challenger claim approved;
                         Item returned to challenger)
```

### 6.1 Dispute Submission (`POST /api/items/:id/dispute` or `/api/disputes`)
* **Guards**:
  - Target item must have `custodyStatus: 'returned'`.
  - Approved claim must exist for the item.
  - Current owner cannot dispute their own returned item (`currentOwnerId !== req.user._id`).
  - Challenger cannot create duplicate pending disputes for the same item.
  - `proofUrl` must be a valid `https://` protocol URL.
* **State Updates**:
  - Creates `Dispute` document with `status: 'pending'`.
  - Sets `item.isDisputed = true` and records `disputeReason` and `disputeProofUrl`.
  - Logs `DISPUTE_ESCALATED` audit event.

### 6.2 Dispute Resolution (`PATCH /api/disputes/:id/resolve`)
* **Role Guard**: Admin or Faculty.
* **Action: `'reject'`**:
  - `dispute.status = 'rejected'`.
  - `item.isDisputed = false`. Original claimant retains item.
* **Action: `'approve'` (Recall Initiation)**:
  - `dispute.status = 'recall_pending'`.
  - `item.custodyStatus = 'recall_pending'`, `item.isDisputed = false`.
  - Sends `urgent` priority notification to `currentOwnerId`: *"Urgent: The handover for [Item] has been successfully disputed. Please return this item to the department immediately."*
  - Sends `normal` notification to `challengerId`: *"Your Handover Dispute for [Item] has been approved. We have initiated a recall for the item."*

### 6.3 Physical Return Confirmation (`PATCH /api/disputes/:id/confirm-return`)
* **Guard**: Dispute must be in `'recall_pending'` status.
* **State Updates (ACID Transaction)**:
  - `dispute.status = 'resolved'`.
  - `item.custodyStatus = 'ready_for_pickup'`.
  - Sends `high` priority notification to `challengerId`: *"Your item has been recovered and is ready for pickup."*

### 6.4 Final Handover to Rightful Owner (`PATCH /api/items/:id/handover`)
* **Guard**: Item must be in `'ready_for_pickup'` custody status.
* **State Updates (ACID Transaction)**:
  1. Revokes original incorrect claim: `status = 'revoked'`, `reason = 'Claim revoked following dispute resolution and handover to rightful owner.'`.
  2. Finds challenger's claim and sets `status = 'approved'`, recording `verificationMethod` and `verificationNotes`.
  3. Updates linked challenger lost item to `status = 'resolved'`.
  4. Sets found item `custodyStatus = 'returned'`, `status = 'resolved'`, `is_resolved = true`, and timestamps `handoverDate`.
  5. Records `handover_completed` activity log and `DISPUTE_RESOLVED` audit log.

---

## 7. User Identity Prerequisites & Security Operations

### 7.1 Registration & Email Verification
1. User submits `name`, `email`, and `password`.
2. Password validated for complexity (8+ chars, upper, lower, number, special).
3. Plaintext password hashed via bcrypt (salt rounds = 10).
4. Generates raw cryptographic 32-byte hex token; stores SHA-256 hash in `emailVerificationToken` with a 24-hour expiration (`emailVerificationTokenExpires`).
5. Account initialized with `isVerified: false`.
6. Verification link containing raw token emailed to user.
7. Verification route (`GET /api/auth/verify-email?token=...`) matches hashed token, sets `isVerified: true`, clears verification fields, and issues authenticated session cookie.

### 7.2 Two-Step Re-Authentication & Email Change
1. Modifying profile email (`PUT /api/users/profile`) requires `currentPassword`.
2. Verifies current password using `bcrypt.compare`.
3. Checks email uniqueness across both `email` and `pendingEmail` fields.
4. Generates `pendingEmailToken` (SHA-256 hashed, 24h expiration) and stores candidate address in `pendingEmail`.
5. Primary `email` remains active and unchanged until verification link sent to `pendingEmail` is clicked.
6. Upon token confirmation, candidate address is promoted to `email`, `pendingEmail` fields are cleared, and `tokenVersion` increments to refresh credentials.

### 7.3 Password Change & Instant Session Invalidation
1. Route: `POST` or `PUT /api/users/change-password`.
2. Requires `currentPassword` and `newPassword`.
3. Validates complexity and asserts `currentPassword !== newPassword`.
4. Hashes new password and atomically increments `tokenVersion`:
   ```javascript
   user.password = hashedNewPassword;
   user.tokenVersion += 1;
   await user.save();
   ```
5. Clears old session cookies and issues new JWT and CSRF cookies.
6. Any concurrent sessions or stolen old JWTs are instantly rejected by `authMiddleware` on subsequent requests (`401 Unauthorized`).

### 7.4 Transactional Cascade Account Deletion
Triggered via `DELETE /api/users/profile` (or `/api/users/me`):
* **Guards**: Requires valid `currentPassword` and explicit confirmation.
* **ACID Transaction Execution Order**:
  1. Identifies all items posted by user (`userItemIds`).
  2. Extracts safe file paths of user item images for post-commit disk cleanup.
  3. Deletes all claims referencing user items (`itemId` or `lostItemId`).
  4. Deletes disputes involving the user (`challengerId`, `currentOwnerId`, or `itemId`).
  5. Resets `isDisputed: false` on foreign items challenged by this user if no other pending disputes remain.
  6. Deletes notifications associated with the user, user items, or user disputes.
  7. Anonymizes user activity logs: sets `userId = null`, `actorName = 'Deleted User'`, `actorEmail = 'deleted@campus.edu'`.
  8. Deletes all items posted by user (`Item.deleteMany({ postedBy: userId })`).
  9. Increments `tokenVersion` and deletes User document (`User.findByIdAndDelete(userId)`).
  10. Transaction commits.
  11. Post-commit: Physical image files on disk (`uploads/*.webp`) are unlinked.
  12. Auth and CSRF cookies are cleared from client.

---

## 8. Frontend React Navigation & Route Security Matrix

The client React application uses nested route guards to ensure zero unauthorized access:

| Route | Component | Route Guard / Wrapper | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `RootRedirect` | None (Public) | All | Inspects `useAuth()` state; dynamically redirects: Admin -> `/admin/dashboard`, Faculty -> `/faculty-dashboard`, User -> `/dashboard`, Unauthenticated -> `/login`. |
| `/login` | `Login` | Public | Unauthenticated | User login form; issues `token` and `csrfToken`. |
| `/register` | `Register` | Public | Unauthenticated | User registration with password complexity meter. |
| `/verify-email` | `VerifyEmail` | Public | All | Consumes `?token=...` query param; confirms account verification. |
| `/admin/login` | `AdminLogin` | Public | Unauthenticated | Dedicated administrative credentials gate. |
| `/admin/dashboard` | `AdminDashboard` | `ProtectedRoute allowedRoles={['admin']}` | Admin Only | Global overview stats, claim reviews, dispute arbitration, item override, audit logs. |
| `/faculty-dashboard`| `FacultyDashboard` | `ProtectedRoute allowedRoles={['faculty', 'admin']}` | Faculty & Admin | Department custody intake, claim approval/rejection, verification notes recording. |
| `/dashboard` | `Dashboard` | `ProtectedRoute allowedRoles={['user', 'faculty']}` | Authenticated | Public item search, category filters, similar item matches, recent handovers. |
| `/post`, `/report` | `PostItem` | `ProtectedRoute` -> `RequireVerification` | Verified Users | Create lost/found listings; requires active verified email. |
| `/item/:id` | `ItemDetails` | `ProtectedRoute` | Authenticated | Listing detail view, claim initiation, similar match inspector, dispute launcher. |
| `/edit-item/:id` | `ItemDetails` (Edit) | `ProtectedRoute` -> `RequireVerification` | Verified Owners | Modify item details and custody handoff information. |
| `/my-reports` | `MyReports` | `ProtectedRoute` -> `RequireVerification` | Verified Users | User dashboard of posted items, received claims, and submitted claims. |
| `/profile` | `Profile` | `ProtectedRoute` | Authenticated | Password change, two-step email update, account deletion. |
| `/community-activity`| `CommunityActivityPage` | None (Public) | All | Real-time audit-safe activity feed (anonymized PII). |

---

## 9. Comprehensive System State Transition Matrix

| Action / Event | Initiator | Pre-Condition | Entity | Old State | New State | Side Effects & Cascade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Registration** | Anonymous | Valid name, email, strong password | `User` | None | `isVerified: false` | Generates 24h verification token; sends verification email. |
| **Verify Email** | User | Valid token from email | `User` | `isVerified: false` | `isVerified: true` | Clears token fields; issues authenticated session cookies. |
| **Report Found Item** | Verified User | Verified email session | `Item` | None | `not_handed_over` | Persists item listing; processes uploaded image to WebP. |
| **Update Custody Location**| Finder | Item owner session | `Item` | `not_handed_over` | `awaiting_confirmation`| Saves `custodyLocation`, `custodyDepartment`, receiver info. |
| **Confirm Department Receipt**| Faculty | Member of department | `Item` | `awaiting_confirmation`| `department_received` | Logs `item_verified` activity; enables claim submission. |
| **Deny Department Receipt**| Faculty | Member of department | `Item` | `awaiting_confirmation`| `rejected` | Logs `handover_denied` activity; hides item from search. |
| **Submit Claim** | Verified User | Matching category lost item exists | `Claim` | None | `pending` | Evaluates similarity score; creates unique claim record. |
| **Approve Claim** | Faculty / Admin| `verificationMethod` & `notes` provided | `Claim`<br>`Item` | `pending`<br>`department_received`| `approved`<br>`returned` | Resolves item and lost item; auto-rejects competing claims; logs `CLAIM_APPROVED`. |
| **Reject Claim** | Faculty | Faculty role | `Claim` | `pending` | `rejected` | If `preventResubmit`: sets `isPermanentlyRejected: true`; hides lost item. |
| **Resubmit Claim** | Claimant | `isPermanentlyRejected: false`, retries < 1 | `Claim` | `rejected` | `pending` | Increments `retryCount` to 1; unhides lost item; logs attempt 2 of 2. |
| **Submit Dispute** | Claimant | Item `custodyStatus: 'returned'` | `Dispute`<br>`Item` | None<br>`isDisputed: false` | `pending`<br>`isDisputed: true` | Saves proof URL; flags item as disputed; logs `DISPUTE_ESCALATED`. |
| **Approve Dispute (Recall)**| Admin / Faculty| Valid dispute ID | `Dispute`<br>`Item` | `pending`<br>`returned` | `recall_pending`<br>`recall_pending` | Sends urgent return notification to owner; notifies challenger. |
| **Confirm Return of Recalled**| Admin / Faculty| Dispute in `recall_pending` | `Dispute`<br>`Item` | `recall_pending`<br>`recall_pending` | `resolved`<br>`ready_for_pickup` | Sends high-priority pickup notification to challenger. |
| **Handover to Rightful Owner**| Admin / Faculty| Item in `ready_for_pickup` | `Claim`<br>`Item` | Original: `approved`<br>Challenger: `pending` | Original: `revoked`<br>Challenger: `approved`<br>Item: `returned` | Completes transfer of recovered item; logs `handover_completed`. |
| **Change Password** | User | Valid `currentPassword` | `User` | Old password | New password | Increments `tokenVersion`; invalidates all previous sessions. |
| **Delete Account** | User | Valid `currentPassword` | `User` | Active User | Deleted | Transactional cascade: deletes claims, disputes, items; unlinks images; clears cookies. |
