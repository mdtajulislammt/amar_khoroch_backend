import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis connection retry limit reached. Redis caching will fall back gracefully.');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis connection error: ${err.message}. Operating in fallback mode.`);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.client || this.client.status !== 'ready') return null;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.warn(`Redis GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client || this.client.status !== 'ready') return;
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, stringValue, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (error) {
      this.logger.warn(`Redis SET error for key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.client || this.client.status !== 'ready') return;
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL error for key ${key}: ${error.message}`);
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    try {
      if (!this.client || this.client.status !== 'ready') return;
      const stream = this.client.scanStream({
        match: `user:${userId}:*`,
        count: 100,
      });

      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = this.client.pipeline();
          keys.forEach((key) => pipeline.del(key));
          pipeline.exec();
        }
      });
    } catch (error) {
      this.logger.warn(`Redis invalidateUserCache error for user ${userId}: ${error.message}`);
    }
  }
}
