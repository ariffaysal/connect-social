import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  content?: string;
}
