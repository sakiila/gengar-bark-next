export interface Command {
  matches(text: string): boolean;
  execute(text: string, userId: string): Promise<void>;
}

export class CommandContext {
  constructor(
    public readonly channel: string,
    public readonly ts: string
  ) {}
} 