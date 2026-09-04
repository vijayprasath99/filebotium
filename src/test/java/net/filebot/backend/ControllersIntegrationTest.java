package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import net.filebot.backend.controller.AnalyzeController;
import net.filebot.backend.controller.AppShellController;
import net.filebot.backend.controller.EpisodeController;
import net.filebot.backend.controller.FormatController;
import net.filebot.backend.controller.HistoryController;
import net.filebot.backend.controller.RenameWorkspaceController;
import net.filebot.backend.controller.SettingsController;
import net.filebot.backend.controller.SfvController;
import net.filebot.backend.controller.SubtitleController;
import net.filebot.backend.domain.HashType;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.domain.WorkspaceTab;
import net.filebot.backend.dto.AppSettingsDto;
import net.filebot.backend.dto.ChecksumVerificationRequestDto;
import net.filebot.backend.dto.FormatEvaluationRequestDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import net.filebot.backend.dto.HistoryTransactionDto;
import net.filebot.backend.dto.IntakeRequestDto;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SystemStatusDto;
import net.filebot.backend.service.ChecksumService;
import net.filebot.backend.service.ChecksumServiceImpl;
import net.filebot.backend.service.EpisodeFetcherService;
import net.filebot.backend.service.EpisodeFetcherServiceImpl;
import net.filebot.backend.service.FormatExpressionEngineService;
import net.filebot.backend.service.FormatExpressionEngineServiceImpl;
import net.filebot.backend.service.HistoryService;
import net.filebot.backend.service.HistoryServiceImpl;
import net.filebot.backend.service.MediaInfoInspectorService;
import net.filebot.backend.service.MediaInfoInspectorServiceImpl;
import net.filebot.backend.service.RenameWorkspaceService;
import net.filebot.backend.service.RenameWorkspaceServiceImpl;
import net.filebot.backend.service.SettingsService;
import net.filebot.backend.service.SettingsServiceImpl;
import net.filebot.backend.service.SubtitleService;
import net.filebot.backend.service.SubtitleServiceImpl;
import net.filebot.backend.websocket.TaskProgressPublisher;
import org.junit.jupiter.api.Test;

public class ControllersIntegrationTest {

  private final AppShellController appShellController = new AppShellController();
  private final RenameWorkspaceService renameService = new RenameWorkspaceServiceImpl();
  private final RenameWorkspaceController renameController =
      new RenameWorkspaceController(renameService);
  private final FormatExpressionEngineService formatService =
      new FormatExpressionEngineServiceImpl();
  private final FormatController formatController = new FormatController(formatService);
  private final EpisodeFetcherService episodeService = new EpisodeFetcherServiceImpl();
  private final EpisodeController episodeController = new EpisodeController(episodeService);
  private final SubtitleService subtitleService = new SubtitleServiceImpl();
  private final SubtitleController subtitleController = new SubtitleController(subtitleService);
  private final ChecksumService checksumService = new ChecksumServiceImpl();
  private final SfvController sfvController = new SfvController(checksumService);
  private final MediaInfoInspectorService inspectorService = new MediaInfoInspectorServiceImpl();
  private final AnalyzeController analyzeController = new AnalyzeController(inspectorService);
  private final HistoryService historyService = new HistoryServiceImpl();
  private final HistoryController historyController = new HistoryController(historyService);
  private final SettingsService settingsService = new SettingsServiceImpl();
  private final SettingsController settingsController = new SettingsController(settingsService);

  @Test
  public void testAppShellController() {
    SystemStatusDto status = appShellController.getSystemStatus();
    assertNotNull(status);
    assertEquals("FileBot", status.appName());

    IntakeRequestDto intakeReq =
        new IntakeRequestDto(List.of("/some/file.mkv"), false, true, WorkspaceTab.RENAME);
    List<MediaFileDto> files = appShellController.processFileIntake(intakeReq);
    assertNotNull(files);
  }

  @Test
  public void testRenameWorkspaceController() {
    MatchRequestDto req =
        new MatchRequestDto(
            List.of("/sample.mp4"), ProviderType.THE_TVDB, MatchingMode.TV, LanguageCode.EN, null);
    List<MatchDto> matches = renameController.autoMatch(req);
    assertNotNull(matches);
    assertEquals(1, matches.size());
  }

  @Test
  public void testFormatController() {
    FormatEvaluationRequestDto req = new FormatEvaluationRequestDto("{n}", null, null);
    FormatEvaluationResultDto res = formatController.evaluateExpression(req);
    assertNotNull(res);

    assertTrue(formatController.validateExpression("{n}"));
    assertNotNull(formatController.getAvailableBindings("sample.mkv"));
  }

  private void assertTrue(boolean condition) {
    org.junit.jupiter.api.Assertions.assertTrue(condition);
  }

  @Test
  public void testEpisodeController() {
    SeriesSearchRequestDto searchReq =
        new SeriesSearchRequestDto("Office", ProviderType.THE_TVDB, LanguageCode.EN);
    List<SearchResultDto> results = episodeController.searchSeries(searchReq);
    assertNotNull(results);
  }

  @Test
  public void testSubtitleController() {
    SubtitleSearchRequestDto searchReq =
        new SubtitleSearchRequestDto(
            List.of("/sample.mkv"), LanguageCode.EN, SubtitleProviderType.OPEN_SUBTITLES);
    List<SubtitleDescriptorDto> found = subtitleController.searchSubtitles(searchReq);
    assertNotNull(found);
    assertEquals(1, found.size());
  }

  @Test
  public void testSfvController() {
    ChecksumVerificationRequestDto req =
        new ChecksumVerificationRequestDto(List.of("file1.rar"), HashType.CRC32, null);
    String taskId = sfvController.startVerificationTask(req);
    assertNotNull(taskId);
  }

  @Test
  public void testAnalyzeController() {
    MediaInfoInspectorDto dto = analyzeController.inspectFile("/non/existent.mkv");
    assertNotNull(dto);
  }

  @Test
  public void testHistoryController() {
    List<HistoryTransactionDto> history = historyController.getTransactionHistory();
    assertNotNull(history);
  }

  @Test
  public void testSettingsController() {
    AppSettingsDto settings = settingsController.getAppSettings();
    assertNotNull(settings);
  }

  @Test
  public void testTaskProgressPublisher() {
    TaskProgressPublisher publisher = new TaskProgressPublisher();
    publisher.publishRenameProgress("task-1", 1, 10, "file1.mkv", 10.0);
    assertFalse(publisher.getPublishedEvents().isEmpty());
  }
}
