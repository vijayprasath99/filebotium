package net.filebot.backend.dto;

import java.io.Serializable;
import java.util.List;
import java.util.Map;
import net.filebot.backend.domain.HashType;

public record ChecksumVerificationRequestDto(
    List<String> filePaths,
    HashType hashType,
    String sfvFilePath,
    Map<String, String> expectedHashes)
    implements Serializable {

  public ChecksumVerificationRequestDto(List<String> filePaths, HashType hashType, String sfvFilePath) {
    this(filePaths, hashType, sfvFilePath, null);
  }
}
