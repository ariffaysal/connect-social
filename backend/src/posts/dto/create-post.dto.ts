import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
