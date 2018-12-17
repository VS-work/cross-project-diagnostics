export enum Level {
  OFF = 0x0,
  FATAL = 0x1,
  ERROR = 0x2,
  WARNING = 0x4,
  DEBUG = 0x8,
  ALL = FATAL | ERROR | WARNING | DEBUG
}

export const getLevelByLabel = (levelStr: string): Level => {
  switch (levelStr) {
    case 'off': return Level.OFF;
    case 'fatal': return Level.FATAL;
    case 'error': return Level.ERROR;
    case 'warning': return Level.WARNING;
    case 'debug': return Level.DEBUG;
    case 'all': return Level.ALL;
    default: return Level.OFF;
  }
};

export const getLabelByLevel = (level: Level): string => {
  switch (level) {
    case Level.OFF: return 'off';
    case Level.FATAL: return 'fatal';
    case Level.ERROR: return 'error';
    case Level.WARNING: return 'warning';
    case Level.DEBUG: return 'debug';
    case Level.ALL: return 'all';
    default: return 'off';
  }
};

export type DiagnosticRecord = {
  time: string;
  module: string;
  requestId: string;
  version: string;
  funName: string;
  message: string;
  level: string;
  attachment?: any;
};
