package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import net.filebot.backend.domain.EpisodeSortOrder;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.EpisodeFetchRequestDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;
import net.filebot.backend.service.EpisodeFetcherService;
import net.filebot.backend.service.EpisodeFetcherServiceImpl;
import org.junit.jupiter.api.Test;

public class EpisodeFetcherServiceTest {

  private final EpisodeFetcherService service = new EpisodeFetcherServiceImpl();

  @Test
  public void testSearchSeriesWithEmptyQuery() {
    SeriesSearchRequestDto request =
        new SeriesSearchRequestDto("", ProviderType.THE_TVDB, LanguageCode.EN);
    List<SearchResultDto> results = service.searchSeries(request);
    assertNotNull(results);
    assertTrue(results.isEmpty());
  }

  @Test
  public void testGetEpisodesWithNullRequest() {
    List<EpisodeDto> episodes = service.getEpisodes(null);
    assertNotNull(episodes);
    assertTrue(episodes.isEmpty());
  }

  @Test
  public void testGetFormattedEpisodeListWithValidRequest() {
    EpisodeFetchRequestDto request =
        new EpisodeFetchRequestDto(
            101, ProviderType.THE_TVDB, EpisodeSortOrder.AIR_DATE, LanguageCode.EN, 1);
    List<String> formatted = service.getFormattedEpisodeList(request, "{n} - {s00e00} - {t}");
    assertNotNull(formatted);
  }
}
