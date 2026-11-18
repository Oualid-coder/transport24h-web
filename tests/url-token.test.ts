import { test } from "node:test"
import assert from "node:assert/strict"
import { withoutQueryParam } from "../lib/url-token"

test("jeton retiré de l'URL, le reste conservé", () => {
  assert.equal(withoutQueryParam("/verify-email?token=abc", "token"), "/verify-email")
  assert.equal(withoutQueryParam("/accept-invitation?x=1&token=abc#h", "token"), "/accept-invitation?x=1#h")
  assert.equal(withoutQueryParam("/verify-email", "token"), "/verify-email")
  assert.equal(withoutQueryParam("/verify-email?token=a%2Bb&token=c", "token"), "/verify-email")
})
