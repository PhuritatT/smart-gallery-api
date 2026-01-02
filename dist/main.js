"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const nestjs_api_reference_1 = require("@scalar/nestjs-api-reference");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Smart Google Drive Gallery API')
        .setDescription('API for managing photo albums connected to Google Drive with face search capability')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('Authentication', 'User registration and login')
        .addTag('Albums', 'Album management')
        .addTag('Google Drive', 'Google Drive integration and proxy')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    app.use('/docs', (0, nestjs_api_reference_1.apiReference)({
        spec: {
            content: document,
        },
        theme: 'purple',
    }));
    swagger_1.SwaggerModule.setup('api', app, document);
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📚 API Documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map