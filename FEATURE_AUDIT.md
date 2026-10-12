# AI File Manager: code feature audit

Reviewed the working Smart AI Cleaner backend main branch and the web device-scan branch on 12 October 2026. This is a source-code audit, not confirmation of a live Anthropic call or production credentials.

| Intended feature | What the code actually does | Limits |
| --- | --- | --- |
| Exact duplicates | Groups matching SHA-256 records | Device hashes cover complete files; some cloud hashing uses samples/fallback metadata, so cloud matches require review |
| Drafts and partial versions | Groups document filename roots and extensions, then clusters extracted text by similarity across different filenames | Name-only groups exist; extraction reads at most 4,000 characters and PDF's first five pages |
| Content-based keep recommendations | Claude receives names, sizes, dates and up to 800 characters of text per document to choose a comprehensive version | Not whole-document reasoning; falls back to file size if AI fails or is unavailable |
| Claude Vision image comparison | Retrieves actual Google Drive/Dropbox image bytes for a visually similar image group and calls Claude Vision | Requires retrievable bytes and an Anthropic key/model; uploaded device files are not retained for this later operation |
| Visually similar device photos | Upload computes a perceptual hash that can group resized/recompressed photos | Later keep recommendation falls back to size/date because local bytes are unavailable |
| Content-appropriate generic names | Claude uses extracted document text; Claude Vision uses retrievable cloud image bytes | Device-image suggestions can fall back to existing filenames rather than actual image content; no guarantee these are content-derived |
| Older versions | Filename/version patterns and file dates contribute to recommendations | No authoritative version history; upload creation time is scan time, not original edit time |
| Device cleanup | Web app reviews matches and can remove scan metadata or download a renamed copy | Browser does not delete or rename device originals; metadata removal does not free device storage |
| Cloud cleanup | Backend contains delete/rename operations | Remote failures can be swallowed before account records are changed; web dashboard does not expose these unreliable destructive actions |
| Google Drive / Dropbox | Backend connection validation, listing and scanning routes exist | OAuth client IDs must be configured; implicit token flow has no refresh token; reconnect currently creates another saved connection |
| OneDrive / Google Photos | Backend connection helpers exist | No corresponding cloud scan routes in this backend; dashboard marks them unavailable |

## Matching-order companion change

A separate backend change groups all standard candidates before Claude calls. Exact fingerprint groups use no AI, and one representative remains eligible for comparison with other drafts/versions, so duplicated old drafts can still be compared with a later Totalspan document. Non-identical candidate document groups then use Claude text comparison, and visually similar image groups use Vision where image bytes are available. The web and backend changes must both be released for this revised order. Fingerprint confidence, device Vision and cleanup limitations below still apply.

## Dashboard repairs in this change

- Parse the real source API envelope, {sources: [...]}, rather than treating it as an array.
- Separate device selection from cloud connection.
- Display each saved account with a scan checkbox, connection/scan status and explicit disconnect action.
- Scan selected supported accounts only, preserve deselection across refresh and show individual expired-token/scan errors.
- Offer Google Drive/Dropbox OAuth and validated advanced token entry, with clear setup-required messaging.
- Validate OAuth callback nonce state and expiry; clear callback fragments and entered tokens.
- State that disconnecting here removes the saved connection, not cloud files or provider permissions.
- Show available comparison evidence and Vision fallbacks in review groups.
- Rename customer-facing web branding to Raven Sharp AI File Manager and describe the broader content/version/draft workflow.

## Remaining engine work

To deliver content-based device-image Vision comparisons and names, provide bounded image previews to the authenticated backend while the device selection is still available, or implement explicit secure content retention. Validate account ownership and upload consent and report whether content was inspected. Never label a size/date fallback as Vision analysis.

For reliable cleanup, first propagate provider mutation failures without deleting metadata, add previews/approval/history and recovery where supported, and prove original-file changes with provider-state checks.

For robust source lifecycle, implement authorization-code/PKCE and server-side refresh/revoke handling as appropriate. OneDrive and Google Photos require provider-compatible scanning flows before exposing scan buttons.

Beyond the companion matching-order fix, these engine gaps are not implemented by this web dashboard pull request. The broken mobile PR backend replacement is not used.
