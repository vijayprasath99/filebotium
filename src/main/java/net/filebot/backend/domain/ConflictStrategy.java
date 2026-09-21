package net.filebot.backend.domain;

public enum ConflictStrategy {
  OVERWRITE,
  FAIL,
  SKIP,
  AUTO_RENAME
}
