import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Register a device for push notifications' })
  @ApiBody({ type: RegisterDeviceDto })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.user.id, dto);
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiOperation({ summary: 'List all registered devices' })
  @ApiResponse({ status: 200, description: 'Devices retrieved successfully' })
  findAll(@Req() req: any) {
    return this.devicesService.findAll(req.user.id);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Unregister a device' })
  @ApiResponse({ status: 200, description: 'Device token removed successfully' })
  @ApiResponse({ status: 404, description: 'Device token not found' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.devicesService.remove(id, req.user.id);
  }
}
