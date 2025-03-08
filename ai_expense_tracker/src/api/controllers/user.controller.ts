import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserService } from '../../user/user.service';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@UserDecorator() user) {
    return this.userService.getUserById(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  async updatePreferences(
    @UserDecorator() user,
    @Body() updatePreferencesDto: {
      notificationsEnabled?: boolean;
      reminderTime?: string;
      monthlyBudget?: number;
      budgetCategories?: { [key: string]: number };
    },
  ) {
    return this.userService.updateUserPreferences(
      user.userId,
      updatePreferencesDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('onboarding')
  async updateOnboardingStatus(
    @UserDecorator() user,
    @Body() updateOnboardingDto: { isOnboarded: boolean },
  ) {
    return this.userService.setOnboardingStatus(
      user.userId,
      updateOnboardingDto.isOnboarded,
    );
  }

  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will return user information' };
  }
} 