package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import net.filebot.backend.service.RenameWorkspaceService;

public class RenameWorkspaceController {

  private final RenameWorkspaceService renameService;

  public RenameWorkspaceController(RenameWorkspaceService renameService) {
    this.renameService = renameService;
  }

  public List<MatchDto> autoMatch(MatchRequestDto request) {
    return renameService.autoMatch(request);
  }

  public List<MatchDto> updateRowAlignment(
      List<MatchDto> matches, int sourceIndex, int targetIndex) {
    return renameService.updateRowAlignment(matches, sourceIndex, targetIndex);
  }

  public List<MatchDto> applyFormat(List<MatchDto> matches, String formatExpression) {
    return renameService.applyFormat(matches, formatExpression);
  }

  public RenameExecutionResultDto executeRename(RenameExecutionRequestDto request) {
    return renameService.executeRename(request);
  }
}
