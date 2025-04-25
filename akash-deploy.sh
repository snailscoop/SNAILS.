#!/bin/bash

# Exit on any error
set -e

# Check for required commands
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v provider-services &> /dev/null; then
    echo "❌ Akash provider-services is not installed. Please install Akash CLI tools first."
    exit 1
fi

# Check for Akash wallet configuration
if [ -z "$AKASH_KEY_NAME" ]; then
    echo "❌ AKASH_KEY_NAME environment variable not set."
    echo "Please set your Akash key name with: export AKASH_KEY_NAME=your-key-name"
    exit 1
fi

if [ -z "$AKASH_KEYRING_BACKEND" ]; then
    export AKASH_KEYRING_BACKEND=os
    echo "Setting AKASH_KEYRING_BACKEND to 'os'"
fi

if [ -z "$AKASH_NODE" ]; then
    export AKASH_NODE="https://rpc.akash.forbole.com:443"
    echo "Setting AKASH_NODE to 'https://rpc.akash.forbole.com:443'"
fi

if [ -z "$AKASH_CHAIN_ID" ]; then
    export AKASH_CHAIN_ID="akashnet-2"
    echo "Setting AKASH_CHAIN_ID to 'akashnet-2'"
fi

# Build the Docker image
echo "🏗️ Building Docker image..."
docker build -t nostr-feed:latest ./nostr-feed

# Tag with a unique tag including timestamp
TIMESTAMP=$(date +%s)
DOCKER_IMAGE_TAG="nostr-feed:$TIMESTAMP"
echo "🏷️ Tagging image as $DOCKER_IMAGE_TAG"
docker tag nostr-feed:latest $DOCKER_IMAGE_TAG

# Push to a Docker registry
echo "Please enter the Docker registry to push to (e.g. ghcr.io/username):"
read DOCKER_REGISTRY

# Login to Docker registry if needed
echo "Do you need to log in to the Docker registry? (y/n)"
read DOCKER_LOGIN
if [ "$DOCKER_LOGIN" = "y" ]; then
    docker login $DOCKER_REGISTRY
fi

FULL_IMAGE_TAG="$DOCKER_REGISTRY/$DOCKER_IMAGE_TAG"
echo "📤 Pushing image to $FULL_IMAGE_TAG"
docker tag $DOCKER_IMAGE_TAG $FULL_IMAGE_TAG
docker push $FULL_IMAGE_TAG

# Update the deploy.yaml with the image tag
echo "📝 Updating deploy.yaml with image tag"
sed -i "s|\${DOCKER_IMAGE_TAG}|$FULL_IMAGE_TAG|g" deploy.yaml

# Create a certificate for Akash
echo "🔐 Creating certificate for Akash"
provider-services tx cert create client --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID

# Create deployment
echo "🚀 Creating deployment on Akash"
DEPLOY_TX=$(provider-services tx deployment create deploy.yaml --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID -y)
echo "$DEPLOY_TX"

# Extract the deployment ID
DEPLOYMENT_ID=$(echo "$DEPLOY_TX" | grep -oP '(?<=deployment-id\s)([^\s]+)')
echo "📋 Deployment ID: $DEPLOYMENT_ID"

# Create lease
echo "⏳ Waiting for bids..."
sleep 30
echo "📊 Getting all bids for deployment"
BIDS=$(provider-services query market bid list --owner=$(provider-services keys show $AKASH_KEY_NAME -a) --state=open --deployment-id=$DEPLOYMENT_ID)
echo "$BIDS"

echo "Please select a provider from the above list by entering the provider address:"
read PROVIDER

echo "Creating lease..."
LEASE_TX=$(provider-services tx market lease create --bid-id="$DEPLOYMENT_ID-$PROVIDER-1" --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID -y)
echo "$LEASE_TX"

echo "✅ Deployment complete! Check the Akash Dashboard to monitor your deployment."
echo "💼 Your deployment ID is: $DEPLOYMENT_ID" 