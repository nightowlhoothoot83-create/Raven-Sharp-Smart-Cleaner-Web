# Raven Sharp AI File Manager

Web app for PC and phone at cleaner.raven-sharp.com. The Expo mobile app is separate.

1. Select device files/photos/folders or connect supported cloud accounts.
2. Run basic matching without Claude. Review exact copies and related file/version groups.
3. Select up to 12 files for content cleanup, enter keep/relevance rules and approve content processing.
4. Review Claude's evidence, quality/version flags and keep/archive/delete candidates.
5. Edit filename suggestions and approve individual supported actions.

Device rename approval downloads a renamed copy; device originals stay unchanged. Cloud mutations require confirmation and successful provider responses. Archive suggestions are manual recommendations. Raw content previews remain request-local; account-owned recommendations are saved.

See FEATURE_AUDIT.md for inspection coverage, source support, upload/preview bounds and remaining limitations. Release this web version with the companion Smart AI Cleaner backend PR #9, which adds /api/capabilities, /api/scan/content-review, registration IDs, basic-only analysis and fail-closed mutations.

## Checks

    node --check device-scan.js
    node --check source-dashboard.js
    node --check content-cleanup.js
    node --test tests/device-scan.test.cjs

The backend companion runs test_standard_matching_order.py and test_content_cleanup.py using the existing requirements. Automated checks cover source selection, consent, editable approval, model-boundary validation, ownership, unavailable content and provider failures. Live smoke tests must verify deployed endpoint versions and Claude availability separately.
