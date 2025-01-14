# 基础阶段 - 用于依赖安装
FROM node:18-alpine AS deps
WORKDIR /app

# 添加构建必要的包并清理缓存
RUN apk add --no-cache python3 make g++ \
    && rm -rf /var/cache/apk/*

# 优化 npm 缓存配置
RUN npm config set cache /tmp/npm-cache --global

# 只复制依赖相关文件，优化缓存层
COPY package*.json ./

# 安装依赖并清理缓存
RUN --mount=type=cache,target=/tmp/npm-cache \
    npm ci --only=production \
    && npm cache clean --force \
    && rm -rf /tmp/npm-cache/*

# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app

# 环境变量配置
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 复制依赖和源代码
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建应用并清理
RUN --mount=type=cache,target=/tmp/npm-cache \
    npm run build \
    && npm cache clean --force \
    && rm -rf /tmp/npm-cache/* \
    # 删除构建后不需要的文件
    && rm -rf node_modules/.cache \
    && find . -name "*.map" -type f -delete

# 生产阶段
FROM node:18-alpine AS production
WORKDIR /app

# 安装必要的运行时依赖并清理缓存
RUN apk add --no-cache curl \
    && rm -rf /var/cache/apk/* \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir .next \
    && chown nextjs:nodejs .next

# 设置环境变量
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# 优化复制策略，只复制必要文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 生产环境特定优化
RUN find . -type f -name "*.js.map" -delete \
    && find . -type f -name "*.d.ts" -delete \
    && rm -rf /tmp/* \
    # 压缩静态资源
    && if [ -d .next/static ]; then \
         find .next/static -type f -name "*.js" -exec gzip -k {} \; ; \
         find .next/static -type f -name "*.css" -exec gzip -k {} \; ; \
       fi

# 只在构建时复制环境文件，不包含在版本控制中
COPY --chown=nextjs:nodejs .env ./

# 切换到非 root 用户
USER nextjs

# 优化健康检查配置
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["node", "server.js"]
