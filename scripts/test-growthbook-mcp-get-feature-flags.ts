import * as dotenv from 'dotenv';
import * as path from 'path';
import { pathToFileURL } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function normalizeUrl(u: string, fallback: string): string {
  const url = (u?.trim() || fallback).replace(/\/+$/, '');
  return url;
}

type RegisteredTool = {
  name: string;
  handler: (args: any, extra?: any) => Promise<any>;
};

const apiKey = requireEnv('GB_TOKEN');
const BASE_API_URL = requireEnv('GB_API_HOST');
const APP_ORIGIN = requireEnv('GB_API_HOST');

async function main() {
  const baseApiUrl = normalizeUrl(BASE_API_URL, 'https://api.growthbook.io');
  const appOrigin = normalizeUrl(APP_ORIGIN, 'https://app.growthbook.io');

  const serverToolsPath = path.resolve(
    process.cwd(),
    'growthbook-mcp',
    'server',
    'tools',
    'features.js'
  );

  // 需要先把 growthbook-mcp 编译成 server/，否则 features.js 不存在
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await import(pathToFileURL(serverToolsPath).href);
  } catch {
    throw new Error(
      [
        `Cannot import compiled GrowthBook MCP tools at: ${serverToolsPath}`,
        'Please run:',
        '  cd growthbook-mcp',
        '  npm ci',
        '  npm run build',
      ].join('\n')
    );
  }

  const featuresMod = (await import(pathToFileURL(serverToolsPath).href)) as {
    registerFeatureTools: (args: any) => void;
  };

  const tools: RegisteredTool[] = [];
  const server = {
    registerTool: (name: string, _config: any, handler: any) => {
      tools.push({ name, handler });
    },
    // Back-compat (some tests/modules call server.tool)
    tool: (name: string, _desc: string, _schema: any, _hints: any, handler: any) => {
      tools.push({ name, handler });
    },
    server: {
      notification: async () => {},
    },
  };

  featuresMod.registerFeatureTools({
    server,
    baseApiUrl,
    apiKey,
    appOrigin,
  });

  const tool = tools.find((t) => t.name === 'get_feature_flags');
  if (!tool) {
    throw new Error('Tool get_feature_flags not found in registerFeatureTools');
  }

  // 最小参数：不传 featureFlagId => 列表模式
  const featureFlagIdArg = process.argv.slice(2).find((a) => a.startsWith('--id='));
  const featureFlagId = featureFlagIdArg ? featureFlagIdArg.split('=')[1] : undefined;

  const handlerArgs = featureFlagId
    ? {
        featureFlagId,
        // pagination params 仍然可能需要（schema 里统一复用）
        limit: 10,
        offset: 0,
        mostRecent: false,
      }
    : {
        limit: 10,
        offset: 0,
        mostRecent: false,
      };

  console.log('Calling get_feature_flags with args:', handlerArgs);
  const res = await tool.handler(handlerArgs);

  const text = res?.content?.[0]?.text;
  if (typeof text === 'string') {
    console.log('\n--- get_feature_flags result (first content block) ---\n');
    console.log(text);
  } else {
    console.log('\n--- get_feature_flags result ---\n');
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

