import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IncomeService } from '../../income/income.service';
import { IncomeCategory } from '../../models/income.model';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';

@Controller('api/incomes')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createIncome(
    @UserDecorator() user,
    @Body() createIncomeDto: {
      amount: number;
      category: IncomeCategory;
      description?: string;
      date?: Date;
      isRecurring?: boolean;
      recurringFrequency?: string;
      source?: string;
    },
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

  @UseGuards(JwtAuthGuard)
  @Get()
  async getIncomes(@UserDecorator() user) {
    return this.incomeService.getIncomeByUserId(user.userId);
  }

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

  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will return all incomes' };
  }
} 