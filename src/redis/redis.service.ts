import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly client?: Redis;

    constructor(private readonly configService: ConfigService) {
        const url = this.configService.get<string>('REDIS_URL');
        if (!url) {
            this.logger.warn('REDIS_URL not configured — Redis cache disabled');
            return;
        }

        this.client = new Redis(url, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 3000,
        });

        this.client.on('error', (err) => {
            this.logger.warn(`Redis error: ${err.message}`);
        });
    }

    isEnabled(): boolean {
        return Boolean(this.client);
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.client) return null;
        try {
            const value = await this.client.get(key);
            return value ? (JSON.parse(value) as T) : null;
        } catch {
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch {
            // non-critical — silently ignore
        }
    }

    async del(key: string): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.del(key);
        } catch {
            // non-critical
        }
    }

    onModuleDestroy(): void {
        void this.client?.quit();
    }
}
