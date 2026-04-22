import type { AppUser, SessionPayload, TelegramUser } from '@langue-buster/shared';
import { appUserSchema, sessionPayloadSchema } from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

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

// Temporary repository until a real persistence layer is introduced.
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

// Temporary repository until a real persistence layer is introduced.
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
