env "app" {
  url = getenv("DATABASE_URL")

  migration {
    dir = "file://db/migrations"
  }
}

env "lint" {
  url = getenv("DATABASE_URL")
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://db/migrations"
  }
}
