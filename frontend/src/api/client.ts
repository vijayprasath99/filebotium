import axios from 'axios';
import {
  SystemStatus,
  MediaFile,
  WorkspaceTab,
  Match,
  FileAction,
  ConflictStrategy,
  BindingDocumentation,
  SearchResult,
  Episode,
  SubtitleDescriptor,
  ChecksumEntry,
  MediaInfoInspector,
  HistoryTransaction,
  AppSettings,
  ProviderType,
  MatchingMode,
  LanguageCode
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const appApi = {
  getStatus: async (): Promise<SystemStatus> => {
    const res = await api.get('/app/status');
    return res.data;
  },
  intakeFiles: async (paths: string[], targetWorkspace: WorkspaceTab): Promise<MediaFile[]> => {
    const res = await api.post('/app/intake', { paths, recursive: true, filterHidden: true, targetWorkspace });
    return res.data;
  }
};

export const renameApi = {
  autoMatch: async (filePaths: string[], provider: ProviderType, mode: MatchingMode, language: LanguageCode, formatExpression?: string): Promise<Match[]> => {
    const res = await api.post('/rename/match', { filePaths, provider, mode, language, formatExpression });
    return res.data;
  },
  executeRename: async (matches: Match[], action: FileAction, conflictStrategy: ConflictStrategy) => {
    const res = await api.post('/rename/execute', { matches, action, conflictStrategy });
    return res.data;
  }
};

export const formatApi = {
  getBindings: async (filePath?: string): Promise<BindingDocumentation[]> => {
    const res = await api.get('/format/bindings', { params: { filePath } });
    return res.data;
  },
  validateExpression: async (expression: string): Promise<boolean> => {
    const res = await api.post('/format/validate', { expression });
    return res.data;
  }
};

export const episodeApi = {
  searchSeries: async (query: string, provider: ProviderType, language: LanguageCode): Promise<SearchResult[]> => {
    const res = await api.get('/episodes/search', { params: { query, provider, language } });
    return res.data;
  },
  getEpisodes: async (seriesId: number, provider: ProviderType): Promise<Episode[]> => {
    const res = await api.get(`/episodes/series/${seriesId}`, { params: { provider } });
    return res.data;
  }
};

export const subtitleApi = {
  searchSubtitles: async (videoFilePaths: string[], language: LanguageCode): Promise<SubtitleDescriptor[]> => {
    const res = await api.post('/subtitles/search', { videoFilePaths, language, provider: 'OPEN_SUBTITLES' });
    return res.data;
  }
};

export const sfvApi = {
  parseSfv: async (sfvFilePath: string): Promise<ChecksumEntry[]> => {
    const res = await api.get('/sfv/parse', { params: { sfvFilePath } });
    return res.data;
  }
};

export const analyzeApi = {
  inspectFile: async (filePath: string): Promise<MediaInfoInspector> => {
    const res = await api.get('/analyze/inspect', { params: { path: filePath } });
    return res.data;
  }
};

export const historyApi = {
  getHistory: async (): Promise<HistoryTransaction[]> => {
    const res = await api.get('/history');
    return res.data;
  }
};

export const settingsApi = {
  getSettings: async (): Promise<AppSettings> => {
    const res = await api.get('/settings');
    return res.data;
  },
  updateSettings: async (settings: AppSettings): Promise<AppSettings> => {
    const res = await api.put('/settings', settings);
    return res.data;
  }
};
