vault {
  address = "http://vault:8200"
}

auto_auth {
  method "token_file" {
    config = {
      token_file_path = "/vault/token"
    }
  }
}

listener "tcp" {
  address = "0.0.0.0:8100"
  tls_disable = true
}

template {
  source      = "/templates/rabbitmq.tpl"
  destination = "/secrets/rabbitmq.env"
}