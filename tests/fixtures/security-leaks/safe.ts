// Negative control for security-analysis tests: no real secrets, no
// unsafe patterns, and no secret-shaped strings even inside comments.

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
