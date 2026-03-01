variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "internship-app"
}

variable "environment" {
  type    = string
  default = "dev"
}

# If you already have a VPC/subnets, set these.
# If you leave them null, this module uses the DEFAULT VPC and its subnets.
variable "vpc_id" {
  type    = string
  default = null
}

variable "public_subnet_ids" {
  type    = list(string)
  default = null
}

# Your app ports on EC2/docker host
variable "ui_port" {
  type    = number
  default = 3000
}

variable "api_port" {
  type    = number
  default = 8080
}

# Health checks
variable "ui_health_path" {
  type    = string
  default = "/"
}

variable "api_health_path" {
  type    = string
  default = "/health"
}

# Register existing EC2 instance(s) into target groups
# Put your EC2 instance IDs here, e.g. ["i-0123abcd..."]
variable "instance_ids" {
  type    = list(string)
  default = []
}

# ALB access logs S3 bucket settings
variable "alb_access_logs_enabled" {
  type    = bool
  default = true
}

variable "alb_logs_force_destroy" {
  type    = bool
  default = false
}

# If you *really* want to attempt to fetch ALB IPs (NOT stable), enable this.
variable "enable_alb_ip_lookup" {
  type    = bool
  default = false
}

# ----------------------------
# OPTIONAL (disabled by default) learning toggles
# ----------------------------
variable "enable_route53" {
  type    = bool
  default = false
}

variable "enable_acm_https" {
  type    = bool
  default = false
}

variable "enable_waf" {
  type    = bool
  default = false
}

variable "domain_name" {
  type    = string
  default = "example.com"
}