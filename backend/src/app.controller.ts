import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus() {
    return this.appService.getStatus();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      message: 'ConnectSocial backend is running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-db')
  async testDb() {
    // Test database connection
    try {
      const result = await this.appService.testConnection();
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
