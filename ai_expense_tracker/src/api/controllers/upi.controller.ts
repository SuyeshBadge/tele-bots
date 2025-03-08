import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpiService } from '../../upi/upi.service';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';

@Controller('api/upi')
export class UpiController {
  constructor(private readonly upiService: UpiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('transaction')
  async createUpiTransaction(
    @UserDecorator() user,
    @Body() createUpiTransactionDto: {
      amount: number;
      merchantName: string;
      upiId?: string;
    },
  ) {
    // If a UPI ID is provided, use it; otherwise, generate a mock one
    if (createUpiTransactionDto.upiId) {
      return this.upiService.processUpiTransaction(
        user.userId,
        createUpiTransactionDto.upiId,
        createUpiTransactionDto.amount,
        createUpiTransactionDto.merchantName,
        new Date(),
      );
    } else {
      return this.upiService.mockUpiTransaction(
        user.userId,
        createUpiTransactionDto.amount,
        createUpiTransactionDto.merchantName,
      );
    }
  }

  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will handle UPI transactions' };
  }
} 