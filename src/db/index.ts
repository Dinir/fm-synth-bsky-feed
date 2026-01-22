import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { DatabaseSchema } from './schema'
import { migrationProvider } from './migrations'

export const createDb = (location: string): Database => {
  // Check if DATABASE_URL is set (PostgreSQL on Railway)
  if (process.env.DATABASE_URL) {
    return new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
        }),
      }),
    })
  }

  // Otherwise use SQLite for local development
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(location),
    }),
  })
}

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
}

export type Database = Kysely<DatabaseSchema>
