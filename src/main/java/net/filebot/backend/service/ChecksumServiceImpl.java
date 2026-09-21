package net.filebot.backend.service;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.filebot.backend.domain.ChecksumStatus;
import net.filebot.backend.domain.HashType;
import net.filebot.backend.dto.ChecksumEntryDto;
import net.filebot.backend.dto.ChecksumExportRequestDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.dto.ChecksumVerificationResultDto;
import net.filebot.backend.websocket.TaskProgressPublisher;
import net.filebot.hash.SfvFormat;
import net.filebot.hash.VerificationFileReader;
import net.filebot.hash.VerificationFormat;
import net.filebot.hash.VerificationUtilities;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ChecksumServiceImpl implements ChecksumService {

  private final TaskProgressPublisher progressPublisher;

  public ChecksumServiceImpl() {
    this(null);
  }

  @Autowired
  public ChecksumServiceImpl(TaskProgressPublisher progressPublisher) {
    this.progressPublisher = progressPublisher;
  }

  @Override
  public ChecksumVerificationResultDto startVerificationTask(
      ChecksumVerificationRequestDto request) {
    String taskId = UUID.randomUUID().toString();
    if (request == null || request.filePaths() == null) {
      return new ChecksumVerificationResultDto(taskId, Collections.emptyList());
    }

    net.filebot.hash.HashType hashType = toLegacyHashType(request.hashType());

    Map<String, String> expectedHashes =
        request.expectedHashes() != null
            ? request.expectedHashes()
            : loadExpectedHashesFromSfv(request.sfvFilePath());

    List<ChecksumEntryDto> results = new ArrayList<>();
    int total = request.filePaths().size();
    int processed = 0;

    for (String path : request.filePaths()) {
      processed++;
      File file = new File(path);
      String expected = expectedHashes.get(path);

      ChecksumEntryDto entry;
      if (!file.exists()) {
        entry =
            new ChecksumEntryDto(path, expected, null, request.hashType(), ChecksumStatus.MISSING);
      } else {
        try {
          String calculated = VerificationUtilities.computeHash(file, hashType);
          ChecksumStatus status =
              expected == null || expected.isBlank()
                  ? ChecksumStatus.OK
                  : expected.equalsIgnoreCase(calculated)
                      ? ChecksumStatus.OK
                      : ChecksumStatus.MISMATCH;

          // When no expected hash was supplied (no loaded SFV entry for this file), fall back to
          // cross-checking any CRC32 embedded in the filename itself, mirroring legacy's
          // HighlightPatternCellRenderer (specs/audit/06_sfv_audit.md GAP-12).
          if (status == ChecksumStatus.OK
              && request.hashType() == HashType.CRC32
              && (expected == null || expected.isBlank())) {
            String embedded = VerificationUtilities.getEmbeddedChecksum(file.getName());
            if (embedded != null && !embedded.equalsIgnoreCase(calculated)) {
              status = ChecksumStatus.WARNING;
            }
          }

          entry = new ChecksumEntryDto(path, expected, calculated, request.hashType(), status);
        } catch (Exception e) {
          entry = new ChecksumEntryDto(path, expected, null, request.hashType(), ChecksumStatus.ERROR);
        }
      }
      results.add(entry);

      if (progressPublisher != null) {
        progressPublisher.publishSfvProgress(
            new net.filebot.backend.dto.ChecksumProgressEventDto(
                taskId, path, file.length(), file.length(), 0.0, 100.0 * processed / total, entry));
      }
    }

    return new ChecksumVerificationResultDto(taskId, results);
  }

  @Override
  public void cancelVerificationTask(String taskId) {
    // Verification currently runs synchronously within startVerificationTask's request/response
    // cycle (no background executor exists yet - see specs/DETAILED_IMPLEMENTATION_PLAN.md 1.3),
    // so there is nothing in-flight on the server to cancel by the time a cancel request arrives.
  }

  @Override
  public List<ChecksumEntryDto> parseVerificationFile(String sfvFilePath) {
    if (sfvFilePath == null || sfvFilePath.isBlank()) {
      return Collections.emptyList();
    }

    File file = new File(sfvFilePath);
    if (!file.exists()) {
      return Collections.emptyList();
    }

    net.filebot.hash.HashType detectedType = VerificationUtilities.getHashType(file);
    HashType hashType = detectedType != null ? toBackendHashType(detectedType) : HashType.CRC32;
    VerificationFormat format = detectedType != null ? detectedType.getFormat() : new SfvFormat();

    List<ChecksumEntryDto> dtos = new ArrayList<>();
    try (FileReader reader = new FileReader(file, StandardCharsets.UTF_8);
        VerificationFileReader verificationReader = new VerificationFileReader(reader, format)) {
      while (verificationReader.hasNext()) {
        Map.Entry<File, String> entry = verificationReader.next();
        dtos.add(
            new ChecksumEntryDto(
                entry.getKey().getPath(), entry.getValue(), null, hashType, ChecksumStatus.COMPUTING));
      }
    } catch (Exception e) {
      return Collections.emptyList();
    }
    return dtos;
  }

  @Override
  public String generateVerificationFileContent(ChecksumExportRequestDto request) {
    if (request == null || request.entries() == null) {
      return "";
    }

    net.filebot.hash.HashType hashType = toLegacyHashType(request.hashType());
    VerificationFormat format = hashType.getFormat();

    StringBuilder sb = new StringBuilder("; Generated by FileBot\n");
    for (ChecksumEntryDto entry : request.entries()) {
      String hash = entry.calculatedHash() != null ? entry.calculatedHash() : entry.expectedHash();
      if (hash != null) {
        sb.append(format.format(entry.path(), hash)).append("\n");
      }
    }

    String content = sb.toString();
    if (request.outputPath() != null && !request.outputPath().isBlank()) {
      try (FileWriter writer = new FileWriter(request.outputPath(), StandardCharsets.UTF_8)) {
        writer.write(content);
      } catch (Exception e) {
        // Ignore file write exception - the generated content is still returned to the caller.
      }
    }

    return content;
  }

  private Map<String, String> loadExpectedHashesFromSfv(String sfvFilePath) {
    if (sfvFilePath == null || sfvFilePath.isBlank()) {
      return Collections.emptyMap();
    }
    Map<String, String> map = new java.util.HashMap<>();
    for (ChecksumEntryDto entry : parseVerificationFile(sfvFilePath)) {
      map.put(entry.path(), entry.expectedHash());
    }
    return map;
  }

  private net.filebot.hash.HashType toLegacyHashType(HashType hashType) {
    if (hashType == null) {
      return net.filebot.hash.HashType.SFV;
    }
    return switch (hashType) {
      case MD5 -> net.filebot.hash.HashType.MD5;
      case SHA_1 -> net.filebot.hash.HashType.SHA1;
      case SHA_256 -> net.filebot.hash.HashType.SHA256;
      default -> net.filebot.hash.HashType.SFV;
    };
  }

  private HashType toBackendHashType(net.filebot.hash.HashType hashType) {
    return switch (hashType) {
      case MD5 -> HashType.MD5;
      case SHA1 -> HashType.SHA_1;
      case SHA256, SHA3_384 -> HashType.SHA_256;
      default -> HashType.CRC32;
    };
  }
}
