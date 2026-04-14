# ============================================================
# OPTIONAL / LEARNING RESOURCES (DISABLED BY DEFAULT)
# Route53 Hosted Zone + ACM + HTTPS Listener + WAF + WAF logging
# ============================================================

# ----------------------------
# Route53 Hosted Zone (costs monthly)
# ----------------------------
resource "aws_route53_zone" "this" {
  count = var.enable_route53 ? 1 : 0
  name  = var.domain_name
  tags  = local.tags
}

# ----------------------------
# ACM certificate (free, but tied to domain validation)
# ----------------------------
resource "aws_acm_certificate" "this" {
  count             = var.enable_acm_https ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  tags = local.tags
}

# HTTPS listener (requires cert issued + validated)
resource "aws_lb_listener" "https" {
  count             = var.enable_acm_https ? 1 : 0
  load_balancer_arn = aws_lb.alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.this[0].arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

# ----------------------------
# WAF (costs monthly)
# ----------------------------
resource "aws_wafv2_web_acl" "this" {
  count = var.enable_waf ? 1 : 0

  name  = "${var.project_name}-${var.environment}-web-acl"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-web-acl"
    sampled_requests_enabled   = true
  }

  # Example managed rule group: CommonRuleSet
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "alb" {
  count        = var.enable_waf ? 1 : 0
  resource_arn = aws_lb.alb.arn
  web_acl_arn  = aws_wafv2_web_acl.this[0].arn
}

# WAF logging (requires Kinesis Firehose in practice; omitted here for simplicity)
# You can add aws_wafv2_web_acl_logging_configuration later for learning.