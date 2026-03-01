# This file contains the variable definitions for the Terraform configuration.
# You can set these variables in this file(terraform.tfvars) or override them with environment variables or CLI arguments.
aws_region    = "us-east-1"
project_name  = "internship-app"
environment   = "dev"

ui_port = 3000
api_port = 8080

# Put your existing EC2 instance IDs here
instance_ids = ["i-0123456789abcdef0"]

alb_access_logs_enabled = true

# Keep these OFF by default (your request)
enable_route53  = false
enable_acm_https = false
enable_waf      = false

domain_name = "example.com"