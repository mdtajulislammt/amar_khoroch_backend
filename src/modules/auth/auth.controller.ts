import { Controller, Post, Get, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User Registration', description: 'Register a new user account and initialize default settings, wallets, and categories.' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return {
      message: 'Registration successful',
      data,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User Login', description: 'Authenticate user with email and password to receive JWT bearer token.' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return {
      message: 'Login successful',
      data,
    };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google Authentication', description: 'Login or Register using Google credentials.' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  async googleAuth(@Body() dto: GoogleAuthDto) {
    const data = await this.authService.googleAuth(dto);
    return {
      message: 'Google authentication successful',
      data,
    };
  }

  @Public()
  @Get('google/url')
  @ApiOperation({ summary: 'Get Google OAuth URL', description: 'Generates the backend Google OAuth redirect URL' })
  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      throw new BadRequestException('Backend .env ফাইলে GOOGLE_CLIENT_ID প্রস্তুত নেই। Google Cloud Console থেকে Client ID যোগ করুন।');
    }
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';
    const scope = encodeURIComponent('email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    return { url };
  }
}
