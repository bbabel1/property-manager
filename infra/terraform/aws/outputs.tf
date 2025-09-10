output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnets" {
  value = module.vpc.private_subnets
}

output "public_subnets" {
  value = module.vpc.public_subnets
}

output "s3_bucket_name" {
  value = module.app_bucket.s3_bucket_id
}

output "db_endpoint" {
  value = module.db.db_instance_endpoint
}

output "db_identifier" {
  value = module.db.db_instance_identifier
}

