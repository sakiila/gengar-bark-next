# Requirements Document

## Introduction

本功能实现 beta 分支的独立 Docker 容器部署。当代码推送到 beta 分支时，系统将自动构建并部署到一个独立的 Docker 容器中，使用不同的端口，以便与生产环境（main 分支）隔离运行。

## Glossary

- **Beta_Container**: 运行 beta 分支代码的独立 Docker 容器实例
- **Production_Container**: 运行 main 分支代码的生产环境 Docker 容器
- **Deploy_Workflow**: GitHub Actions 自动化部署工作流
- **Container_Port**: Docker 容器对外暴露的网络端口

## Requirements

### Requirement 1: Beta 分支触发部署

**User Story:** As a developer, I want the system to automatically deploy when I push to the beta branch, so that I can test new features in an isolated environment.

#### Acceptance Criteria

1. WHEN code is pushed to the beta branch, THE Deploy_Workflow SHALL trigger a new deployment pipeline
2. WHEN the beta deployment is triggered, THE Deploy_Workflow SHALL build a Docker image with a beta-specific tag
3. WHEN markdown files, .gitignore, or LICENSE are changed, THE Deploy_Workflow SHALL NOT trigger deployment

### Requirement 2: 独立容器部署

**User Story:** As a developer, I want beta deployments to run in a separate container, so that beta testing does not affect the production environment.

#### Acceptance Criteria

1. THE Beta_Container SHALL be named "gengar-bark-beta" to distinguish from the production container
2. THE Beta_Container SHALL run independently from the Production_Container
3. WHEN deploying beta, THE Deploy_Workflow SHALL stop and remove any existing Beta_Container before starting a new one
4. THE Beta_Container SHALL use the same Docker image base as production but with beta-specific configuration

### Requirement 3: 端口隔离

**User Story:** As a developer, I want beta and production containers to use different ports, so that both environments can run simultaneously without conflicts.

#### Acceptance Criteria

1. THE Production_Container SHALL continue to use port 3001 (mapped from internal 3000)
2. THE Beta_Container SHALL use port 3002 (mapped from internal 3000)
3. THE Beta_Container SHALL bind to 127.0.0.1 for security, same as production

### Requirement 4: 环境配置

**User Story:** As a developer, I want beta deployments to use appropriate environment variables, so that beta testing uses the correct configuration.

#### Acceptance Criteria

1. THE Deploy_Workflow SHALL use the same environment secrets as production (ENV_PROD)
2. THE Beta_Container SHALL have deployment labels indicating beta version and timestamp
3. THE Beta_Container SHALL use the same resource limits as production (1g memory, 512m reservation)

### Requirement 5: 健康检查与验证

**User Story:** As a developer, I want beta deployments to be verified, so that I know the deployment was successful.

#### Acceptance Criteria

1. THE Beta_Container SHALL have health check configured on port 3000 (internal)
2. WHEN beta deployment completes, THE Deploy_Workflow SHALL verify health via port 3002
3. IF health check fails after maximum retries, THEN THE Deploy_Workflow SHALL output container logs and fail the deployment

### Requirement 6: 镜像标签管理

**User Story:** As a developer, I want beta images to have distinct tags, so that I can identify and manage beta versions separately.

#### Acceptance Criteria

1. THE Deploy_Workflow SHALL tag beta images with "beta-latest" and "beta-{VERSION}" format
2. THE Deploy_Workflow SHALL generate VERSION using timestamp and git short SHA
3. THE Beta_Container SHALL have labels for deployment version and timestamp
