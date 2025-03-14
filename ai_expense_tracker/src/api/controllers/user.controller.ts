import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserService } from '../../user/user.service';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';
import { UpdateUserPreferencesDto, UpdateOnboardingStatusDto } from '../../dto/user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get the profile of the authenticated user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the user profile',
    type: Object
  })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@UserDecorator() user) {
    return this.userService.getUserById(user.userId);
  }

  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ 
    status: 200, 
    description: 'User preferences have been updated',
    type: Object
  })
  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  async updatePreferences(
    @UserDecorator() user,
    @Body() updatePreferencesDto: UpdateUserPreferencesDto,
  ) {
    return this.userService.updateUserPreferences(
      user.userId,
      updatePreferencesDto,
    );
  }

  @ApiOperation({ summary: 'Update user onboarding status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Onboarding status has been updated',
    type: Object
  })
  @UseGuards(JwtAuthGuard)
  @Put('onboarding')
  async updateOnboardingStatus(
    @UserDecorator() user,
    @Body() updateOnboardingDto: UpdateOnboardingStatusDto,
  ) {
    return this.userService.setOnboardingStatus(
      user.userId,
      updateOnboardingDto.isOnboarded,
    );
  }

  @ApiOperation({ summary: 'Public endpoint for user information (for demo purposes)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns a demo message',
    type: Object
  })
  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will return user information' };
  }
} 