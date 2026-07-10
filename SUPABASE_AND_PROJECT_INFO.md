# AFIT CBT Simulator — Supabase & Project Info

_Auto-generated reference document. Contains all Supabase credentials, table schemas, RPC functions, auth methods, external APIs, and GitHub repository details found in this codebase._

---

## 🗄️ Supabase Connection Credentials

| Key | Value |
|---|---|
| **Project URL** | `https://kvlishlwkxdnlbatepsr.supabase.co` |
| **Project Ref ID** | `kvlishlwkxdnlbatepsr` |
| **Anon (Public) Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGlzaGx3a3hkbmxiYXRlcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjMxNjIsImV4cCI6MjA5NTEzOTE2Mn0.tcl14-RfH6C_04gOm8T_cu9PlEFOmWM_BxD0PVIoXHQ` |
| **Key Type** | Anon (browser-safe, public) |
| **Key Issued** | May 13, 2025 |
| **Key Expires** | May 11, 2036 |

> The key is hardcoded in `static/app.js` and `site/static/app.js`. It is safe to be public because it is an anon key — your Row Level Security (RLS) policies in Supabase control what users can actually read or write with it.

---

## 📋 Database Tables (4 total)

### `profiles`
Stores one row per registered user. Created/updated during the bio-data onboarding flow.

| Column | Type / Notes |
|---|---|
| `id` | UUID — mirrors `auth.users.id` (Supabase Auth) |
| `email` | User's email address |
| `full_name` | Set during bio-data onboarding |
| `phone_number` | Bio-data form input |
| `program_type` | e.g. "Undergraduate" |
| `course_applied` | e.g. "Engineering", "International Relations", "Accounting" |
| `state_of_origin` | Bio-data form input |
| `jamb_score` | Integer — used in aggregate score calculation (`jamb_score / 8 + exam_score`) |
| `role` | `null` (student), `'jnr-admin'`, or `'admin'` |
| `has_paid` | Boolean — `false` by default; set to `true` after Paystack payment webhook fires |
| `tests_taken` | Integer (legacy counter — actual test count is derived from the `results` table) |
| `current_session_token` | Cryptographically secure token — used for single-device lockout |
| `ghost_mode` | Boolean, default `false`. **Requires manual migration — see below.** When `true`: user is excluded from every listing/search query in `admin/`, `premium-grant/`, and `db-explorer/`; their `email` is cleared; they keep logging in and using their existing access normally. Managed from `premium-grant/index.html` → "Ghost Mode". Once ghosted, find them again only via exact User ID search. |

#### ⚠️ Required one-time migration for Ghost Mode
Run this once in the Supabase SQL editor (Dashboard → SQL Editor) — it has not been run automatically because this app has no DB/migration access, only the anon key:

```sql
alter table profiles add column if not exists ghost_mode boolean not null default false;
```

Until this column exists, the Ghost Mode buttons in `premium-grant/index.html` will fail with a "column ghost_mode does not exist" error. All other features (grant/revoke premium, admin roles, delete user) work without it.

---

### `questions`
The live, admin-approved question bank that all users are tested from.

| Column | Notes |
|---|---|
| `id` | Auto-increment integer |
| `subject` | e.g. `'english'`, `'physics'`, `'mathematics'`, `'economics'`, `'literature'`, `'government'`, `'commerce'`, `'gns'` |
| `question_text` | The full question body |
| `option_a` | Answer choice A |
| `option_b` | Answer choice B |
| `option_c` | Answer choice C |
| `option_d` | Answer choice D |
| `correct_answer` | One of `'a'`, `'b'`, `'c'`, `'d'` |
| `short_id` | Unique string ID — used for admin edits and deduplication checks |
| `year` | Year the question originated from (sourced from the ALOC API) |

---

### `staging_questions`
A temporary holding area. The admin pulls questions from the ALOC API into here, reviews each one, then approves them into the live `questions` table. Has the same column structure as `questions`.

**Workflow:**
1. Admin opens `admin-staging/index.html`
2. Pastes ALOC API token and selects a subject
3. App fetches 40 questions from `https://questions.aloc.com.ng/api/v2/q/40?subject=…`
4. New (non-duplicate) questions are inserted into `staging_questions`
5. Admin reviews each question and clicks "Approve & Move" → row moves from `staging_questions` → `questions`
6. Admin can also edit `correct_answer` for any question before approving

---

### `results`
One row is inserted per exam submission (both normal submit and malpractice auto-submit).

| Column | Notes |
|---|---|
| `id` | Auto-increment integer |
| `student_id` | FK → `profiles.id` |
| `total_score` | Sum of all subject scores (out of 50) |
| `english_score` | Score out of 10 |
| `gns_score` | Score out of 10 (General Nigerian Studies) |
| `math_score` | Score out of 10 |
| `physics_score` | Score out of 10 |
| `chemistry_score` | Score out of 10 |
| `economics_score` | Score out of 10 |
| `literature_score` | Score out of 10 |
| `government_score` | Score out of 10 |
| `commerce_score` | Score out of 10 |
| `submitted_at` | ISO 8601 timestamp of submission |

---

## ⚙️ RPC (Stored) Functions

### `get_random_questions(subj_param text, lim_param int)`
A PostgreSQL stored function defined in your Supabase SQL editor.  
Returns `lim_param` random rows from the `questions` table where `subject ILIKE '%subj_param%'`.  
Used by `exam-room/index.html` to randomize questions for every exam attempt.

**Called as:**
```js
supabaseClient.rpc('get_random_questions', { subj_param: 'physics', lim_param: 10 })
```

> ⚠️ If this function is ever deleted from Supabase, the exam room will silently return no questions. Always keep it.

---

## 🔐 Supabase Auth Methods Used

| Method | Called From | Purpose |
|---|---|---|
| `auth.signInWithOtp({ email })` | `login/index.html` | Sends an 8-digit OTP code to the user's email |
| `auth.verifyOtp({ email, token, type })` | `login/index.html` | Verifies the OTP — tries types `email`, `magiclink`, `signup` in sequence |
| `auth.getSession()` | Every protected page on load | Checks if user is logged in; redirects to login if not |
| `auth.getUser()` | `profile/index.html` | Gets current user object |
| `auth.signOut()` | Sidebar logout button (all pages) | Signs out and clears session token from DB |

**Auth type:** Email OTP only. No passwords, no OAuth (Google, GitHub, etc.).  
**OTP length:** 8 digits (configured in Supabase Auth settings → Email OTP Length).

---

## 📦 Supabase Storage

**None used.** No Storage buckets exist in this project. All static assets (logos, icons) are served directly from the `static/img/` folder in the repo.

---

## 🔗 External APIs & Services

| Service | Key / Endpoint | Usage |
|---|---|---|
| **Paystack** | `pk_live_f1ca0bad0d6913267fb525e6c58cd2c447a1ae29` | Inline payment popup — charges ₦1,050 for full access. Webhook must set `profiles.has_paid = true` after successful payment. |
| **ALOC Questions API** | `https://questions.aloc.com.ng/api/v2/q/40?subject=…` | Admin staging page pulls 40 questions per batch. Requires an API token pasted manually into the admin UI (stored in `localStorage` as `aloc_key`). |
| **Google Fonts** | `fonts.googleapis.com` | Poppins font (weights 400–800) used across all pages |
| **html2canvas** (CDN) | `cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` | Used on `result/index.html` to generate a downloadable/shareable score card image |
| **Supabase JS SDK** (CDN) | `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` | Loaded on every page via CDN script tag |

---

## 📂 Files Where Supabase Credentials Are Hardcoded

```
static/app.js              ← primary shared script (root-level pages)
site/static/app.js         ← copy used by site/ folder pages
login/index.html           ← has its own inline supabase init as a fallback
admin-staging/index.html   ← has a placeholder comment (PASTE_YOUR_SUPABASE_URL_HERE)
```

> The `admin-staging` page checks if `supabaseClient` is already defined (from `app.js`) before creating a new one. If `app.js` loaded successfully, the placeholder in `admin-staging` is never used.

---

## 🐙 GitHub Repository

### This Project
| Property | Value |
|---|---|
| **Repository** | `https://github.com/daviddchucks-hash/Afit` |
| **GitHub Pages URL** | `https://daviddchucks-hash.github.io/Afit/` |
| **Branch** | `main` (only branch — no `gh-pages`) |
| **Visibility** | Public |
| **Deployment** | GitHub Pages reads directly from `main` branch |

GitHub Pages serves the site from the root of `main`. There is no CNAME file, no Netlify config, no Vercel config, and no Firebase config — GitHub Pages is the only hosting platform.

### Other Repos on This Account (Not Connected to AFIT)

| Repository | URL |
|---|---|
| Ai-builder | https://github.com/daviddchucks-hash/Ai-builder |
| Baby-shower-pics | https://github.com/daviddchucks-hash/Baby-shower-pics |
| Battery- | https://github.com/daviddchucks-hash/Battery- |
| Battery-percent- | https://github.com/daviddchucks-hash/Battery-percent- |
| Batteryy | https://github.com/daviddchucks-hash/Batteryy |
| Beast | https://github.com/daviddchucks-hash/Beast |
| Camera-hack | https://github.com/daviddchucks-hash/Camera-hack |
| Car-racing- | https://github.com/daviddchucks-hash/Car-racing- |
| Card-Generator- | https://github.com/daviddchucks-hash/Card-Generator- |
| Church-website | https://github.com/daviddchucks-hash/Church-website |
| Church-website- | https://github.com/daviddchucks-hash/Church-website- |
| Cooking-site | https://github.com/daviddchucks-hash/Cooking-site |
| Drexora- | https://github.com/daviddchucks-hash/Drexora- |
| Hackcam | https://github.com/daviddchucks-hash/Hackcam |
| Heavens-bake | https://github.com/daviddchucks-hash/Heavens-bake |
| Ip-tracker- | https://github.com/daviddchucks-hash/Ip-tracker- |
| Lookup | https://github.com/daviddchucks-hash/Lookup |
| Test | https://github.com/daviddchucks-hash/Test |
| Tracker- | https://github.com/daviddchucks-hash/Tracker- |
| WhatsAppclone | https://github.com/daviddchucks-hash/WhatsAppclone |

None of the above repos share code, credentials, or deployment with the AFIT project.

---

## 🏗️ Quick Reference: Where Each Page Gets Its Data

| Page | Tables Read | Tables Written |
|---|---|---|
| `login/index.html` | `profiles` (role, full_name) | `profiles` (current_session_token) |
| `bio-data/index.html` | — | `profiles` (insert or update all fields) |
| `dashboard/index.html` | `profiles`, `results` | — |
| `exam-room/index.html` | `profiles`, `results` (count), `questions` (via RPC) | `results` (insert on submit) |
| `exams/index.html` | `profiles`, `results` | — |
| `result/index.html` | `localStorage` (cbt_recent_exam) | — |
| `profile/index.html` | `profiles` | — |
| `admin/index.html` | `profiles`, `results` | `profiles` (has_paid, role) |
| `admin-staging/index.html` | `profiles`, `questions`, `staging_questions` | `staging_questions` (insert), `questions` (insert), `staging_questions` (delete) |
