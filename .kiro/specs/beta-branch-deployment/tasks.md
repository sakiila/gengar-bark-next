# Implementation Plan: Beta Branch Deployment

## Overview

创建 GitHub Actions workflow 文件实现 beta 分支的独立 Docker 容器部署，使用端口 3002 与生产环境（端口 3001）隔离。

## Tasks

- [x] 1. 创建 Beta 部署 Workflow 文件
  - [x] 1.1 创建 `.github/workflows/deploy-beta.yml` 文件
    - 基于现有 `deploy.yml` 结构
    - 修改触发分支为 `beta`
    - 设置容器名称为 `gengar-bark-beta`
    - 设置主机端口为 `3002`
    - 设置镜像标签为 `beta-latest` 和 `beta-{VERSION}`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.2, 6.1, 6.2_

  - [x] 1.2 配置部署脚本
    - 添加停止和删除现有 beta 容器的逻辑
    - 配置健康检查使用端口 3002
    - 添加 beta 特定的部署标签
    - 配置内存限制与生产环境一致
    - _Requirements: 2.3, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 2. Checkpoint - 验证配置
  - 确保 YAML 语法正确
  - 确保端口配置与生产环境不冲突
  - 如有问题请告知

## Notes

- 本功能主要是 CI/CD 配置，不涉及应用代码修改
- Beta 环境使用与生产环境相同的 ENV_PROD 环境变量
- 部署后需要手动测试：创建 beta 分支并推送代码验证部署流程
