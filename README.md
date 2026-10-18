# Xenit Realty — GitHub / Vercel source
This is a standard Next.js application, not a static preview. The separate interactive preview route and its sample-only code are excluded from this download. Blue/white styling, a tenant portal, property editor with Copy link, and one application/payment review workspace are included. No credentials or browser demo data are included. Logo assets are in public/xenit-logo.svg, public/xenit-logo-white.svg and public/xenit-mark.svg.

## Backend setup (required before accepting users)
1. Create a NEW Supabase project. Run supabase/schema.sql once in the SQL Editor. It creates tables with RLS enabled, private receipt storage, notification triggers and transactional review functions. No tables are readable by anonymous or authenticated browser keys; this application's authorized server routes mediate access.
2. Enable email/password auth and email confirmation. Configure Supabase production SMTP for confirmation and password-reset emails. Set the Auth Site URL and allowed redirects to your deployment origin, /complete-profile and /reset-password. Retain the default confirmation email template using ConfirmationURL. Add localhost equivalents only for development.
3. Copy .env.example to .env.local for development; set the same values in Vercel Environment Variables before deployment.
4. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are browser-safe. SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and CRON_SECRET are server-only. Never put them into NEXT_PUBLIC variables, source code or GitHub.
5. Verify a sending domain with Resend. Set EMAIL_FROM and ADMIN_EMAIL. NEXT_PUBLIC_SITE_URL must be your full HTTPS origin without a trailing slash. Generate a strong random CRON_SECRET.

Missing configuration blocks account submissions explicitly. It does not simulate account creation, successful payments or email delivery.

## GitHub and Vercel
Use Node 22 or newer. Unzip, run npm install, then npm run build.
Create an empty GitHub repository and run from the project folder:

```sh
git init
git add .
git commit -m "Initial property portal"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Import that repository into Vercel, choose the Next.js preset and this folder as the root. Use npm run build and the default output directory. Add environment variables, deploy, then update the Supabase redirects to your final domain. Redeploy after changing NEXT_PUBLIC variables.

## Immediate admin email notifications
Create a Supabase Database Webhook for INSERT on public.notifications:
- Method: POST
- URL: https://YOUR-DOMAIN/api/notifications
- Header: Authorization: Bearer YOUR_CRON_SECRET

Account registrations, profile submissions/updates, submitted applications and payment receipts each create a transactional notification row. Draft saves also queue an admin notification. The webhook sends promptly; application endpoints also attempt delivery. Failures remain queued for the admin Retry queued emails button or the included daily Vercel cron. Missing email credentials never mark messages sent. Resend idempotency keys reduce duplicate sends within its idempotency window; this is at-least-once delivery, not guaranteed inbox placement. Monitor the provider logs.

Supabase SMTP handles user confirmation/reset emails; Resend handles admin submission notifications. Branded tenant approval emails include the next step for each approved submission.

## First administrator and properties
Create the administrator account in Supabase Auth → Users, confirm its email, and copy its UUID. Admins sign in at /admin/login; there is no admin signup page. Assign the role with:

```sql
insert into public.admins(user_id) values ('YOUR-VERIFIED-USER-UUID');
```

Open /admin to add real properties. Open /admin/applications for applicant details, decisions, receipts, payment approval and email status in one place. Roles cannot be self-assigned. Use HTTPS image URLs for property photos. Landlord/payee and mailing details are private. Lease term and security deposit are excluded from public property data.

No rentals are seeded publicly. The initial editor values and bundled photos are illustrative; replace them before launch. Set payment purpose/amount, payee and mailing address carefully. The site supports manual money-order/cashier-check receipt review, not bank or card processing. Uploading a receipt does not prove funds cleared.

## Included flows
- Email/password auth, verification, password reset and profile editing.
- Account-linked applications, saved drafts, server-generated reference codes, approval/decline and two-page downloadable approval PDFs.
- Private JPG/PNG/PDF payment receipts, mailing receipts and signed leases up to 3 MB; short-lived authorized download links.
- “Money order submitted for review” confirmation; Processing Payment status until an admin verifies and approves funds.
- Administrator approval or denial for mailing receipts. Approval marks the residence process Completed and unlocks the lease agreement.
- A generated Xenit Realty lease PDF, signed-lease upload and “Upload Successful” confirmation. Signed-lease submissions also queue an administrator email.
- Signed leases remain “Lease Under Review” until an administrator enters the first-month-rent plus security-deposit amount and approves the lease. That approval reveals the move-in payment and payment instructions to the tenant.
- Database transactions reject duplicate receipts and stale application decisions. A receipt locks out replacement uploads; corrections currently require administrator-supported backend handling.
- Audit records for application and payment decisions. Users only receive their own records; admin roles are checked server-side.

## Launch verification
Source typechecks and production builds are testable without secrets. Live Supabase/Resend integration tests were NOT run with a real account during handoff; you must complete these before launch:
- Test registration, verification, reset, profile, draft, application, decisions, PDF, receipt and payment approval with two tenant accounts and one admin.
- Verify tenants cannot access another tenant's records or files, non-admins cannot save properties/decisions, and email queue failures can be retried.
- Test mobile layout and keyboard navigation. Browser visual testing was unavailable in the build environment.
- Configure auth rate limits, monitoring, backups, retention/deletion and support procedures.
- Xenit Realty branding and SVG logos are included. Replace illustrative photos and supply contact details. Owner inquiry booking is not implemented.
- Application verification uses a restricted table and a private bucket. Only the last four SSN digits are collected. Admin-only document links expire after one minute. Files are limited to 700 KB each to keep the complete submission within hosting request limits.
- Have your privacy policy, screening consent, lease, and payment/refund terms reviewed before taking real applications or money. Approval PDFs are not signed leases; no state-specific legal deposit terms are invented here.

## Documentation
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/database/webhooks
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://vercel.com/docs/frameworks/full-stack/nextjs

## Mailing receipts, leases and logout
Tenant navigation includes Logout. Once an administrator approves a payment, Submit Mailing Receipt opens the tenant-specific mailing instructions and private JPG/PNG/PDF upload. Submission is recorded separately from payment proof and creates an admin email notification. The administrator can download, approve or deny it from the same application workspace.

After mailing-receipt approval, the tenant dashboard marks the process Completed and enables Lease Agreement. Tenants can download a generated agreement and upload the signed copy. The generated agreement is a general template; have the final terms reviewed for the property’s jurisdiction before launch.

For a NEW database, run the complete `supabase/schema.sql` only. If you already installed the earlier schema, run `supabase/migrations/20261017_mailing_receipts.sql`, `supabase/migrations/20261017_lease_workflow.sql`, and then `supabase/migrations/20261017_lease_payment_reveal.sql` once instead of rerunning the schema. Configure Supabase and Resend before accepting live submissions. The separate interactive preview demonstrates this same flow with sample data.

## First month rent and security deposit receipts
Existing installations: run `supabase/migrations/20261017_move_in_receipts.sql` after the lease payment reveal migration. New installations use the full schema.
The move-in payment page now uses the holding-fee instruction layout and accepts private JPG, PNG or PDF receipts (maximum 3 MB). It requires an approved signed lease and uses the administrator-revealed amount, never a client-submitted amount. Submissions queue an admin email and show “Money order submitted for review”.
The dashboard shows Processing Payment until an administrator approves the receipt in the application workspace. Approval shows Completed, Application Approved, Security Deposit: Waiting, First Month Rent: Waiting, and Mailing Receipt Under Review, as requested. This is receipt approval; it does not mark either balance settled or implement a later mailing/settlement step.

## October 18 workflow update
For an existing database run `supabase/migrations/20261018_verification_and_emails.sql` after all October 17 migrations. New databases use the complete schema.
Admin entry: `/admin/login` (login only). The tenant dashboard no longer has Browse residences; Find a home in navigation is disabled.
Every submission queues an admin email, including drafts, account/profile submissions, application, both payments, both mailing receipts, signed lease and access-card photo. Approval transitions queue a branded tenant email in the same database transaction. Emails use the authenticated account address and explain the next step. They contain no SSN digits or document attachments.
Set RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL (one or more comma-separated recipients) and NEXT_PUBLIC_SITE_URL. Keep the notification cron enabled; failures remain pending for retry with an idempotency key. The preview simulates emails only. Actual delivery requires configured credentials and a live test before launch.
Application form includes ID type, last four SSN digits, front/back ID, proof of income, utility bill, rental history, pets and certification/authorization. JPG/PNG IDs and JPG/PNG/PDF proofs are supported, 700 KB per file. Partial drafts retain existing documents; final submission requires all four. Sensitive fields are omitted from the general dashboard API.

## Single active administrator session
Run `supabase/migrations/20261018_admin_single_session.sql` after the verification/email migration on an existing database. New databases use the complete schema. Existing admins must log in again after this update.
Each administrator account has one active server-enforced login. Another device or browser session is blocked; it never replaces the first login. Multiple tabs in the same browser share the same session. Admin sessions expire 12 hours after login (not extended by activity), or sooner when the authentication session expires. Closing the browser does not release the lock; use Logout. Blocked sign-in attempts only sign out the rejected session.
Every authenticated workspace request from an admin validates the lock before accessing data or performing actions. Tenant sessions are unaffected. Simultaneous login claims are serialized by the database. The preview's admin login has a sample "active login on another device" switch to demonstrate the blocked state; only the configured production backend enforces this across devices.
If the original device is lost, a trusted Supabase operator can revoke that user's Auth sessions and then delete their row from `public.admin_sessions`. Do not expose this recovery operation in a public form.

## Access card JPG
Approved tenants can upload their photo and download a 1700 × 1000 JPG or print the card. Only the application reference appears beneath the name. The screen and JPG use the same card artwork. A property photo that blocks cross-origin export is replaced with the branded residence background in the JPG; the tenant photo and logo must load successfully. Preview downloads are visibly marked SAMPLE. No database migration is needed for this addition.

## Payment instruction pages
Holding-fee and move-in payments share the same numbered money-order instructions, private property payee/address, application-code memo, sender details and review notice. Both support click or drag-and-drop receipt selection (JPG/PNG/PDF, 3 MB). Payment amounts still come from the property holding fee or admin-approved lease amount. Existing notification, review and confirmation behavior is unchanged. No database migration is required for this layout update.

## Homepage video testimonials
Edit `app/testimonials.json` to replace the three video placeholders. For each card set `videoUrl` to a direct HTTPS MP4 link or a local `/videos/your-video.mp4` path (put local videos in `public/videos/`). Update `title`, `caption`, `poster`, and `posterAlt` for the real resident's approved testimonial. Leave `videoUrl` empty to show the clearly labelled “Video coming soon” placeholder. Videos use native playback controls, do not autoplay, and do not preload the video file. YouTube watch-page links are not direct MP4 URLs. Update the section intro in `app/home-with-testimonials.ts` when the real testimonials are ready. Both homepage and preview use these same files. No fake quotes or endorsements are included.
