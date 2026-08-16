// Fixture for security-analysis tests. All secrets are FAKE (sk-test-*,
// AKIA-test-*, ghp_test-*) — deliberately formatted like real ones so the
// regex+entropy detector fires, but worthless as credentials. Never put a
// real secret here.

const API_KEY = "sk-test-abcdefghijklmnopqrstuvwxyz1234567890"; // fake
const AWS_KEY = "AKIATEST1234567890ABCD"; // fake AWS access key

const DB_PASSWORD = "P@ssw0rd-88#zQ!x2L"; // fake, must be flagged by generic-password rule

export function connect() {
  return {
    host: "db.internal.example.com",
    user: "app",
    // Inline allow marker below: the local-dev credential is intentional.
    password: "local-dev-only", // gitleaks:allow
  };
}

export function run() {
  // Unsafe pattern: dynamic code execution
  const result = eval("1 + 2");
  return { API_KEY, AWS_KEY, DB_PASSWORD, result };
}
