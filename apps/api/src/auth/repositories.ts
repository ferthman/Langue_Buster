import type { AppUser, SessionPayload, TelegramUser } from '@langue-buster/shared';
import { appUserSchema, sessionPayloadSchema } from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

import type { DatabaseClient } from '../db/client.js';
import { queryOne } from '../db/client.js';

export type UserRepository = {
  findById(userId: string): Promise<AppUser | null>;
  findByTelegramUserId(telegramUserId: string): Promise<AppUser | null>;
  save(user: AppUser): Promise<AppUser>;
  createOrUpdateFromTelegramUser(telegramUser: TelegramUser): Promise<AppUser>;
};

export type SessionRepository = {
  save(session: SessionPayload): Promise<SessionPayload>;
  findById(sessionId: string): Promise<SessionPayload | null>;
  findByToken(token: string): Promise<SessionPayload | null>;
};

type InMemoryUserRepositoryOptions = {
  now?: () => Date;
};

export class InMemoryUserRepository implements UserRepository {
  readonly #usersByTelegramId = new Map<string, AppUser>();
  readonly #usersById = new Map<string, AppUser>();
  readonly #now: () => Date;

  constructor(options: InMemoryUserRepositoryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  findById(userId: string): Promise<AppUser | null> {
    return Promise.resolve(this.#usersById.get(userId) ?? null);
  }

  findByTelegramUserId(telegramUserId: string): Promise<AppUser | null> {
    return Promise.resolve(this.#usersByTelegramId.get(telegramUserId) ?? null);
  }

  save(user: AppUser): Promise<AppUser> {
    const parsed = appUserSchema.parse(user);
    this.#usersByTelegramId.set(parsed.telegramUserId, parsed);
    this.#usersById.set(parsed.id, parsed);
    return Promise.resolve(parsed);
  }

  async createOrUpdateFromTelegramUser(telegramUser: TelegramUser): Promise<AppUser> {
    const existing = this.#usersByTelegramId.get(telegramUser.id);
    const timestamp = this.#now().toISOString();

    return this.save({
      id: existing?.id ?? `usr_${randomUUID()}`,
      telegramUserId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName,
      languageCode: telegramUser.languageCode,
      isPremium: telegramUser.isPremium,
      createdAt: existing?.createdAt ?? timestamp,
      lastLoginAt: timestamp,
    });
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly #sessionsById = new Map<string, SessionPayload>();
  readonly #sessionsByToken = new Map<string, SessionPayload>();

  save(session: SessionPayload): Promise<SessionPayload> {
    const parsed = sessionPayloadSchema.parse(session);
    this.#sessionsById.set(parsed.id, parsed);
    this.#sessionsByToken.set(parsed.token, parsed);
    return Promise.resolve(parsed);
  }

  findById(sessionId: string): Promise<SessionPayload | null> {
    return Promise.resolve(this.#sessionsById.get(sessionId) ?? null);
  }

  findByToken(token: string): Promise<SessionPayload | null> {
    return Promise.resolve(this.#sessionsByToken.get(token) ?? null);
  }
}

type PersistedUserRow = {
  id: string;
  telegram_user_id: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language_code: string | null;
  is_premium: boolean;
  created_at: string;
  last_login_at: string;
};

type PersistedSessionRow = {
  id: string;
  token: string;
  user_id: string;
  issued_at: string;
  expires_at: string;
};

type PostgresUserRepositoryOptions = {
  client: Pick<DatabaseClient, 'query'>;
  now?: () => Date;
};

export class PostgresUserRepository implements UserRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;
  readonly #now: () => Date;

  constructor(options: PostgresUserRepositoryOptions) {
    this.#client = options.client;
    this.#now = options.now ?? (() => new Date());
  }

  async findById(userId: string): Promise<AppUser | null> {
    const row = await queryOne<PersistedUserRow>(
      this.#client,
      `
        SELECT id, telegram_user_id, username, first_name, last_name, language_code, is_premium, created_at, last_login_at
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    return row ? mapUserRow(row) : null;
  }

  async findByTelegramUserId(telegramUserId: string): Promise<AppUser | null> {
    const row = await queryOne<PersistedUserRow>(
      this.#client,
      `
        SELECT id, telegram_user_id, username, first_name, last_name, language_code, is_premium, created_at, last_login_at
        FROM users
        WHERE telegram_user_id = $1
      `,
      [telegramUserId],
    );

    return row ? mapUserRow(row) : null;
  }

  async save(user: AppUser): Promise<AppUser> {
    const parsed = appUserSchema.parse(user);

    const row = await queryOne<PersistedUserRow>(
      this.#client,
      `
        INSERT INTO users (
          id,
          telegram_user_id,
          username,
          first_name,
          last_name,
          language_code,
          is_premium,
          created_at,
          last_login_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          telegram_user_id = EXCLUDED.telegram_user_id,
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          language_code = EXCLUDED.language_code,
          is_premium = EXCLUDED.is_premium,
          created_at = EXCLUDED.created_at,
          last_login_at = EXCLUDED.last_login_at
        RETURNING id, telegram_user_id, username, first_name, last_name, language_code, is_premium, created_at, last_login_at
      `,
      [
        parsed.id,
        parsed.telegramUserId,
        parsed.username ?? null,
        parsed.firstName,
        parsed.lastName ?? null,
        parsed.languageCode ?? null,
        parsed.isPremium,
        parsed.createdAt,
        parsed.lastLoginAt,
      ],
    );

    if (!row) {
      throw new Error('Expected users upsert to return a row.');
    }

    return mapUserRow(row);
  }

  async createOrUpdateFromTelegramUser(telegramUser: TelegramUser): Promise<AppUser> {
    const existing = await this.findByTelegramUserId(telegramUser.id);
    const timestamp = this.#now().toISOString();

    return this.save({
      id: existing?.id ?? `usr_${randomUUID()}`,
      telegramUserId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName,
      languageCode: telegramUser.languageCode,
      isPremium: telegramUser.isPremium,
      createdAt: existing?.createdAt ?? timestamp,
      lastLoginAt: timestamp,
    });
  }
}

type PostgresSessionRepositoryOptions = {
  client: Pick<DatabaseClient, 'query'>;
};

export class PostgresSessionRepository implements SessionRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(options: PostgresSessionRepositoryOptions) {
    this.#client = options.client;
  }

  async save(session: SessionPayload): Promise<SessionPayload> {
    const parsed = sessionPayloadSchema.parse(session);

    const row = await queryOne<PersistedSessionRow>(
      this.#client,
      `
        INSERT INTO sessions (id, token, user_id, issued_at, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          token = EXCLUDED.token,
          user_id = EXCLUDED.user_id,
          issued_at = EXCLUDED.issued_at,
          expires_at = EXCLUDED.expires_at
        RETURNING id, token, user_id, issued_at, expires_at
      `,
      [
        parsed.id,
        parsed.token,
        parsed.userId,
        parsed.issuedAt,
        parsed.expiresAt,
      ],
    );

    if (!row) {
      throw new Error('Expected sessions upsert to return a row.');
    }

    return mapSessionRow(row);
  }

  async findById(sessionId: string): Promise<SessionPayload | null> {
    const row = await queryOne<PersistedSessionRow>(
      this.#client,
      `
        SELECT id, token, user_id, issued_at, expires_at
        FROM sessions
        WHERE id = $1
      `,
      [sessionId],
    );

    return row ? mapSessionRow(row) : null;
  }

  async findByToken(token: string): Promise<SessionPayload | null> {
    const row = await queryOne<PersistedSessionRow>(
      this.#client,
      `
        SELECT id, token, user_id, issued_at, expires_at
        FROM sessions
        WHERE token = $1
      `,
      [token],
    );

    return row ? mapSessionRow(row) : null;
  }
}

function mapUserRow(row: PersistedUserRow): AppUser {
  return appUserSchema.parse({
    id: row.id,
    telegramUserId: row.telegram_user_id,
    username: row.username ?? undefined,
    firstName: row.first_name,
    lastName: row.last_name ?? undefined,
    languageCode: row.language_code ?? undefined,
    isPremium: row.is_premium,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  });
}

function mapSessionRow(row: PersistedSessionRow): SessionPayload {
  return sessionPayloadSchema.parse({
    id: row.id,
    token: row.token,
    userId: row.user_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
  });
}
