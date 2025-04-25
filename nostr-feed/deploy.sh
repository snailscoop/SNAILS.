#!/bin/bash

# Make script exit on any error
set -e

echo "🚀 Starting snails.tube deployment"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Pull the latest changes if this is a git repository
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes from git..."
    git pull
fi

# Build and start the containers
echo "🏗️ Building and starting Docker containers..."
docker-compose up -d --build

# Check if the containers are running
if [ $? -eq 0 ]; then
    echo "✅ snails.tube is now running!"
    echo "🌐 You can access it at http://localhost or your server's domain"
else
    echo "❌ Deployment failed. Check the Docker logs for more information."
    docker-compose logs
    exit 1
fi

echo "📝 To view logs, run: docker-compose logs -f"
echo "🛑 To stop the application, run: docker-compose down" 