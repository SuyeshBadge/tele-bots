import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpiService } from '../../upi/upi.service';
import { UserDecorator } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUpiTransactionDto, UpiTransactionResponseDto } from '../../dto/upi.dto';

@ApiTags('upi')
@ApiBearerAuth('JWT-auth')
@Controller('api/upi')
export class UpiController {
  constructor(private readonly upiService: UpiService) {}

  @ApiOperation({ summary: 'Create a new UPI transaction' })
  @ApiResponse({ 
    status: 201, 
    description: 'The UPI transaction has been successfully processed.',
    type: UpiTransactionResponseDto
  })
  @UseGuards(JwtAuthGuard)
  @Post('transaction')
  async createUpiTransaction(
    @UserDecorator() user,
    @Body() createUpiTransactionDto: CreateUpiTransactionDto,
  ) {
    // If a UPI ID is provided, use it; otherwise, generate a mock one
    if (createUpiTransactionDto.upiId) {
      return this.upiService.processUpiTransaction(
        user.userId,
        createUpiTransactionDto.upiId,
        createUpiTransactionDto.amount,
        createUpiTransactionDto.merchantName,
        createUpiTransactionDto.date || new Date(),
      );
    } else {
      return this.upiService.mockUpiTransaction(
        user.userId,
        createUpiTransactionDto.amount,
        createUpiTransactionDto.merchantName,
      );
    }
  }

  @ApiOperation({ summary: 'Public endpoint for UPI information (for demo purposes)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns a demo message',
    type: Object
  })
  @Public()
  @Get()
  findAll() {
    return { message: 'This endpoint will handle UPI transactions' };
  }
} 