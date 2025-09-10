variable "name" {
  description = "Project/name prefix for resources"
  type        = string
  default     = "property-manager"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_username" {
  description = "RDS Postgres master username"
  type        = string
}

variable "db_password" {
  description = "RDS Postgres master password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Initial Postgres database name"
  type        = string
  default     = "app"
}

