import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ReportTargetType } from '../entities/report.entity';

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  @IsNotEmpty()
  targetType!: ReportTargetType;

  @IsInt()
  @IsNotEmpty()
  targetId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
