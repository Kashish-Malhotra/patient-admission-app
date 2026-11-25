package database

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Connect() (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("connecting to PostgreSQL: %w", err)
	}

	return db, nil
}

func Initialize(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS patients (
		id BIGSERIAL PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
		gender VARCHAR(20) NOT NULL,
		ward VARCHAR(50) NOT NULL,
		department VARCHAR(100) NOT NULL,
		doctor VARCHAR(100) NOT NULL,
		admission_date DATE NOT NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'Admitted'
			CHECK (status IN ('Admitted', 'Discharged'))
	);`

	_, err := db.Exec(query)
	if err != nil {
		return fmt.Errorf("initializing patients table: %w", err)
	}

	return nil
}
