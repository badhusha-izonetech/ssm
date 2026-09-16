# Runtime Verification — What Was Checked, What Was Fixed

This records the verification pass done after the previous handoff, which had only confirmed the
build compiles. This pass actually ran the app (`npm run build` + `vite preview`) and clicked
through the three flows that were previously unverified.

## 1. New employee → login → correct portal — PASSED, no changes needed

Logged in as CEO (`karthik.raja`), used the "Create Employee" modal to create a Field Technician
account, signed out, logged in as that new account. Landed correctly on the Field Technician
portal with the correct sidebar for that role, and no CEO-only controls ("Reset demo data",
"Create Employee") leaked into that session. Client-side validation (submit blocked when username
is empty) also behaves correctly.

## 2. CEO "Reset demo data" — PASSED, no changes needed

Triggered from the CEO's profile menu. Confirmed it clears all 22 `essolar:v1:*` localStorage keys,
reseeds them from `mockData.ts`, removes employees created after seed (the test employee from
flow 1 was gone afterward), and leaves the app in a working state — no blank screen, no crash.

## 3. Reload persistence — FAILED, root cause found, fixed

**Symptom:** Logged in as CEO, added a new lead via the "+ New Client" form, then did a genuine
hard browser reload (`page.reload()`, equivalent to hitting F5 — not client-side route navigation).
Expected: still on the Leads page, still logged in, new lead still visible. Actual: redirected to
`/login`, logged out.

This was **not** a data-loss bug — the new lead was still correctly sitting in
`localStorage['essolar:v1:leads']` the whole time (verified directly). The bug was in session
restoration, not persistence.

**Root cause:** in `frontend/src/auth/AuthContext.tsx`, `ProtectedRoute` reads `employee` from
`AuthContext` and redirects to `/login` synchronously on the very first render if it's `null`.
The saved session (`employee.id` in `localStorage['ssc-erp-session']`) was only being restored
inside a `useEffect`, which by React's timing runs *after* that first render commits. So on a hard
reload: first render → `employee` is `null` (initial state) → `ProtectedRoute` immediately
navigates to `/login` → *then* the `useEffect` runs and calls `setEmployee(...)`, but the router
has already left the protected route and there's no code path back. A classic init-order race
between a synchronous guard and an async restore.

**Fix:** moved the session restore out of the `useEffect` and into the `employee` state's lazy
initializer function — the same pattern the `employees` array itself already used
(`useState(() => loadState('employees', seedEmployees))`). Now the saved session is applied
*during* the first render, before `ProtectedRoute` ever evaluates `employee`.

```diff
- const [employee, setEmployee] = useState<Employee | null>(null)
  const [employees, setEmployees] = useState<Employee[]>(() => loadState('employees', seedEmployees))
+ const [employee, setEmployee] = useState<Employee | null>(() => {
+   if (typeof window === 'undefined') return null
+   const savedId = window.localStorage.getItem(STORAGE_KEY)
+   if (!savedId) return null
+   const list = loadState('employees', seedEmployees)
+   return list.find((e) => e.id === savedId) ?? null
+ })

  useEffect(() => { saveState('employees', employees) }, [employees])
- useEffect(() => {
-   const savedId = localStorage.getItem(STORAGE_KEY)
-   if (savedId) {
-     const emp = employees.find((e) => e.id === savedId)
-     if (emp) setEmployee(emp)
-   }
- }, [])
```

**Re-verified after the fix:**
- Hard reload as CEO on the Leads page: stays on `/leads`, session intact, new lead still present.
- Re-ran flow 1 (new employee create → login) — still passes.
- Re-ran flow 2 (reset demo data) — still passes.
- Hard reload as a non-CEO portal (Field Technician, `suresh.babu`) — also stays logged in and on
  the same page, confirming the fix isn't CEO-specific.

## Files changed

- `frontend/src/auth/AuthContext.tsx` — the fix above. Nothing else in the frontend was touched.

## Not changed / still open

The items from the original gap report that were marked "your call whether to fix" are unchanged:
- No separate per-module completion-report `.md` files (only code + this doc set).
- JS bundle is a single ~1MB chunk (not code-split). Cosmetic, not a spec violation.
- Login is still username-only, no password enforced server-side (the UI has a password field but
  `AuthContext.login()` never checks it) — flagged in `BACKEND_API.md`'s open questions, not
  something to silently fix since the real auth model is a backend decision.
