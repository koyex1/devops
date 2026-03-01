# This block ensures that the right terraform and aws provider version is used.
# terraform version 1.5.0 is required for for_each, count, modules on resources, and version 5.0 of the AWS
# provider is required for aws_vpc, aws_subnet, etc.
# random version is required for random_id resource used for unique S3 bucket names.
terraform {
  # Required version
  required_version = ">= 1.5.0"

  # Required providers
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }

}
