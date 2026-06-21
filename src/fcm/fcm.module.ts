import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FcmService } from './fcm.service';

@Module({
  imports: [PrismaModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
