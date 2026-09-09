package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;

public interface RenameWorkspaceService {
  List<MatchDto> autoMatch(MatchRequestDto request);

  List<MatchDto> updateRowAlignment(
      List<MatchDto> currentMatches, int sourceIndex, int targetIndex);

  List<MatchDto> applyFormat(List<MatchDto> matches, String formatExpression);

  RenameExecutionResultDto executeRename(RenameExecutionRequestDto request);
}
