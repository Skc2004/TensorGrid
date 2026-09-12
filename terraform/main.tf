terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# VPC for Grid Nodes
resource "aws_vpc" "grid_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "grid-network"
  }
}

# Subnet
resource "aws_subnet" "grid_subnet" {
  vpc_id                  = aws_vpc.grid_vpc.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name = "grid-subnet-public"
  }
}

# Security Group for FastAPI & Redis
resource "aws_security_group" "backend_sg" {
  name        = "backend-sg"
  description = "Allow HTTP and SSH"
  vpc_id      = aws_vpc.grid_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance for the Main Server (FastAPI + Redis + Celery)
resource "aws_instance" "grid_controller" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS us-east-1
  instance_type = "t3.medium"
  subnet_id     = aws_subnet.grid_subnet.id
  vpc_security_group_ids = [aws_security_group.backend_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y docker.io docker-compose
              # Setup FastAPI & Redis stack here
              EOF

  tags = {
    Name = "Grid-Controller-Node"
  }
}

output "controller_public_ip" {
  value = aws_instance.grid_controller.public_ip
}
