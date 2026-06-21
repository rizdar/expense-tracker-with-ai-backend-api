import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST; // 400 Bad Request for input validation failure
      message = 'Validation failed';
      const zodError = (exception as ZodValidationException).getZodError() as any;
      errors = zodError.issues.map(
        (err: any) => `${err.path.join('.')}: ${err.message}`,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse() as any;

      if (typeof resContent === 'object' && resContent !== null) {
        message = resContent.message || exception.message;
        if (Array.isArray(resContent.message)) {
          errors = resContent.message;
        } else if (resContent.errors) {
          errors = Array.isArray(resContent.errors)
            ? resContent.errors
            : [resContent.errors];
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    const errorResponse = {
      success: false,
      message,
      errors: errors.length > 0 ? errors : [message],
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error ${status}: ${message}`,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Warning ${status}: ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
