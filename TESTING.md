# Testing

The system employs comprehensive unit and integration tests using `vitest`.

## Running Tests

Run the test suite via the command line:

```bash
npm test
```

## Security Workflows Tested

1. **RBAC Logic:** `rbac.test.ts` covers explicit Allow/Deny scenarios, ensuring a `QUESTION_SETTER` cannot approve or release their own papers, and that `SECURITY_AUDITOR` is strictly read-only.
2. **Encryption:** `crypto.test.ts` validates that files are successfully transformed via AES-256-GCM.
3. **Integrity Checks:** Tampering the output buffer immediately triggers decryption failure during the GCM Auth Tag validation.
4. **Digital Signatures:** The application confirms ECDSA `prime256v1` signing functions block tampered finalized payloads.
5. **Time-based Lockouts:** Tested functionally through `releaseService.ts` which performs a server-side timestamp comparison before releasing decrypted bytes.

## Recommended E2E Testing Flow (Scenario 29)

To manually test the complete workflow:
1. Login as `SUPER_ADMIN`, create users.
2. Login as `EXAM_CONTROLLER`, create Examination.
3. Login as `QUESTION_SETTER`, upload PDF (observe encrypted state in DB).
4. Login as `REVIEWER`, approve paper.
5. Login as `EXAM_CONTROLLER`, finalize and schedule.
6. Login as `SECURITY_AUDITOR`, observe audit trail of all preceding actions.
7. Attempt download before release time -> *Expect 403 Forbidden*.
8. Wait until release time -> *Expect 200 OK* with decrypted valid PDF.
