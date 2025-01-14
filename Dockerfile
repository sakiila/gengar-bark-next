# 基础阶段 - 用于依赖安装
FROM node:18-alpine AS deps
WORKDIR /app

# 添加构建必要的包
RUN apk add --no-cache python3 make g++

# 优化 npm 缓存配置
RUN npm config set cache /tmp/npm-cache --global

# 只复制依赖相关文件，优化缓存层
COPY package*.json ./
RUN --mount=type=cache,target=/tmp/npm-cache \
    npm ci --only=production

# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app

# 环境变量配置
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建应用
RUN --mount=type=cache,target=/tmp/npm-cache \
    npm run build

# 生产阶段
FROM node:18-alpine AS runner
WORKDIR /app

# 安装必要的运行时依赖并清理缓存
RUN apk add --no-cache curl \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir .next \
    && chown nextjs:nodejs .next

# 设置环境变量
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# 复制构建产物和必要文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

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
