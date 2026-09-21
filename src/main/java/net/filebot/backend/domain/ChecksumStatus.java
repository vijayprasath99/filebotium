package net.filebot.backend.domain;

public enum ChecksumStatus {
  OK,
  MISMATCH,
  MISSING,
  ERROR,
  COMPUTING,
  // Computed hash doesn't match a CRC32 checksum embedded in the filename itself
  // (e.g. "Test[49A93C5F].txt"), independent of any loaded verification file
  // (specs/audit/06_sfv_audit.md GAP-12, net.filebot.hash.VerificationUtilities.EMBEDDED_CHECKSUM).
  WARNING
}
