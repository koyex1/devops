output "alb_dns_name" {
  description = "Use this in browser or Ansible if you insist (DNS, not IP)."
  value       = aws_lb.alb.dns_name
}

output "alb_arn" {
  value = aws_lb.alb.arn
}

output "alb_security_group_id" {
  value = aws_security_group.alb_sg.id
}

output "app_security_group_id" {
  value = aws_security_group.app_sg.id
}

output "ui_target_group_arn" {
  value = aws_lb_target_group.ui_tg.arn
}

output "api_target_group_arn" {
  value = aws_lb_target_group.api_tg.arn
}

output "alb_access_logs_bucket" {
  value       = try(aws_s3_bucket.alb_logs[0].bucket, null)
  description = "S3 bucket used for ALB access logs (null if disabled)."
}