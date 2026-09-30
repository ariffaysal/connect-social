import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  @Min(1)
  recipientId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
