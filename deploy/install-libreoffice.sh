#!/usr/bin/env bash
# Install LibreOffice on Amazon Linux 2023 for headless DOCX->PDF rendering.
# LibreOffice is NOT packaged in AL2023 repos, so we install the official
# "rpm" bundle for RHEL (AL2023 is RHEL9-compatible).
# NOTE: /tmp is tmpfs (RAM) on this AMI, so scratch work happens in /var/tmp.
# Usage: sudo bash install-libreoffice.sh [VERSION]
set -euo pipefail

VERSION="${1:-26.2.6}"
ROOT="https://download.documentfoundation.org/libreoffice/stable/${VERSION}/rpm/x86_64"
TARBALL="LibreOffice_${VERSION}_Linux_x86-64_rpm.tar.gz"
WORK="/var/tmp/lo-install"

echo "== checking for existing LibreOffice install =="
BIN="$(ls -d /opt/libreoffice*/program/soffice 2>/dev/null | head -1 || true)"
if [ -n "$BIN" ] || [ -x /usr/bin/soffice ]; then
  BIN="${BIN:-/usr/bin/soffice}"
  echo "LibreOffice already installed at $BIN; skipping."
  exec "$BIN" --version
fi

mkdir -p "$WORK"
cd "$WORK"

echo "== downloading $TARBALL =="
curl -fL --retry 3 -o "$TARBALL" "${ROOT}/${TARBALL}"

echo "== extracting =="
tar -xzf "$TARBALL"

echo "== installing RPMs (bundle carries its own lib deps) =="
RPMS="$(ls -d LibreOffice_*/RPMS 2>/dev/null | head -1)"
cd "$WORK/$RPMS"
for r in ./*.rpm; do
  dnf install -y "$WORK/$RPMS/$r" >/dev/null 2>&1 || { echo "rpm install failed for $r; aborting"; exit 1; }
done

BIN="$(ls -d /opt/libreoffice*/program/soffice 2>/dev/null | head -1)"
echo "== LibreOffice binary: $BIN =="
"$BIN" --version

echo "== fonts (better fidelity for DOCX->PDF) =="
dnf install -y liberation-fonts >/dev/null 2>&1 || echo "liberation-fonts not available; continuing"

echo "Done. Set LIBREOFFICE_ENABLED=true and LIBREOFFICE_BINARY=$BIN in backend/.env"