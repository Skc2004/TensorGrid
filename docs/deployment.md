# Deployment & Infrastructure

The Grid Ops platform relies on automated pipelines for continuous integration and Infrastructure-as-Code (IaC) for cloud provisioning.

## CI/CD Pipeline (GitHub Actions)
The workflow is defined in `.github/workflows/ci.yml`. It triggers on pushes and pull requests to the `main` branch.

### Jobs
1. **build-agent (Windows)**: Provisions a `windows-latest` runner, sets up Go 1.21, runs the test suite (`go test ./...`), and builds the Go agent executable (`execute-node-agent.exe`).
2. **build-frontend (Ubuntu)**: Provisions an `ubuntu-latest` runner, sets up Node.js 18, installs dependencies (`npm ci`), and builds the React production bundle (`npm run build`).

## Infrastructure as Code (Terraform)
The AWS infrastructure for the central API server and Redis broker is defined in `terraform/main.tf`.

### Resources Provisioned
- **VPC & Subnet**: A custom `10.0.0.0/16` Virtual Private Cloud with a public subnet `10.0.1.0/24`.
- **Security Group**: Opens ports `80` (HTTP), `8000` (FastAPI backend), and `22` (SSH) for inbound traffic.
- **EC2 Instance**: A `t3.medium` instance running Ubuntu 22.04 LTS. The `user_data` script automatically installs Docker and Docker Compose on boot, preparing the node to host the FastAPI and Redis stack.

### Usage
```bash
cd terraform
terraform init
terraform apply -auto-approve
```
The output will yield `controller_public_ip`, which is where the DNS should be pointed for the web interface.

## Auto-Scaling
The FastAPI backend contains a background asynchronous loop that tracks the Redis queue size. In a production scenario, this loop utilizes the AWS `boto3` SDK to request EC2 Spot Instances (using `ec2.request_spot_instances`) when the queue depth exceeds available compute nodes, ensuring cost-efficient scaling.
