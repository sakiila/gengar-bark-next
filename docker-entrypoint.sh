#!/bin/sh

# 如果存在外部环境变量文件，则复制到应用目录
if [ -f "/etc/gengar-bark/.env" ]; then
    cp /etc/gengar-bark/.env /app/.env
fi

# 启动应用
exec node server.js
