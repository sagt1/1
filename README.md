# Shree Aditya Geo Tech — Reviewed Website Bundle

## Latest editor files incorporated
- `invoice-editor.html` is the exact newly uploaded `index (1)(2).html`, with a small post-save bridge added after its IndexedDB save succeeds.
- `survey-editor.html` is the exact newly uploaded `index(2).html`, with a post-save bridge added to its existing local draft save.
- `index.html` is the responsive Supabase login/dashboard shell from the previous bundle, updated to load the new editor filenames.
- `assets/company-logo.jpg` or `.png` is the supplied logo (whichever file was available).

## Supabase
Project URL: `https://tseqhefaktrokiikcumf.supabase.co`
Project ref: `tseqhefaktrokiikcumf` (`sagt-bms`).
The client uses the public publishable/anon key only. Do not place a service-role key in browser code.

## Admin onboarding
`shreeaditya2025@gmail.com` was queried in `auth.users` and no account was found. Create/invite this user in Supabase Authentication and verify the email first. Only then run `promote-shared-admin.sql` in SQL Editor. The two named administrators share the same account by choice; activity logs cannot tell them apart.

## Important verification status
This is a reviewed integration bundle, not a claim of 99% reliability or production certification. The editor files retain their own local IndexedDB/localStorage draft workflows. The shell posts editor save payloads to Supabase; however, the shell currently stores each bridged save as a new row rather than supporting a complete edit-in-place/reopen round trip. Test this behavior and your actual Supabase Auth/RLS setup before production use. Avoid relying on local drafts as cloud backups.

## Run locally
Serve over HTTP (not `file://`) because the app uses same-origin iframe messaging:
`python -m http.server 8080`
Then open `http://localhost:8080`.
