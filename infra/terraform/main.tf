locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ----------------------------
# VPC/Subnets (default VPC fallback)
# ----------------------------
data "aws_vpc" "default" { #data is different from local because it fetches existing VPC info from AWS
  count   = var.vpc_id == null ? 1 : 0
  default = true
}

data "aws_subnets" "default_public" {
  count = var.public_subnet_ids == null ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
}

locals {
  effective_vpc_id        = var.vpc_id != null ? var.vpc_id : data.aws_vpc.default[0].id
  effective_public_subnets = var.public_subnet_ids != null ? var.public_subnet_ids : data.aws_subnets.default_public[0].ids
}

# ----------------------------
# S3 bucket for ALB access logs
# ----------------------------
resource "random_id" "logs" {
  byte_length = 4
}

resource "aws_s3_bucket" "alb_logs" {
  count         = var.alb_access_logs_enabled ? 1 : 0
  bucket        = "${var.project_name}-${var.environment}-alb-logs-${random_id.logs.hex}"
  force_destroy = var.alb_logs_force_destroy
  tags          = local.tags
}

resource "aws_s3_bucket_ownership_controls" "alb_logs" {
  count  = var.alb_access_logs_enabled ? 1 : 0
  bucket = aws_s3_bucket.alb_logs[0].id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  count                   = var.alb_access_logs_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.alb_logs[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allow ALB service to write logs into the bucket
data "aws_elb_service_account" "this" {}

data "aws_iam_policy_document" "alb_logs" {
  count = var.alb_access_logs_enabled ? 1 : 0

  statement {
    sid = "AWSALBAccessLogs"
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.this.arn]
    }
    actions = ["s3:PutObject"]
    resources = [
      "${aws_s3_bucket.alb_logs[0].arn}/AWSLogs/*"
    ]
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  count  = var.alb_access_logs_enabled ? 1 : 0
  bucket = aws_s3_bucket.alb_logs[0].id
  policy = data.aws_iam_policy_document.alb_logs[0].json
}

# Optional lifecycle to reduce cost
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  count  = var.alb_access_logs_enabled ? 1 : 0
  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    id     = "expire-logs"
    status = "Enabled"
    expiration {
      days = 30
    }
  }
}

# ----------------------------
# Security Groups
# ----------------------------
resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "ALB SG: allow inbound HTTP from internet"
  vpc_id      = local.effective_vpc_id
  tags        = local.tags

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-${var.environment}-app-sg"
  description = "App SG: only allow app ports from ALB SG"
  vpc_id      = local.effective_vpc_id
  tags        = local.tags

  ingress {
    description     = "UI from ALB"
    from_port       = var.ui_port
    to_port         = var.ui_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    description     = "API from ALB"
    from_port       = var.api_port
    to_port         = var.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ----------------------------
# Target Groups
# ----------------------------
resource "aws_lb_target_group" "ui_tg" {
  name        = "${var.project_name}-${var.environment}-ui"
  port        = var.ui_port
  protocol    = "HTTP"
  vpc_id      = local.effective_vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = var.ui_health_path
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    unhealthy_threshold = 2
    healthy_threshold   = 2
  }

  tags = local.tags
}

resource "aws_lb_target_group" "api_tg" {
  name        = "${var.project_name}-${var.environment}-api"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = local.effective_vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = var.api_health_path
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    unhealthy_threshold = 2
    healthy_threshold   = 2
  }

  tags = local.tags
}

# Attach existing EC2 instances to the TGs
resource "aws_lb_target_group_attachment" "ui" {
  for_each         = toset(var.instance_ids)
  target_group_arn = aws_lb_target_group.ui_tg.arn
  target_id        = each.value
  port             = var.ui_port
}

resource "aws_lb_target_group_attachment" "api" {
  for_each         = toset(var.instance_ids)
  target_group_arn = aws_lb_target_group.api_tg.arn
  target_id        = each.value
  port             = var.api_port
}

# ----------------------------
# ALB
# ----------------------------
resource "aws_lb" "alb" {
  name               = "${var.project_name}-${var.environment}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = local.effective_public_subnets
  tags               = local.tags

  dynamic "access_logs" {
    for_each = var.alb_access_logs_enabled ? [1] : []
    content {
      bucket  = aws_s3_bucket.alb_logs[0].bucket
      enabled = true
      prefix  = "${var.project_name}/${var.environment}"
    }
  }
}

# HTTP Listener :80
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  # Default: send to UI TG (so you can hit ALB DNS immediately)
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui_tg.arn
  }
}

# Rule: /api/* -> API TG
resource "aws_lb_listener_rule" "api_path" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}