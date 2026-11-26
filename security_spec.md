# Security Specification & Payload-First TDD

## 1. Data Invariants

1. **User PII Isolation**: `/users/{userId}` is strictly owned by `userId` (`request.auth.uid == userId`). No user can read or list another user's private `/users/{userId}` document.
2. **Strict Company Isolation**: Every company resource (`/companies/{companyId}/...`) requires active membership in `/companies/{companyId}/members/{request.auth.uid}` with `status == 'active'`. A member of Company A can never read, list, create, update, or delete resources in Company B.
3. **No Self-Assigned Roles or Privilege Escalation**: A user cannot create or modify their own `role` in `/companies/{companyId}/members/{uid}` to elevate privileges, nor create a `/users/{uid}/memberships/{companyId}` record unless `/companies/{companyId}/members/{uid}` exists or is created atomically in the same batch via company ownership or a valid `pending` invitation matching `request.auth.token.email`.
4. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
5. **Server-Enforced Timestamps & Immutable Ownership**: `createdAt` must equal `request.time` on creation and never change on update. `updatedAt` must equal `request.time` on both creation and update. `ownerId`, `createdBy`, `companyId`, and `authorId` are immutable after creation.
6. **Configurable Role Permissions**: Every protected company operation (managing settings, departments, members, invitations, tasks, reports) checks the caller's assigned role document in `/companies/{companyId}/roles/{roleDocId}`.
7. **Visitor Scoping**: Visitors (`role == 'Visitor'`) can only read projects/tasks marked accessible to them (`visitorVisible == true` or `projectId in allowedProjectIds`) and cannot read company audit logs, role configs, or internal reports unless explicitly permitted.
8. **Immutable Audit & Task History**: `auditLogs` and `history` documents are append-only (`allow update, delete: if false`).
9. **Strict Key & Size Bounds**: Every collection enforces `keys().hasAll(...)` + `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, and `.size()` caps on every string and array.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Cross-Tenant Task Read/Write**: User from Company A attempts to create/read `/companies/company-b/tasks/task-1`. Expected: `PERMISSION_DENIED`.
2. **Self-Promotion Role Escalation**: Employee in Company A attempts to update `/companies/company-a/members/{ownUid}` with `role: "Super Administrator"`. Expected: `PERMISSION_DENIED`.
3. **Forged Membership Without Invitation**: Outsider attempts to create `/companies/company-a/members/{outsiderUid}` without a matching pending invitation. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection on Task Create**: Member attempts to create a task with an undeclared field `isApprovedByAdmin: true`. Expected: `PERMISSION_DENIED`.
5. **Unverified Email Write Attempt**: Newly registered unverified email/password user (`email_verified: false`) attempts to create a company. Expected: `PERMISSION_DENIED`.
6. **ID Poisoning**: Attacker attempts to write to `/companies/company-a/tasks/<1500-char-invalid-id!@#>` bypassing `^[a-zA-Z0-9_-]+$`. Expected: `PERMISSION_DENIED`.
7. **Client-Forged Timestamp**: User submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` (`serverTimestamp()`). Expected: `PERMISSION_DENIED`.
8. **Audit Log Tampering**: Company Admin attempts to `update` or `delete` an entry in `/companies/company-a/auditLogs/{logId}`. Expected: `PERMISSION_DENIED`.
9. **Comment Author Spoofing**: Employee posts a comment in `/companies/company-a/tasks/t1/comments/c1` with `authorId: "<managerUid>"`. Expected: `PERMISSION_DENIED`.
10. **PII Harvesting via User Directory**: Authenticated user attempts `get` or `list` on `/users/{otherUserId}`. Expected: `PERMISSION_DENIED`.
11. **Invitation Hijacking**: User B (`bob@example.com`) attempts to accept an invitation addressed to `alice@example.com`. Expected: `PERMISSION_DENIED`.
12. **Terminal Task Modification by Non-Admin**: Employee attempts to update a `Completed` task's `title` or `assigneeId` without administrative override permission. Expected: `PERMISSION_DENIED`.
