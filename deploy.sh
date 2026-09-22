#!/bin/bash

echo "Pulling latest code..."
git pull

echo "Building new Docker image..."
docker build --no-cache -t management_employee_cms_web:latest .

echo "Ensuring overlay network exists..."
docker network create -d overlay emp_cms_network 2>/dev/null || true

echo "Deploying stack..."
docker stack deploy -c docker-compose.yml management_employee_cms_web

echo "Forcing service update to apply new image..."
docker service update --force management_employee_cms_web_web

echo "Deploy Management Employee CMS Web completed!"
