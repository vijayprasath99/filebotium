package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import net.filebot.backend.service.RenameWorkspaceService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rename")
public class RenameWorkspaceController {

  private final RenameWorkspaceService renameService;

  public RenameWorkspaceController(RenameWorkspaceService renameService) {
    this.renameService = renameService;
  }

  @PostMapping("/match")
  public List<MatchDto> autoMatch(@RequestBody MatchRequestDto request) {
    return renameService.autoMatch(request);
  }

  @PostMapping("/align")
  public List<MatchDto> updateRowAlignment(
      @RequestBody List<MatchDto> matches,
      @RequestParam("sourceIndex") int sourceIndex,
      @RequestParam("targetIndex") int targetIndex) {
    return renameService.updateRowAlignment(matches, sourceIndex, targetIndex);
  }

  @PostMapping("/format")
  public List<MatchDto> applyFormat(
      @RequestBody List<MatchDto> matches,
      @RequestParam("formatExpression") String formatExpression) {
    return renameService.applyFormat(matches, formatExpression);
  }

  @PostMapping("/execute")
  public RenameExecutionResultDto executeRename(@RequestBody RenameExecutionRequestDto request) {
    return renameService.executeRename(request);
  }
}
