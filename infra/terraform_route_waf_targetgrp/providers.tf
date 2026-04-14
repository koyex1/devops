provider "aws" {
  region = var.aws_region
  #access_key = "my-access-key"
  #secret_key = "my-secret-key"
  assume_role {
    role_arn     = "arn:aws:iam::123456789012:role/ROLE_NAME"
    session_name = "SESSION_NAME"
    external_id  = "EXTERNAL_ID"
  }
}