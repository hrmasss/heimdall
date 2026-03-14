package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	"github.com/heimdall/api/internal/config"
)

// Open creates a Bun database connection for PostgreSQL.
func Open(cfg config.DatabaseConfig) (*bun.DB, error) {
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(cfg.URL)))
	sqldb.SetMaxOpenConns(cfg.MaxConnections)
	sqldb.SetMaxIdleConns(cfg.MaxIdleConns)
	sqldb.SetConnMaxLifetime(30 * time.Minute)

	db := bun.NewDB(sqldb, pgdialect.New())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func CheckSchema(ctx context.Context, db *bun.DB) error {
	var relationName string
	if err := db.NewRaw("SELECT to_regclass('public.users')::text").Scan(ctx, &relationName); err != nil {
		return err
	}
	if relationName == "" {
		return fmt.Errorf("required schema is missing; run migrations first")
	}
	return nil
}
