#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# 配置
# chmod +x deploy.sh && ./deploy.sh
# ============================================================
REPO="git@github.com:xzz2021/xzz-vue3-nestjs11-admin.git"
BRANCH="main"
COMPOSE_FILE="compose.yml"
MAX_RETRIES=3
RETRY_DELAY=5

# 脚本所在目录，即 admin 目录
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# GitHub SSH 使用 443 端口 + 保活
export GIT_SSH_COMMAND="ssh \
  -o HostName=ssh.github.com \
  -o Port=443 \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=6 \
  -o TCPKeepAlive=yes"

cd "$APP_DIR"

echo "========================================"
echo "开始部署"
echo "目录: $APP_DIR"
echo "仓库: $REPO"
echo "分支: $BRANCH"
echo "========================================"

# ============================================================
# 1. 检查环境
# ============================================================
command -v git >/dev/null 2>&1 || {
  echo "错误: 未安装 Git"
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "错误: 未安装 Docker"
  exit 1
}

docker compose version >/dev/null 2>&1 || {
  echo "错误: Docker Compose 不可用"
  exit 1
}

# ============================================================
# 2. 初始化 / 修正 Git 仓库
# ============================================================
if [ ! -d ".git" ]; then
  echo
  echo "==> 首次部署，初始化 Git 仓库..."

  git init

  git remote add origin "$REPO"

  echo "==> Git 仓库初始化完成"
else
  echo
  echo "==> Git 仓库已存在"

  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REPO"
  else
    git remote add origin "$REPO"
  fi
fi

# ============================================================
# 3. 拉取远程代码，失败自动重试
# ============================================================
echo

FETCH_SUCCESS=false

for ((i=1; i<=MAX_RETRIES; i++)); do
  echo "==> 获取远程最新代码 ($i/$MAX_RETRIES)..."

  if git fetch \
      --depth=1 \
      --prune \
      origin \
      "$BRANCH"; then

    FETCH_SUCCESS=true
    echo "==> Git 拉取成功"
    break
  fi

  echo "==> Git 拉取失败"

  if [ "$i" -lt "$MAX_RETRIES" ]; then
    echo "==> ${RETRY_DELAY} 秒后重新尝试..."
    sleep "$RETRY_DELAY"
  fi
done

if [ "$FETCH_SUCCESS" != true ]; then
  echo
  echo "错误: Git 连续拉取 $MAX_RETRIES 次失败，部署终止"
  exit 1
fi

# ============================================================
# 4. 同步远程 main
# 默认拒绝覆盖未提交改动。确认可以丢掉本地补丁时：FORCE_DEPLOY=1 ./deploy.sh
# ============================================================
echo
echo "==> 同步远程 $BRANCH..."

if [ -z "${FORCE_DEPLOY:-}" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "错误: 工作区有未提交改动，已中止以免 git reset --hard 丢掉补丁。"
    echo "提交或贮藏后再部署，或 FORCE_DEPLOY=1 强制覆盖。"
    git status --short
    exit 1
  fi
fi

git reset --hard "origin/$BRANCH"

# 确保当前本地分支指向远程 main
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null 2>&1

# ============================================================
# 5. 清理 Git 仓库中不存在的旧文件
#
# 保留:
#   .env / .env.*
#   deploy.sh
#   data / logs / uploads / certs / postgre / redis（本地数据与证书）
# ============================================================
echo "==> 清理旧文件..."

git clean -fd \
  -e ".env" \
  -e ".env.*" \
  -e "$SCRIPT_NAME" \
  -e "data" \
  -e "logs" \
  -e "uploads" \
  -e "certs" \
  -e "postgre" \
  -e "redis"

# ============================================================
# 6. 输出当前部署版本
# ============================================================
echo
echo "==> 当前版本:"
git log -1 \
  --date=format:'%Y-%m-%d %H:%M:%S' \
  --pretty=format:'Commit: %h%n时间: %ad%n提交: %s%n作者: %an'

echo
echo

# ============================================================
# 7. 检查 Compose 文件
# ============================================================
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "错误: 仓库中不存在 $COMPOSE_FILE"
  exit 1
fi

# ============================================================
# 8. Docker Compose 构建并启动
# ============================================================
echo "==> 开始 Docker 构建并启动..."
echo

docker compose \
  -f "$COMPOSE_FILE" \
  up -d --build

# ============================================================
# 9. 查看容器状态
# ============================================================
echo
echo "==> Docker 服务状态:"
echo

docker compose \
  -f "$COMPOSE_FILE" \
  ps

echo
echo "========================================"
echo "部署完成"
echo "========================================"
