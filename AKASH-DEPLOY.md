# Deploying Nostr Feed on Akash Network

This guide will walk you through deploying the Nostr Feed application on the Akash Network, a decentralized cloud computing marketplace.

## Prerequisites

Before you begin, ensure you have the following:

1. **Akash CLI Tools**: Install the Akash CLI tools by following the [official documentation](https://docs.akash.network/guides/cli/installation).
2. **Akash Account**: Create an Akash account and fund it with AKT tokens.
3. **Docker**: Install Docker on your local machine.
4. **Docker Registry Account**: You'll need an account on a Docker registry service (Docker Hub, GitHub Container Registry, etc.).

## Setup Akash Environment

Set up your Akash environment variables:

```bash
export AKASH_KEY_NAME=your-key-name
export AKASH_KEYRING_BACKEND=os
export AKASH_CHAIN_ID=akashnet-2
export AKASH_NODE=https://rpc.akash.forbole.com:443
```

Replace `your-key-name` with your Akash key name.

## Deployment Steps

### 1. Automated Deployment

We've created a script that automates the deployment process:

```bash
./akash-deploy.sh
```

This script will:
- Build the Docker image
- Push it to your Docker registry
- Deploy the application on Akash
- Help you create a lease with a provider

### 2. Manual Deployment

If you prefer to deploy manually, follow these steps:

#### Build and Push Docker Image

```bash
# Build the Docker image
docker build -t nostr-feed:latest ./nostr-feed

# Tag with a registry
docker tag nostr-feed:latest your-registry/nostr-feed:latest

# Push to registry
docker push your-registry/nostr-feed:latest
```

#### Update deploy.yaml

Edit the `deploy.yaml` file and replace `${DOCKER_IMAGE_TAG}` with your Docker image URI.

#### Create Certificate

```bash
provider-services tx cert create client --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID
```

#### Create Deployment

```bash
provider-services tx deployment create deploy.yaml --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID -y
```

#### Find Your Deployment ID

Look for the `deployment-id` in the output of the previous command.

#### List Bids

```bash
provider-services query market bid list --owner=$(provider-services keys show $AKASH_KEY_NAME -a) --state=open --deployment-id=YOUR_DEPLOYMENT_ID
```

#### Create Lease

```bash
provider-services tx market lease create --bid-id="YOUR_DEPLOYMENT_ID-PROVIDER_ADDRESS-1" --from=$AKASH_KEY_NAME --chain-id=$AKASH_CHAIN_ID -y
```

## Monitoring Your Deployment

You can monitor your deployment using the Akash Console UI at [https://console.akash.network/](https://console.akash.network/).

## Troubleshooting

If you encounter any issues:

1. Check your Akash account balance
2. Verify your Docker image is accessible
3. Ensure your deploy.yaml is correctly formatted
4. Check the logs of your deployment on the Akash Console

## Costs

Akash costs are typically much lower than traditional cloud providers. The deployment specified in our configuration file has:
- 0.5 CPU units
- 512 MB of RAM
- 1 GB of storage
- Priced at 1000 uakt (micro-AKT) per block

This configuration should be sufficient for a moderate load on the Nostr Feed application.

## Updating Your Deployment

To update your deployment:
1. Build and push a new Docker image
2. Update the deploy.yaml file with the new image tag
3. Close your existing deployment
4. Create a new deployment with the updated deploy.yaml 