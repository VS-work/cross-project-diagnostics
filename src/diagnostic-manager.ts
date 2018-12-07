import { DiagnosticRecord, getLabelByLevel, Level } from './definitions';

export const getLevelAvailability = (currentLevel: Level, expectedLevel: Level): boolean => {
  const levelPriorities = [Level.OFF, Level.FATAL, Level.ERROR, Level.WARNING, Level.DEBUG, Level.ALL];

  let totalPriority = Level.OFF;

  for (const level of levelPriorities) {
    totalPriority |= level;

    if (level === currentLevel) {
      break;
    }
  }

  return (totalPriority & expectedLevel) !== 0;
};

export interface DiagnosticDescriptor {
  module: string;
  version: string;
  level: Level;
  requestId?: string;
}

export interface DiagnosticManager {
  diagnosticDescriptor: DiagnosticDescriptor;

  getFatalListener(): Function;

  setFatalListener(onFatal: Function);

  fatal(funName: string, message: string, attachment?);

  error(funName: string, message: string, attachment?);

  warning(funName: string, message: string, attachment?);

  debug(funName: string, message: string, attachment?);

  prepareDiagnosticFor(funName: string);

  addRecord(record: DiagnosticRecord);
}

export class LiftingDiagnosticManager implements DiagnosticManager {
  private parents: DiagnosticManager[] = [];
  private onFatal: Function;

  constructor(public readonly diagnosticDescriptor: DiagnosticDescriptor) {
    if (!this.diagnosticDescriptor.level) {
      this.diagnosticDescriptor.level = Level.ERROR;
    }
  }

  addOutputTo(parent: DiagnosticManager) {
    this.parents.push(parent);
  }


  getFatalListener(): Function {
    return this.onFatal;
  }

  setFatalListener(onFatal: Function) {
    this.onFatal = onFatal;
  }

  fatal(funName: string, message: string, attachmentPar) {
    if (getLevelAvailability(this.diagnosticDescriptor.level, Level.FATAL)) {
      const attachment = attachmentPar instanceof Error ? attachmentPar.stack : attachmentPar;

      if (this.onFatal) {
        this.onFatal(attachment);
      }

      this.addRecord(this.prepareRecord({funName, message, attachment}, Level.FATAL));
    }
  }

  error(funName: string, message: string, attachmentPar) {
    if (getLevelAvailability(this.diagnosticDescriptor.level, Level.ERROR)) {
      const attachment = attachmentPar instanceof Error ? attachmentPar.stack : attachmentPar;

      this.addRecord(this.prepareRecord({funName, message, attachment}, Level.ERROR));
    }
  }

  warning(funName: string, message: string, attachment?) {
    if (getLevelAvailability(this.diagnosticDescriptor.level, Level.WARNING)) {
      this.addRecord(this.prepareRecord({funName, message, attachment}, Level.WARNING));
    }
  }

  debug(funName: string, message: string, attachment?) {
    if (getLevelAvailability(this.diagnosticDescriptor.level, Level.DEBUG)) {
      this.addRecord(this.prepareRecord({funName, message, attachment}, Level.DEBUG));
    }
  }

  prepareDiagnosticFor(funName: string) {
    return {
      fatal: this.prepareFatalFor(funName),
      error: this.prepareErrorFor(funName),
      warning: this.prepareWarningFor(funName),
      debug: this.prepareDebugFor(funName)
    };
  }

  addRecord(record: DiagnosticRecord) {
    if (this.parents.length <= 0) {
      throw Error(`parents are missing for ${this.diagnosticDescriptor.module}@${this.diagnosticDescriptor.version} on ${this.diagnosticDescriptor.requestId}`);
    }

    for (const parent of this.parents) {
      parent.addRecord(record);
    }
  }

  private prepareFatalFor(funName: string) {
    return (message: string, attachment) => {
      this.fatal(funName, message, attachment);
    };
  }

  private prepareErrorFor(funName: string) {
    return (message: string, attachment) => {
      this.error(funName, message, attachment);
    };
  }

  private prepareWarningFor(funName: string) {
    return (message: string, attachment?) => {
      this.warning(funName, message, attachment);
    };
  }

  private prepareDebugFor(funName: string) {
    return (message: string, attachment?) => {
      this.debug(funName, message, attachment);
    };
  }

  private prepareRecord(data, level: Level): DiagnosticRecord {
    const {funName, message, attachment} = data;

    return {
      module: this.diagnosticDescriptor.module,
      version: this.diagnosticDescriptor.version,
      requestId: this.diagnosticDescriptor.requestId,
      funName, message, level: getLabelByLevel(level), attachment
    };
  }
}

export class EndpointDiagnosticManager extends LiftingDiagnosticManager {
  content: DiagnosticRecord[] = [];

  addRecord(record: DiagnosticRecord) {
    this.content.push(record);
  }

  putDiagnosticContentInto(response) {
    response._diagnostic = this.content;
  }

  extractDiagnosticContentFrom(response: string) {
    const jsonResponse = JSON.parse(response);

    if (jsonResponse._diagnostic) {
      this.content.push(...jsonResponse._diagnostic);
    } else {
      throw Error('"_diagnostic" field is NOT defined');
    }
  }
}

export function createDiagnosticManagerOn(module: string, version: string) {
  return {
    forRequest: (requestId: string) => {
      const diagnosticDescriptor = {module, version, requestId, level: null};

      return {
        withSeverityLevel: (level: Level) => {
          diagnosticDescriptor.level = level;

          return new EndpointDiagnosticManager(diagnosticDescriptor);
        }
      };
    },
    basedOn: (parent: DiagnosticManager) => {
      const diagnosticDescriptor = {
        module, version,
        requestId: parent.diagnosticDescriptor.requestId,
        level: parent.diagnosticDescriptor.level
      };
      const diag = new LiftingDiagnosticManager(diagnosticDescriptor);

      diag.addOutputTo(parent);

      if (parent.getFatalListener()) {
        diag.setFatalListener(parent.getFatalListener());
      }

      return diag;
    }
  };
}
