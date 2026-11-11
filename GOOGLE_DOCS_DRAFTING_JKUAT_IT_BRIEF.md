# Accord 360 — Google Docs Drafting Integration: JKUAT IT Brief

*As of 2026-09-27*

Accord 360's drafting stage is being rebuilt to hand researchers a live, editable Google Doc instead of a merged .docx file. To finish testing this before go-live, and to run it in production, we need a small, specific set of access grants from JKUAT IT — not admin access to the Workspace, and not the ability to act as any user in it.

## What we're building

Today, when a researcher starts a collaboration, Accord 360 stops generating and merging a `.docx` file. Instead it:

1. Copies a Linkages-maintained master Google Doc template.
2. Shares that copy with the researcher and the external partner as editors, so they draft together.
3. When the researcher hits **Submit**, the partner's access to that one Doc is revoked immediately, and Linkages and Legal staff are granted access instead.
4. Legal's review comments live natively in the Doc (Google's own comment threads), not in Accord 360.
5. The only file Accord 360 ever stores for an agreement is the final signed scan, uploaded once drafting and legal review are done and the parties have signed.

Google Docs' own native revision history is the version history for the drafting stage — Accord 360 does not store or diff document content itself, only who has access and when it changed.

## What we need from JKUAT IT

| Item | Why |
| --- | --- |
| A Google Cloud project with the **Drive API** and **Docs API** enabled | Hosts the service account Accord 360 authenticates as |
| A **service account** in that project, with a JSON key | How the backend authenticates to Drive — no user ever logs in or is impersonated |
| One **Shared Drive** (e.g. "Accord 360 — Agreement Drafts"), with the service account added as **Content Manager** | Where every drafting-stage Doc copy is created and shared. Shared Drives have pooled storage and a normal sharing quota; a bare service account has neither on its own |
| Each master template Doc (Standard MoU, CRA, etc.) shared individually with the service account as **Editor** | So Accord 360 can copy that specific template when a researcher starts a collaboration — access is granted per document, not Drive-wide |

That's the complete list. Nothing else is required to enable the integration.

## How we'll use it

The integration makes exactly three kinds of Drive API calls, and only at specific status transitions — nothing runs on a schedule or in the background:

- **Copy** the master template into the Shared Drive when a researcher starts a collaboration.
- **Grant** access, one person at a time, by their real institutional email — never a shared group or a wildcard. At creation: the researcher and the external partner, as writers. At Submit: the partner is removed and every active Linkages and Legal staff member is added individually.
- **Revoke** access the instant it's no longer appropriate — most importantly, the external partner loses access the moment the researcher submits to Linkages, so the partner cannot see what happens to the Doc during legal review.

Every grant and revoke is logged locally in Accord 360 (who, which role, when, and Google's own permission id), so there's a full audit trail independent of Drive's own history. Legal's review comments stay natively in the Google Doc — Accord 360 does not copy or store comment text, only the fact that a "returned for corrections" event happened.

Accord 360 never reads or stores the Doc's actual content. It only manages who can see and edit it, and when.

## Recommended: JKUAT creates its own Google Cloud project

Yes — this is the better arrangement, and we can fully test the integration against it before go-live. Everything stays under JKUAT's own account, with JKUAT's own Workspace quota (not a personal Gmail account's, which is what we're limited to today and why testing has been repeatedly blocked by Drive's sharing rate limit).

**The steps, on their side:**
1. Create a Google Cloud project.
2. Enable the Drive API and Docs API in it.
3. Create a service account and generate a JSON key.
4. Create the Shared Drive and add the service account as Content Manager.
5. Share each master template Doc with the service account as Editor.

**Handling the key:** the service account's JSON key is a credential, so it should be shared with us over a secure channel (a password manager share, or similar) rather than plain email — whichever JKUAT IT's standard practice is for handing over API credentials. Once we're through testing and ready to go live, JKUAT IT can rotate the key (generate a new one, delete the old one in the Cloud console) so any copy used during testing stops working and only the final key, set directly in the production environment, remains valid.

**Testing:** once we have that key and the Shared Drive/folder id, we set them in Accord 360's backend configuration exactly as we do today — no code changes needed, only the credentials and ids change. We can then run the full flow (researcher creates a drafting copy, partner is invited, researcher submits, partner is removed and Linkages/Legal are granted access) against JKUAT's real environment before it's used for anything live.

## Sender name and Shared Drive membership

- **Display name:** please give the service account a clear display name such as "JKUAT Accord 360" (Cloud console → IAM & Admin → Service Accounts → edit name). Google's share emails say "<name> (via Google Docs)", and an official-looking sender is far less likely to be marked as spam. When a recipient marks it as spam or blocks it, Google refuses to share with them at all.
- **Shared Drive members:** only the service account (Content Manager) and a JKUAT administrator should be members of the Shared Drive. Anyone who is a member has inherited access that can't be revoked per document, which breaks the "partner loses access at Submit" and "Legal loses access after review" rules. Researchers, Linkages and Legal staff and partners must not be added as drive members.

## What we're not asking for, and where things stand

- No domain-wide delegation — the service account cannot act as any JKUAT user, only as itself, granted access document by document.
- No admin console access for us.
- No access to any Drive content outside the one Shared Drive and the specific template Docs shared with it.

**Current status:** the integration is code-complete and has been verified end to end using a personal Google account and a hand-made test Doc, standing in for the real Shared Drive. That's confirmed the whole flow works — copy, invite, submit, revoke, re-grant — but personal-account testing keeps hitting Google's Drive sharing rate limit, since a bare service account with no Workspace license gets a very small daily allowance for sharing operations. A JKUAT-issued Shared Drive removes that limitation and lets us finish testing against the real environment before go-live.
