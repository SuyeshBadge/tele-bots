import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExpenseService } from '../../expense/expense.service';
import { ExpenseCategory, PaymentMethod } from '../../models/expense.model';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';

@Controller('api/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createExpense(
    @UserDecorator() user,
    @Body() createExpenseDto: {
      amount: number;
      category: ExpenseCategory;
      paymentMethod: PaymentMethod;
      description?: string;
      date?: Date;
    },
  ) {
    return this.expenseService.createExpense(
      user.userId,
      createExpenseDto.amount,
      createExpenseDto.category,
      createExpenseDto.paymentMethod,
      createExpenseDto.description,
      createExpenseDto.date,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getExpenses(@UserDecorator() user) {
    return this.expenseService.getExpensesByUserId(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async getExpenseSummary(
    @UserDecorator() user,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const currentDate = new Date();
    const currentMonth = month || currentDate.getMonth() + 1;
    const currentYear = year || currentDate.getFullYear();

    const expenses = await this.expenseService.getExpensesByUserIdAndMonth(
      user.userId,
      currentMonth,
      currentYear,
    );
    const total = await this.expenseService.getTotalExpensesByMonth(
      user.userId,
      currentMonth,
      currentYear,
    );
    const byCategory = await this.expenseService.getExpensesByCategory(
      user.userId,
      currentMonth,
      currentYear,
    );

    return {
      expenses,
      total,
      byCategory,
      month: currentMonth,
      year: currentYear,
    };
  }

  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will return all expenses' };
  }
} 