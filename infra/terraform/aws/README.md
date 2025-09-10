AWS Baseline (Terraform)

Includes
- Networking: VPC with public/private subnets across 2 AZs, NAT gateway
- Object Storage: S3 bucket (versioned, private)
- Database: RDS Postgres 16 (single-AZ t4g.micro), private subnets
- Compute: TODO (add App Runner or ECS Fargate in a follow-up)

Prerequisites
- Terraform >= 1.5, AWS CLI configured with an account/role

Usage
```bash
cd infra/terraform/aws
terraform init
terraform plan -var 'db_username=app' -var 'db_password=change-me' -out plan.tfplan
terraform apply plan.tfplan
```

Variables
- `name` (default `property-manager`) – resource name prefix
- `aws_region` (default `us-east-1`)
- `vpc_cidr` (default `10.0.0.0/16`)
- `db_username`, `db_password` (required)
- `db_name` (default `app`)

Outputs
- `vpc_id`, `private_subnets`, `public_subnets`
- `s3_bucket_name`
- `db_endpoint`, `db_identifier`

Next (Compute)
- App Runner (simplest): create `aws_apprunner_service` referencing your container image.
- ECS Fargate: add ECS cluster + service module and an ALB; place service in private subnets.

Notes
- This baseline is for staging/dev. For production, enable multi-AZ for RDS, increase instance size, and enable deletion protection/final snapshots.

