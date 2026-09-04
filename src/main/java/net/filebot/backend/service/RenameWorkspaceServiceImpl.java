package net.filebot.backend.service;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import net.filebot.StandardRenameAction;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.MatchStatus;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.RenameErrorDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import net.filebot.format.ExpressionFormat;
import net.filebot.format.MediaBindingBean;
import net.filebot.similarity.SeasonEpisodeMatcher;
import org.springframework.stereotype.Service;

@Service
public class RenameWorkspaceServiceImpl implements RenameWorkspaceService {

  private final SeasonEpisodeMatcher seasonEpisodeMatcher =
      new SeasonEpisodeMatcher(SeasonEpisodeMatcher.DEFAULT_SANITY, false);

  @Override
  public List<MatchDto> autoMatch(MatchRequestDto request) {
    if (request == null || request.filePaths() == null) {
      return Collections.emptyList();
    }

    List<MatchDto> matches = new ArrayList<>();
    for (String path : request.filePaths()) {
      File file = new File(path);
      MediaFileDto mediaFile =
          new MediaFileDto(
              UUID.randomUUID().toString(),
              file.getAbsolutePath(),
              file.getName(),
              extension(file.getName()),
              file.length(),
              Instant.ofEpochMilli(file.lastModified()),
              file.getParent() != null ? file.getParent() : "",
              file.isDirectory(),
              null,
              Collections.emptyMap());

      String formattedName = file.getName();
      if (request.formatExpression() != null && !request.formatExpression().isBlank()) {
        try {
          ExpressionFormat format = new ExpressionFormat(request.formatExpression());
          MediaBindingBean bindingBean = new MediaBindingBean(file, file, null);
          Object result = format.format(bindingBean);
          if (result != null) {
            formattedName = result.toString();
          }
        } catch (Exception e) {
          // Fallback to original name
        }
      }

      matches.add(
          new MatchDto(
              UUID.randomUUID().toString(),
              mediaFile,
              null,
              0.85,
              formattedName,
              new File(file.getParentFile(), formattedName).getAbsolutePath(),
              false,
              MatchStatus.MATCHED));
    }
    return matches;
  }

  @Override
  public List<MatchDto> updateRowAlignment(
      List<MatchDto> currentMatches, int sourceIndex, int targetIndex) {
    if (currentMatches == null
        || sourceIndex < 0
        || targetIndex < 0
        || sourceIndex >= currentMatches.size()
        || targetIndex >= currentMatches.size()) {
      return currentMatches;
    }

    List<MatchDto> reordered = new ArrayList<>(currentMatches);
    MatchDto moved = reordered.remove(sourceIndex);
    reordered.add(targetIndex, moved);
    return reordered;
  }

  @Override
  public List<MatchDto> applyFormat(List<MatchDto> matches, String formatExpression) {
    if (matches == null || formatExpression == null) {
      return matches;
    }

    List<MatchDto> formattedMatches = new ArrayList<>();
    for (MatchDto match : matches) {
      if (match.isExcluded()) {
        formattedMatches.add(match);
        continue;
      }

      String newFormattedName = match.formattedName();
      try {
        ExpressionFormat format = new ExpressionFormat(formatExpression);
        File file = new File(match.sourceFile().path());
        MediaBindingBean bindingBean =
            new MediaBindingBean(
                match.targetMetadata() != null ? match.targetMetadata() : file, file, null);
        Object result = format.format(bindingBean);
        if (result != null) {
          newFormattedName = result.toString();
        }
      } catch (Exception e) {
        // Keep existing formatted name on error
      }

      File sourceFile = new File(match.sourceFile().path());
      File targetFile = new File(sourceFile.getParentFile(), newFormattedName);

      formattedMatches.add(
          new MatchDto(
              match.matchId(),
              match.sourceFile(),
              match.targetMetadata(),
              match.score(),
              newFormattedName,
              targetFile.getAbsolutePath(),
              match.isExcluded(),
              match.status()));
    }
    return formattedMatches;
  }

  @Override
  public RenameExecutionResultDto executeRename(RenameExecutionRequestDto request) {
    if (request == null || request.matches() == null) {
      return new RenameExecutionResultDto(
          UUID.randomUUID().toString(), 0, 0, Collections.emptyList());
    }

    int successCount = 0;
    int failureCount = 0;
    List<RenameErrorDto> errors = new ArrayList<>();
    String transactionId = UUID.randomUUID().toString();

    StandardRenameAction renameAction = StandardRenameAction.MOVE;
    if (request.action() == FileAction.COPY) {
      renameAction = StandardRenameAction.COPY;
    } else if (request.action() == FileAction.HARDLINK) {
      renameAction = StandardRenameAction.HARDLINK;
    } else if (request.action() == FileAction.SYMLINK) {
      renameAction = StandardRenameAction.SYMLINK;
    }

    for (MatchDto match : request.matches()) {
      if (match.isExcluded()) {
        continue;
      }

      try {
        File source = new File(match.sourceFile().path());
        File destination = new File(match.formattedPath());

        if (source.exists()) {
          renameAction.rename(source, destination);
          successCount++;
        } else {
          failureCount++;
          errors.add(
              new RenameErrorDto(
                  source.getAbsolutePath(),
                  destination.getAbsolutePath(),
                  "Source file does not exist"));
        }
      } catch (Exception e) {
        failureCount++;
        errors.add(
            new RenameErrorDto(match.sourceFile().path(), match.formattedPath(), e.getMessage()));
      }
    }

    return new RenameExecutionResultDto(transactionId, successCount, failureCount, errors);
  }

  private String extension(String name) {
    int dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(dot + 1) : "";
  }
}
