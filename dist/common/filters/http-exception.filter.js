"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const nestjs_zod_1 = require("nestjs-zod");
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    logger = new common_1.Logger(HttpExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors = [];
        if (exception instanceof nestjs_zod_1.ZodValidationException) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Validation failed';
            const zodError = exception.getZodError();
            errors = zodError.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const resContent = exception.getResponse();
            if (typeof resContent === 'object' && resContent !== null) {
                message = resContent.message || exception.message;
                if (Array.isArray(resContent.message)) {
                    errors = resContent.message;
                }
                else if (resContent.errors) {
                    errors = Array.isArray(resContent.errors)
                        ? resContent.errors
                        : [resContent.errors];
                }
            }
            else {
                message = exception.message;
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
        }
        else {
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
            this.logger.error(`[${request.method}] ${request.url} - Error ${status}: ${message}`);
        }
        else {
            this.logger.warn(`[${request.method}] ${request.url} - Warning ${status}: ${message}`);
        }
        response.status(status).json(errorResponse);
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map