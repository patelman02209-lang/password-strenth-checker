# Local breach checking (Have I Been Pwned downloader)

The backend endpoint `POST /api/v1/local-breach` reads `LOCAL_BREACH_FILE` if set. The file should contain **SHA-1 hashes in uppercase hex**, one per line, optionally suffixed with `:count` as emitted by official tooling.

Recommended upstream tool: **[Pwned Passwords Downloader](https://github.com/HaveIBeenPwned/PwnedPasswordsDownloader)** from the Have I Been Pwned project.

Example workflow:

1. Download hash lists for offline use (large datasets — plan disk and RAM).  
2. Point `LOCAL_BREACH_FILE` in `backend/.env` to the on-disk path readable by the API process.  
3. Call `POST /api/v1/local-breach` with `{ "password": "..." }`.

> The reference implementation performs a **linear scan** with a configurable safety cap (`max_scan_lines` in `breach_local.py`). For production-scale corpora, import hashes into a database or bloom filter instead of scanning multi-gigabyte files per request.
