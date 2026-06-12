# Security Specification for Firestore

This document defines the security boundaries, invariant rules, and defensive configurations applied to our Firestore database deployment.

## 1. Data Invariants

1. **Identity Integrity**: A user can only read, create, update, or delete their own user document `/users/{userId}` (where `userId == request.auth.uid`).
2. **Transaction Ownership**: A transaction document `/transactions/{transactionId}` can only be created if the payload's `userId` matches the authenticated user (`request.auth.uid`).
3. **Transaction Reading**: A user can only read or list transactions where `resource.data.userId == request.auth.uid`. No blanket reads are allowed.
4. **Transaction Deletion & Mutation**: A transaction can only be deleted or modified if it belongs to the authenticated user (`resource.data.userId == request.auth.uid`).
5. **No Spoofing**: Users cannot mutate or spoof identity fields (like `userId` or `id`) after creation.
6. **Value Boundaries**: Non-negative amounts on transactions, valid string formats, and limited sizes for category lists.

## 2. The "Dirty Dozen" Payloads (Denied States)

Here are 12 malicious payloads and query state modifications designed to breach security, all of which will have their write operations or list requests rejected by the Firestore Rules:

1. **Identity Spoofing in user Creation**: Authenticated user `user-abc` tries to write to `/users/user-xyz`.
2. **Self-Assigned Admin Escalation**: A user includes `"role": "admin"` or `"isAdmin": true` in their user profile to escalate privileges.
3. **Ghost Fields Injection**: An update payload contains un-whitelisted fields like `"{'ghostField': 'malicious_payload'}"` to bypass standard boundaries.
4. **Spoofing Transaction Owner**: Authenticated user `user-123` tries to save a transaction with `userId: "user-999"`.
5. **Blanket Query Scraping**: A client attempts to fetch semua transactions in the database without adding a `userId == current_user` filter in their query.
6. **Recursive Resource Exhaustion (Denial of Wallet)**: A client injects a ultra-long 1MB string into the transaction description to crash query indexing or consume storage capacity.
7. **Negative Cash Transaction**: Injecting a negative transaction amount (`amount: -1500000`) to manipulate account balances illegally.
8. **Altering Immortal Fields**: Attempting to alter the immutable `createdAt` timestamp of a historic transaction.
9. **Tampering with Status Fields**: Attempting to bypass validations and directly modify terminal results or metadata of other items.
10. **Hijacking Custom Categories of Another User**: Accessing and overwriting category lists of another user profile.
11. **Orphaned Sibling Records**: Attempting to write a transaction referencing a non-existent user profile.
12. **Malicious Special Characters ID Poisoning**: Trying to create a document with a malicious ID structure containing script tags or invalid Unicode.

## 3. Fortress Firestore Rules

To enforce these rules, we'll implement a `firestore.rules` containing precise ABAC rules.
The rules will mandate that all reads/writes are authenticated, verified via schema helpers, and strictly locked down to the owner.
