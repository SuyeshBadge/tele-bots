import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { TokenBlacklistService } from '../../security/token-blacklist.service';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check for public routes using the @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // For non-public routes, verify token and check blacklist
    const parentCanActivate = super.canActivate(context);
    
    // Handle different return types from parent method
    if (parentCanActivate instanceof Promise) {
      return parentCanActivate.then(result => {
        return this.checkBlacklist(result, context);
      });
    } else if (parentCanActivate instanceof Observable) {
      // Convert Observable to Promise for consistent handling
      return new Promise((resolve, reject) => {
        parentCanActivate.subscribe({
          next: result => resolve(this.checkBlacklist(result, context)),
          error: error => reject(error),
        });
      });
    } else {
      // Handle boolean case
      return this.checkBlacklist(parentCanActivate, context);
    }
  }

  private checkBlacklist(isAuthenticated: boolean, context: ExecutionContext): boolean {
    if (!isAuthenticated) {
      return false;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // If token is blacklisted, deny access
    if (user && user.jti && this.tokenBlacklistService.isBlacklisted(user.jti)) {
      throw new UnauthorizedException('Token has been revoked. Please login again.');
    }
    
    return true;
  }
} 