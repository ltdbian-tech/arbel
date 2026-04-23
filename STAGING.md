# Arbel Staging / Release Workflow

This repo is **public production** (arbel.live). Every push to `master` ships immediately to real users. To avoid shipping breakage we run changes through a private staging repo first.

---

## One-time setup

### 1. Create the staging repo

1. Create a **private** GitHub repo: `ltdbian-tech/arbel-staging`
2. Push a copy of this workspace to it:
   ```powershell
   git remote add staging https://github.com/ltdbian-tech/arbel-staging.git
   git push staging master
   ```
3. In the staging repo's **Settings → Pages**: enable GitHub Pages from `master` branch, root folder
4. In **Settings → Manage access**: restrict to just your account (already private → default)
5. It will auto-publish to `https://ltdbian-tech.github.io/arbel-staging/generator/`

Optional: point a subdomain `staging.arbel.live` at the staging repo via Cloudflare:
- Add a CNAME record `staging` → `ltdbian-tech.github.io`
- In staging repo add `CNAME` file containing `staging.arbel.live`

### 2. Create a staging GitHub OAuth app

Production uses one OAuth app. Staging needs its own so a buggy staging worker can't corrupt production users' tokens.

1. github.com → Settings → Developer settings → OAuth Apps → **New OAuth App**
2. Name: `Arbel Staging`
3. Homepage URL: `https://ltdbian-tech.github.io/arbel-staging/generator/` (or `https://staging.arbel.live/generator/`)
4. Authorization callback URL: same as above, plus the auth callback path
5. Save the **Client ID** and generate a **Client Secret**

### 3. Deploy a staging auth worker

```powershell
cd worker/arbel-auth
# Copy wrangler.toml → wrangler.staging.toml and change:
#   name = "arbel-auth-staging"
#   Add 'https://ltdbian-tech.github.io' and 'https://staging.arbel.live' to ALLOWED_ORIGINS in src/index.js (already there for the github.io domain)
npx wrangler deploy --config wrangler.staging.toml
# Set staging secrets (from the staging OAuth app):
npx wrangler secret put GITHUB_CLIENT_ID --config wrangler.staging.toml
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.staging.toml
```

In the staging repo only, edit `generator/js/auth.js` to point at `arbel-auth-staging.*.workers.dev` instead of the production worker URL. Keep this change isolated to the staging repo — **never commit it to the public repo**.

---

## Day-to-day release workflow

```
┌─────────────────────────────────────────────────────────────┐
│  feature branch (local)                                     │
│    │                                                         │
│    ├──► push to STAGING repo master                          │
│    │    → deploys to staging.arbel.live in ~30s              │
│    │    → you test: sign-in, deploy a test site, randomize+AI│
│    │                                                         │
│    └──► when green, push to PRODUCTION repo master           │
│         → deploys to arbel.live                              │
└─────────────────────────────────────────────────────────────┘
```

### Git setup

From this workspace (already pointed at production):

```powershell
# One-time: add the staging remote alongside production (origin)
git remote add staging https://github.com/ltdbian-tech/arbel-staging.git

# Day-to-day after making changes:
git add -A
git commit -m "feat: whatever"

# 1. Push to STAGING first
git push staging master

# 2. Open staging.arbel.live, smoke-test the change
#    - Sign in with GitHub
#    - Generate + deploy a throwaway site
#    - Reopen it via MY SITES
#    - Randomize+AI, verify no regressions
#    - Sign out both ways (keep keys / clear keys)

# 3. If all good, push to PRODUCTION
git push origin master
```

### Release checklist (run before every push to origin)

- [ ] `node generator/test/run_tests.js` → **186/186 pass**
- [ ] Cache-buster in `generator/index.html` bumped (e.g. `v=20260423l` → `v=20260423m`)
- [ ] Staging smoke test completed
- [ ] No `contactEmail`, no AI keys, no tokens in staged files (`git diff --cached` scan)
- [ ] Commit message explains *what* and *why*

---

## Rollback

If a production push breaks the site:

```powershell
# Revert the last commit and push immediately
git revert HEAD --no-edit
git push origin master
# Site is back in ~30s (GitHub Pages rebuild)
```

For worker issues (`arbel-auth` / `arbel-admin`):

```powershell
cd worker/arbel-auth
npx wrangler rollback      # rolls to the previous deployed version
```

---

## Later: migrate to Cloudflare Pages (optional, better UX)

When you have real users:

- Move generator hosting to **Cloudflare Pages** (connect the GitHub repo)
- Every pull request gets a unique preview URL automatically (`pr-42.arbel-generator.pages.dev`)
- Merge to `main` → production deploy
- One-click rollback from Cloudflare dashboard
- Free tier: 500 builds/month, unlimited bandwidth

That removes the need for a separate staging repo, but adds a migration cost (~a day). Fine to defer until you outgrow the two-repo flow.

---

## Quick reference

| Environment  | Repo                                | URL                                    | Auth worker           |
|--------------|-------------------------------------|----------------------------------------|-----------------------|
| Production   | `ltdbian-tech/arbel` (public)       | `arbel.live`                           | `arbel-auth`          |
| Staging      | `ltdbian-tech/arbel-staging` (priv) | `staging.arbel.live` or `*.github.io`  | `arbel-auth-staging`  |
