import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {} 