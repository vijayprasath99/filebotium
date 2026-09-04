export type ProviderType =
  | 'THE_TVDB'
  | 'THE_MOVIE_DB'
  | 'ANI_DB'
  | 'TV_MAZE'
  | 'OMDB'
  | 'ACOUSTID'
  | 'OPEN_SUBTITLES'
  | 'SHOOTER';

export type MatchingMode = 'TV' | 'MOVIE' | 'MUSIC' | 'ANIME' | 'AUTO';

export type FileAction = 'MOVE' | 'COPY' | 'HARDLINK' | 'SYMLINK';

export type ConflictStrategy = 'OVERWRITE' | 'FAIL' | 'SKIP' | 'AUTO_RENAME';

export type MatchStatus = 'MATCHED' | 'CONFLICT' | 'MANUAL' | 'PENDING' | 'EXCLUDED';

export type HistoryStatus = 'COMPLETED' | 'ROLLED_BACK' | 'FAILED';

export type HashType = 'CRC32' | 'MD5' | 'SHA_1' | 'SHA_256' | 'OPENSUBTITLES';

export type ChecksumStatus = 'OK' | 'MISMATCH' | 'MISSING' | 'ERROR' | 'COMPUTING';

export type SubtitleProviderType = 'OPEN_SUBTITLES' | 'SHOOTER';

export type SubtitleFormat = 'SRT' | 'SUB' | 'ASS' | 'VTT';

export type NotificationLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export type WorkspaceTab = 'RENAME' | 'EPISODES' | 'SUBTITLES' | 'SFV' | 'ANALYZE' | 'LIST' | 'SETTINGS';

export type LanguageCode =
  | 'EN'
  | 'DE'
  | 'FR'
  | 'ES'
  | 'IT'
  | 'JA'
  | 'ZH'
  | 'KO'
  | 'RU'
  | 'PT'
  | 'NL'
  | 'SV'
  | 'NO'
  | 'DA'
  | 'FI'
  | 'PL';

export type EpisodeSortOrder = 'AIR_DATE' | 'ABSOLUTE' | 'DVD';

export type BindingCategory = 'GENERAL' | 'VIDEO' | 'AUDIO' | 'SERIES' | 'MOVIE';

export type AnalysisTool = 'MEDIAINFO' | 'XATTR' | 'TYPES' | 'EXTRACT' | 'SPLIT';

export interface MediaFile {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: string;
  parentPath: string;
  isDirectory: boolean;
  checksum?: string;
  xattrs: Record<string, string>;
}

export interface SearchResult {
  id: number;
  name: string;
  year: number | null;
  provider: ProviderType;
}

export interface Episode {
  provider: ProviderType;
  seriesName: string;
  seriesId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteNumber: number | null;
  title: string;
  releaseDate: string | null;
  language: LanguageCode;
  overview?: string;
}

export interface Movie {
  provider: ProviderType;
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  language: LanguageCode;
  overview?: string;
}

export interface Match {
  matchId: string;
  sourceFile: MediaFile;
  targetMetadata: Episode | Movie | null;
  score: number;
  formattedName: string;
  formattedPath: string;
  isExcluded: boolean;
  status: MatchStatus;
}

export interface HistoryElement {
  sourcePath: string;
  targetPath: string;
  action: FileAction;
  status: HistoryStatus;
}

export interface HistoryTransaction {
  transactionId: string;
  timestamp: string;
  elements: HistoryElement[];
}

export interface SubtitleDescriptor {
  provider: SubtitleProviderType;
  id: string;
  name: string;
  language: LanguageCode;
  format: SubtitleFormat;
  score: number;
  downloadUrl: string;
}

export interface ChecksumEntry {
  path: string;
  expectedHash: string | null;
  calculatedHash: string | null;
  hashType: HashType;
  status: ChecksumStatus;
}

export interface SystemStatus {
  appName: string;
  version: string;
  javaVersion: string;
  osName: string;
  osArch: string;
  freeMemoryBytes: number;
  totalMemoryBytes: number;
}

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: string;
}

export interface AppSettings {
  defaultLanguage: LanguageCode;
  defaultAction: FileAction;
  tvFormat: string;
  movieFormat: string;
  musicFormat: string;
  animeFormat: string;
  filterHiddenFiles: boolean;
  recursiveSearch: boolean;
}

export interface BindingDocumentation {
  bindingKey: string;
  description: string;
  exampleValue: string;
  category: BindingCategory;
}

export interface MediaInfoInspector {
  filePath: string;
  containerFormat: string;
  durationMs: number;
  totalBitrate: number;
  videoStreams: any[];
  audioStreams: any[];
  subtitleStreams: any[];
}
