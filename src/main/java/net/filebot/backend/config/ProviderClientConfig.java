package net.filebot.backend.config;

import java.util.EnumMap;
import java.util.Map;
import net.filebot.WebServices;
import net.filebot.backend.domain.ProviderType;
import net.filebot.web.EpisodeListProvider;
import net.filebot.web.MovieIdentificationService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Exposes the legacy {@link net.filebot.WebServices} provider singletons as Spring-managed beans
 * so the backend service layer can depend on an injectable seam instead of the static fields
 * directly. Production behavior is unchanged (same singleton instances, same defaults) - the
 * only difference is that a test {@code @TestConfiguration} can now supply a {@code @Primary}
 * replacement map (e.g. a client pointed at a WireMock server) without touching
 * {@link net.filebot.WebServices} itself, which remains the shared entry point for the rest of
 * the legacy application (Swing UI, CLI).
 */
@Configuration
public class ProviderClientConfig {

  @Bean
  public Map<ProviderType, EpisodeListProvider> episodeProviders() {
    Map<ProviderType, EpisodeListProvider> providers = new EnumMap<>(ProviderType.class);
    providers.put(ProviderType.THE_TVDB, WebServices.TheTVDB);
    providers.put(ProviderType.THE_MOVIE_DB, WebServices.TheMovieDB_TV);
    providers.put(ProviderType.ANI_DB, WebServices.AniDB);
    providers.put(ProviderType.TV_MAZE, WebServices.TVmaze);
    return providers;
  }

  @Bean
  public Map<ProviderType, MovieIdentificationService> movieProviders() {
    Map<ProviderType, MovieIdentificationService> providers = new EnumMap<>(ProviderType.class);
    providers.put(ProviderType.OMDB, WebServices.OMDb);
    providers.put(ProviderType.THE_MOVIE_DB, WebServices.TheMovieDB);
    return providers;
  }
}
