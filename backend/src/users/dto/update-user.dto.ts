import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../auth/roles.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  departmentId?: number;

  @IsOptional()
  @IsString()
  password?: string;
}
