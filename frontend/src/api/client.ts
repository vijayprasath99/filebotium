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
  LanguageCode,
  EpisodeSortOrder,
  SubtitleProviderType,
  HashType,
  RenameExecutionResult,
  FormatEvaluationResult,
  SubtitleDownloadResult,
  RollbackResult,
  ProviderCredential
} from '../types';
import { apiLogger } from '../utils/apiLogger';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Logs every outgoing REST request
api.interceptors.request.use(
  (config) => {
    const fullUrl = (config.baseURL || '') + (config.url || '');
    const logId = apiLogger.logRestRequest({
      method: config.method || 'GET',
      url: fullUrl,
      queryParams: config.params,
      body: config.data,
      headers: config.headers,
    });
    (config as any).metadata = { startTime: Date.now(), logId };
    return config;
  },
  (error) => {
    apiLogger.logRestError({
      method: 'UNKNOWN',
      url: 'REQUEST_CONFIG_ERROR',
      error,
    });
    return Promise.reject(error);
  }
);

// Response Interceptor: Logs every incoming REST response / error with duration
api.interceptors.response.use(
  (response) => {
    const metadata = (response.config as any)?.metadata;
    const startTime = metadata?.startTime || Date.now();
    const logId = metadata?.logId;
    const durationMs = Date.now() - startTime;
    const fullUrl = (response.config.baseURL || '') + (response.config.url || '');

    apiLogger.logRestResponse({
      logId,
      method: response.config.method || 'GET',
      url: fullUrl,
      status: response.status,
      durationMs,
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  (error) => {
    const config = error.config;
    const metadata = (config as any)?.metadata;
    const startTime = metadata?.startTime || Date.now();
    const logId = metadata?.logId;
    const durationMs = Date.now() - startTime;
    const fullUrl = config ? (config.baseURL || '') + (config.url || '') : 'UNKNOWN_URL';

    apiLogger.logRestError({
      logId,
      method: config?.method || 'GET',
      url: fullUrl,
      status: error.response?.status,
      durationMs,
      error,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

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
  autoMatch: async (
    filePaths: string[],
    provider: ProviderType,
    mode: MatchingMode,
    language: LanguageCode,
    formatExpression?: string
  ): Promise<Match[]> => {
    const res = await api.post('/rename/match', { filePaths, provider, mode, language, formatExpression });
    return res.data;
  },
  updateRowAlignment: async (
    matches: Match[],
    sourceIndex: number,
    targetIndex: number
  ): Promise<Match[]> => {
    const res = await api.post('/rename/align', matches, {
      params: { sourceIndex, targetIndex }
    });
    return res.data;
  },
  applyFormat: async (matches: Match[], formatExpression: string): Promise<Match[]> => {
    const res = await api.post('/rename/format', matches, {
      params: { formatExpression }
    });
    return res.data;
  },
  executeRename: async (
    matches: Match[],
    action: FileAction,
    conflictStrategy: ConflictStrategy
  ): Promise<RenameExecutionResult> => {
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
  },
  evaluateExpression: async (
    expression: string,
    sampleFilePath?: string,
    sampleMetadata?: any
  ): Promise<FormatEvaluationResult> => {
    const res = await api.post('/format/eval', { expression, sampleFilePath, sampleMetadata });
    return res.data;
  }
};

export const episodeApi = {
  searchSeries: async (
    query: string,
    provider: ProviderType,
    language: LanguageCode
  ): Promise<SearchResult[]> => {
    const res = await api.get('/episodes/search', { params: { query, provider, language } });
    return res.data;
  },
  getEpisodes: async (
    seriesId: number,
    provider: ProviderType,
    sortOrder?: EpisodeSortOrder,
    language?: LanguageCode,
    season?: number
  ): Promise<Episode[]> => {
    const res = await api.get(`/episodes/series/${seriesId}`, {
      params: { provider, sortOrder, language, season }
    });
    return res.data;
  },
  getFormattedEpisodeList: async (seriesId: number, expression: string): Promise<string[]> => {
    const res = await api.get(`/episodes/series/${seriesId}/format`, { params: { expression } });
    return res.data;
  }
};

export const subtitleApi = {
  searchSubtitles: async (
    videoFilePaths: string[],
    language: LanguageCode,
    provider: SubtitleProviderType = 'OPEN_SUBTITLES'
  ): Promise<SubtitleDescriptor[]> => {
    const res = await api.post('/subtitles/search', { videoFilePaths, language, provider });
    return res.data;
  },
  downloadSubtitles: async (
    requests: { videoFilePath: string; subtitleId: string; provider?: SubtitleProviderType; targetFormat?: string }[]
  ): Promise<SubtitleDownloadResult> => {
    const res = await api.post('/subtitles/download', requests);
    return res.data;
  }
};

export const sfvApi = {
  parseSfv: async (sfvFilePath: string): Promise<ChecksumEntry[]> => {
    const res = await api.get('/sfv/parse', { params: { sfvFilePath } });
    return res.data;
  },
  startVerificationTask: async (
    filePaths: string[],
    hashType: HashType,
    sfvFilePath?: string
  ): Promise<string> => {
    const res = await api.post('/sfv/verify', { filePaths, hashType, sfvFilePath });
    return res.data;
  },
  cancelVerificationTask: async (taskId: string): Promise<void> => {
    await api.post('/sfv/cancel', null, { params: { taskId } });
  },
  exportVerificationFile: async (
    entries: ChecksumEntry[],
    hashType: HashType,
    outputPath?: string
  ): Promise<string> => {
    const res = await api.post('/sfv/export', { entries, hashType, outputPath });
    return res.data;
  }
};

export const analyzeApi = {
  inspectFile: async (filePath: string): Promise<MediaInfoInspector> => {
    const res = await api.get('/analyze/inspect', { params: { path: filePath } });
    return res.data;
  },
  batchInspect: async (filePaths: string[]): Promise<MediaInfoInspector[]> => {
    const res = await api.post('/analyze/batch-inspect', filePaths);
    return res.data;
  }
};

export const historyApi = {
  getHistory: async (): Promise<HistoryTransaction[]> => {
    const res = await api.get('/history');
    return res.data;
  },
  rollbackTransaction: async (
    transactionId: string,
    targetPathsToRollback?: string[]
  ): Promise<RollbackResult> => {
    const res = await api.post('/history/rollback', { transactionId, targetPathsToRollback });
    return res.data;
  },
  clearHistory: async (): Promise<void> => {
    await api.delete('/history');
  },
  exportHistory: async (format: string = 'xml', outputPath?: string): Promise<void> => {
    await api.post('/history/export', null, { params: { format, outputPath } });
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
  },
  resetToDefaults: async (): Promise<void> => {
    await api.delete('/settings');
  },
  saveCredentials: async (credentials: ProviderCredential): Promise<void> => {
    await api.post('/settings/credentials', credentials);
  }
};
