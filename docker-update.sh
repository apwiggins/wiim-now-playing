#!/usr/bin/env bash

# A helper script to pull the latest code from GitHub and run w-n-p

# Determine whether to use 'docker-compose' or 'docker compose'
if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"\else
  echo "Error: Neither 'docker-compose' nor 'docker compose' is available. Please install Docker Compose."
  exit 1
fi

# Build updated container from GitHub
$DOCKER_COMPOSE build --no-cache

# Stop the service (if running) and restart the service
$DOCKER_COMPOSE down
$DOCKER_COMPOSE up -d

echo "Clean up dangling images with $DOCKER_COMPOSE image prune"
# $DOCKER_COMPOSE image prune -f
