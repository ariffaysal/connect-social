import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return { status: 'ok', message: 'RBMS backend is running' };
  }
}
