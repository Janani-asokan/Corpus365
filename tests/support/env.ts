// Runs in each test worker before any module that opens the database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://corpus:corpus@localhost:5432/corpus365_test";
process.env.DATABASE_SSL ??= "disable";
