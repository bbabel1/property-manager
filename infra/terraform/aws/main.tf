locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = var.name
  cidr = var.vpc_cidr

  azs             = local.azs
  public_subnets  = [for i, az in local.azs : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = [for i, az in local.azs : cidrsubnet(var.vpc_cidr, 4, i + 8)]

  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = {
    Project = var.name
  }
}

module "app_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.1"

  bucket        = "${var.name}-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"
  force_destroy = false

  versioning = {
    enabled = true
  }

  block_public_acls   = true
  block_public_policy = true
  restrict_public_buckets = true
  ignore_public_acls      = true

  tags = {
    Project = var.name
  }
}

module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.5"

  identifier = "${var.name}-db"

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"

  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  max_allocated_storage = 100

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  port = 5432

  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = false

  vpc_security_group_ids = []
  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets

  maintenance_window = "Sun:03:00-Sun:04:00"
  backup_window      = "03:00-04:00"
  backup_retention_period = 7

  tags = {
    Project = var.name
  }
}

# TODO: Compute baseline (choose one in future iteration):
# - AWS App Runner (simple container hosting)
# - ECS Fargate service behind ALB (private subnets)
# - EKS (Kubernetes)
# For now, networking, storage, and database are provisioned.

