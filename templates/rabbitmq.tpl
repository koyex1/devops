RABBITMQ_DEFAULT_USER={{ with secret "dev/rabbitmq" }}{{ .Data.data.username }}{{ end }}
RABBITMQ_DEFAULT_PASS={{ with secret "dev/rabbitmq" }}{{ .Data.data.password }}{{ end }}