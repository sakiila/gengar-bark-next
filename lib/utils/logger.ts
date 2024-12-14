import { Logger } from 'next-axiom';

// Type for structured log data
type LogData = Record<string, any>;

class AxiomLogger {
  private logger: Logger;
  private static instance: AxiomLogger;

  private constructor(source: string = 'default') {
    this.logger = new Logger({ source });
  }

  public static getInstance(source?: string): AxiomLogger {
    if (!AxiomLogger.instance) {
      AxiomLogger.instance = new AxiomLogger(source);
    }
    return AxiomLogger.instance;
  }

  // Recreate logger with new source
  public withSource(source: string): AxiomLogger {
    return new AxiomLogger(source);
  }

  // Helper to structure data
  private formatLogData(message: string, data?: LogData): LogData {
    return {
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };
  }

  // Log levels matching console.* methods
  public log(message: string, data?: LogData): void {
    this.logger.info(message, this.formatLogData(message, data));
  }

  public info(message: string, data?: LogData): void {
    this.logger.info(message, this.formatLogData(message, data));
  }

  public warn(message: string, data?: LogData): void {
    this.logger.warn(message, this.formatLogData(message, data));
  }

  public error(message: string, error?: Error | LogData): void {
    const errorData = error instanceof Error ? {
      error: error.message,
      stack: error.stack,
      name: error.name,
    } : error;

    this.logger.error(message, this.formatLogData(message, errorData));
  }

  public debug(message: string, data?: LogData): void {
    this.logger.debug(message, this.formatLogData(message, data));
  }

  // Flush logs - important for serverless environments
  public async flush(): Promise<void> {
    await this.logger.flush();
  }

  // Create a scoped logger with additional context
  public scope(scope: string, defaultData?: LogData) {
    const scopedLogger = this.withSource(`${this.logger.source}:${scope}`);
    return {
      log: (message: string, data?: LogData) =>
        scopedLogger.log(message, { ...defaultData, ...data }),
      info: (message: string, data?: LogData) =>
        scopedLogger.info(message, { ...defaultData, ...data }),
      warn: (message: string, data?: LogData) =>
        scopedLogger.warn(message, { ...defaultData, ...data }),
      error: (message: string, error?: Error | LogData) =>
        scopedLogger.error(message, error),
      debug: (message: string, data?: LogData) =>
        scopedLogger.debug(message, { ...defaultData, ...data }),
      flush: () => scopedLogger.flush(),
    };
  }
}

// Export a default instance
export const logger = AxiomLogger.getInstance();

// Export the class for cases where a new instance is needed
export { AxiomLogger };

// Export a type for the logger
export type ILogger = ReturnType<AxiomLogger['scope']>;
