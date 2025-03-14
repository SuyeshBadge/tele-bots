import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IncomeService } from '../../income/income.service';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateIncomeDto } from '../../dto/income.dto';

@ApiTags('incomes')
@ApiBearerAuth('JWT-auth')
@Controller('api/incomes')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @ApiOperation({ summary: 'Create a new income entry' })
  @ApiResponse({ 
    status: 201, 
    description: 'The income has been successfully created.',
    type: Object
  })
  @UseGuards(JwtAuthGuard)
  @Post()
  async createIncome(
    @UserDecorator() user,
    @Body() createIncomeDto: CreateIncomeDto,
  ) {
    return this.incomeService.createIncome(
      user.userId,
      createIncomeDto.amount,
      createIncomeDto.category,
      createIncomeDto.description,
      createIncomeDto.date,
      createIncomeDto.isRecurring,
      createIncomeDto.recurringFrequency,
      createIncomeDto.source,
    );
  }

  @ApiOperation({ summary: 'Get all incomes for the authenticated user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns all incomes for the user',
    type: Object
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async getIncomes(@UserDecorator() user) {
    return this.incomeService.getIncomeByUserId(user.userId);
  }

  @ApiOperation({ summary: 'Get income summary for a specific month' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns income summary for the specified month',
    type: Object
  })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Month number (1-12)' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Year (e.g., 2023)' })
  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async getIncomeSummary(
    @UserDecorator() user,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const currentDate = new Date();
    const currentMonth = month || currentDate.getMonth() + 1;
    const currentYear = year || currentDate.getFullYear();

    const incomes = await this.incomeService.getIncomeByUserIdAndMonth(
      user.userId,
      currentMonth,
      currentYear,
    );
    const total = await this.incomeService.getTotalIncomeByMonth(
      user.userId,
      currentMonth,
      currentYear,
    );
    const byCategory = await this.incomeService.getIncomeByCategory(
      user.userId,
      currentMonth,
      currentYear,
    );

    return {
      incomes,
      total,
      byCategory,
      month: currentMonth,
      year: currentYear,
    };
  }

  @ApiOperation({ summary: 'Public endpoint to get all incomes (for demo purposes)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns a demo message',
    type: Object
  })
  @Public()
  @Get('demo')
  findAll() {
    return { message: 'This endpoint will return all incomes' };
  }
} 