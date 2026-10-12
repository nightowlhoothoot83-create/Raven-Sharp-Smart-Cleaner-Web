# Raven Sharp Smart Cleaner Web

Browser app and public site for cleaner.raven-sharp.com, usable on PC and phone. The mobile Expo app lives in a separate repository.

## Browser device scanning

- Choose files, photos/videos, or a folder (where the browser supports directory selection).
- Review the selection before scanning. Selection and original File objects stay in memory until cleared or logout.
- Default mode computes SHA-256 over each entire file and registers names, sizes and fingerprints through the existing authenticated /api/files/register endpoint.
- Content analysis is opt-in: files up to 25 MB are sent through /api/files/upload for server-side text extraction and image perceptual hashing. Files above 25 MB use metadata registration. Files above 128 MB are skipped with a visible explanation to bound browser memory.
- Scanning runs sequentially, displays progress and per-file failures, and supports stopping. Completed account records remain after stopping; stopping an HTTP request cannot guarantee rollback of server-side processing.
- Analysis and filename suggestions use the existing /api/scan/analyze and /api/scan/rename-candidates routes.
- Repeated selections reuse matching existing records where returned by /api/files (currently limited to 2,000 records by the backend). Metadata registration also uses a stable external ID and the backend's existing deduplication check. Content rescans beyond that listing limit can create repeated records; increasing/paginating the listing and adding upload identity are future backend work.
- Existing metadata-only records are reused rather than uploaded again; opting in later does not upgrade those records with content.

## Review actions

Original device files are never deleted or renamed by the site. Removing an internal scan record only removes account metadata. A renamed download is a new copy, available when the uploaded original was selected in the current session. Cloud mutations are not exposed by this change; the existing backend's remote-operation error handling needs separate repair before reliable deletion/renaming can be offered.

The JSON review report contains recommendations, not a record of completed device cleanup. Estimated recoverable bytes do not indicate space actually freed.

Cloud source scans still use the existing Google Drive/Dropbox connections. OAuth client configuration and provider lifecycle gaps remain separate work. This feature adds no OneDrive or Google Photos integration.

## Validation

Run from the repository root:

    node --check device-scan.js
    node --test tests/device-scan.test.cjs

The tests exercise full-file hashes, folder identities, upload consent, record reuse, partial failures, cancellation, safe text rendering and cloud scanning order. They use a DOM/API harness and do not substitute for real device testing.

Before publishing, test on desktop and Android/iPhone browsers with a test account: select two byte-identical files at different folder paths, scan and repeat, cancel midway, opt into content analysis, inspect duplicate recommendations, remove only an internal scan record, download a renamed copy and export a review report. Verify phone file/photo pickers and folder fallback.

## Hosting

Keep the existing Cloudflare hosting and Railway API configuration. This branch requires no backend changes and must not merge the mobile repository's feature/device-folder-scan backend replacement. This repository change is prepared as a pull request; production publication is separate.
