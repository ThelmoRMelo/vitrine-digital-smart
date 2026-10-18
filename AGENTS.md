
- Admin panel access uses one app password checked by the `admin-auth` function (hash in a table with no public access); the browser keeps only a signed session token. Why: no user accounts exist, and secrets must never reach the browser.
- Product chat verifies active catalog data through public permissions on every request; client prices and historical messages are never authoritative, because commercial facts can change.
- Generated welcomes are projected with current catalog facts in the public chat while stored messages stay untouched, because historical records must be preserved.
- Factual price replies and service contingency use the pure confirmed-products helper without advancing negotiation state, because failed AI calls must not imply a sale or discount.
