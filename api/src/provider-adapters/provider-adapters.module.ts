import { Module } from '@nestjs/common';
import { GroqProvider } from './groq.provider.js';

@Module({
  providers: [GroqProvider],
  exports: [GroqProvider],
})
export class ProviderAdaptersModule {}