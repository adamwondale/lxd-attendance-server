import { ArgsType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';

@ArgsType()
export class RegisterAdminArgs {
  @Field()
  @IsEmail({}, { message: 'Please enter a valid email' })
  email: string;

  @Field()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @Field()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Tenant name is required' })
  tenantName: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\+?[0-9\s\-()]{9,15}$/, { message: 'Please enter a valid phone number' })
  companyPhone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username must contain only letters, numbers, and underscores' })
  username?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid company email' })
  companyEmail?: string;
}
