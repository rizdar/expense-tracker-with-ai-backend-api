import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { platform: dto.platform, userId },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
    });

    return {
      success: true,
      message: 'Device registered successfully',
      data: device,
    };
  }

  async findAll(userId: string) {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        token: true,
        platform: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: devices,
    };
  }

  async remove(id: string, userId: string) {
    const device = await this.prisma.deviceToken.findFirst({
      where: { id, userId },
    });

    if (!device) {
      throw new NotFoundException('Device token not found');
    }

    await this.prisma.deviceToken.delete({ where: { id } });

    return {
      success: true,
      message: 'Device token removed successfully',
    };
  }
}
