# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app

# 复制 package 文件
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 创建 public/images 目录并确保适当的权限
RUN mkdir -p public/images

# 构建应用
RUN npm run build

# 运行阶段
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 复制必要文件
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 创建 public/images 目录（如果不存在）
RUN mkdir -p public/images

# 设置适当的权限
RUN chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动命令
CMD ["npm", "start"]
