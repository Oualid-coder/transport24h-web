import { test } from "node:test"
import assert from "node:assert/strict"
import { priceChanged } from "../lib/price"

test("prix : comparaison au centime", () => {
  assert.equal(priceChanged(120, 120), false)
  assert.equal(priceChanged(120, 120.004), false)
  assert.equal(priceChanged(120, 120.01), true)
  assert.equal(priceChanged(0.1 + 0.2, 0.3), false)
})
