// Redirection ouverte après connexion : seuls les chemins internes sont acceptés
import { test } from "node:test"
import assert from "node:assert/strict"
import { safeRedirectPath } from "../lib/safe-redirect"

test("redirect : chemins internes acceptés", () => {
  assert.equal(safeRedirectPath("/dashboard"), "/dashboard")
  assert.equal(safeRedirectPath("/booking?id=1"), "/booking?id=1")
  assert.equal(safeRedirectPath("/admin/dashboard#x"), "/admin/dashboard#x")
  assert.equal(safeRedirectPath("/"), "/")
})

test("redirect : cas d'attaque refusés", () => {
  const attacks: unknown[] = [
    "//evil.example",
    "//evil.example/login",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/..//evil.example",
    "/./%2e%2e//evil.example",
    "https://evil.example",
    "http:evil.example",
    "javascript:alert(1)",
    " /dashboard",
    "evil.example",
    "",
    "/" + "a".repeat(3000),
    42,
    null,
    undefined,
    ["/dashboard"],
  ]
  for (const v of attacks) {
    const r = safeRedirectPath(v)
    assert.ok(r === null || (r.startsWith("/") && !r.startsWith("//")), `${String(v)} → ${r}`)
    // Résolu dans le navigateur, le résultat reste sur l'origine du site
    if (r !== null) assert.equal(new URL(r, "https://transport24h.example").origin, "https://transport24h.example")
  }
  for (const v of ["//evil.example", "/\\evil.example", "/\t/evil.example", "https://evil.example", "/..//evil.example", 42]) {
    assert.equal(safeRedirectPath(v), null, String(v))
  }
})
