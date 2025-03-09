import { Body, Controller, Get, Query, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExpenseService } from '../../expense/expense.service';
import { ExpenseCategory, PaymentMethod } from '../../models/expense.model';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';
import { CreateExpenseDto } from '../../dto/expense.dto';

@Controller('api/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createExpense(
    @UserDecorator() user,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    let category: ExpenseCategory;
    switch(createExpenseDto.category.toLowerCase()) {
      case 'food': category = ExpenseCategory.FOOD; break;
      case 'transport': category = ExpenseCategory.TRANSPORTATION; break;
      case 'entertainment': category = ExpenseCategory.ENTERTAINMENT; break;
      case 'shopping': category = ExpenseCategory.SHOPPING; break;
      case 'utilities': category = ExpenseCategory.UTILITIES; break;
      case 'rent': category = ExpenseCategory.RENT; break;
      case 'healthcare': category = ExpenseCategory.HEALTH; break;
      case 'education': category = ExpenseCategory.EDUCATION; break;
      case 'travel': category = ExpenseCategory.TRAVEL; break;
      default: category = ExpenseCategory.OTHER;
    }
    
    return this.expenseService.createExpense(
      user.userId,
      createExpenseDto.amount,
      category,
      PaymentMethod.UPI,
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

  // This endpoint is marked as public for demonstration
  @Public()
  @Get('demo')
  findAll() {
    return { message: 'This endpoint will return all expenses' };
  }
} 