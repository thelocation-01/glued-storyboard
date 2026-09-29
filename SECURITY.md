# Security policy

## Supported version

Security fixes are applied to the latest tagged release.

## Reporting a vulnerability

Do not open a public issue containing an exploit, private project, credential, or personal data. Use GitHub's private vulnerability-reporting feature when it is enabled for the repository. If that feature is unavailable, open a minimal issue asking the maintainer for a private reporting route without including the sensitive details.

## Local safety boundaries

Glued Storyboard is intended to run on the user's own computer. Treat imported ZIPs and media as untrusted. The server rejects unsafe ZIP paths, limits upload and extraction sizes, and writes only within the application data folders. Do not expose the local server to the public internet without adding authentication, request hardening, and a deployment-specific security review.

