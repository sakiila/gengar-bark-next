/**
 * AI 模型配置
 * 统一管理系统使用的默认 AI 模型，支持通过环境变量灵活覆盖
 */

export const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';
export const DEFAULT_MODEL = DEFAULT_AI_MODEL;
