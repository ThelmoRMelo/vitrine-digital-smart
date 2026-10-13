
- Admin panel access uses one app password checked by the `admin-auth` function (hash in a table with no public access); the browser keeps only a signed session token. Why: no user accounts exist, and secrets must never reach the browser.
