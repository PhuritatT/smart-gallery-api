// Albums Controller - Created: 2026-01-02
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto, UpdateAlbumDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Albums')
@Controller('albums')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlbumsController {
    constructor(private readonly albumsService: AlbumsService) { }

    @Public()
    @Get()
    @ApiOperation({ summary: 'Get all albums (public)' })
    @ApiResponse({ status: 200, description: 'Returns all albums' })
    findAll(@CurrentUser() user?: User) {
        return this.albumsService.findAll(user);
    }

    @Public()
    @Get(':id')
    @ApiOperation({ summary: 'Get album by ID (public)' })
    @ApiResponse({ status: 200, description: 'Returns the album' })
    @ApiResponse({ status: 404, description: 'Album not found' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.albumsService.findOne(id);
    }

    @Get('user/me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get my albums' })
    @ApiResponse({ status: 200, description: 'Returns albums of current user' })
    findMyAlbums(@CurrentUser() user: User) {
        return this.albumsService.findByUser(user.id);
    }

    @Post()
    @ApiBearerAuth()
    @Roles(UserRole.USER, UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new album' })
    @ApiResponse({ status: 201, description: 'Album created successfully' })
    create(@Body() createAlbumDto: CreateAlbumDto, @CurrentUser() user: User) {
        return this.albumsService.create(createAlbumDto, user);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @Roles(UserRole.USER, UserRole.ADMIN)
    @ApiOperation({ summary: 'Update an album' })
    @ApiResponse({ status: 200, description: 'Album updated successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Album not found' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateAlbumDto: UpdateAlbumDto,
        @CurrentUser() user: User,
    ) {
        return this.albumsService.update(id, updateAlbumDto, user);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @Roles(UserRole.USER, UserRole.ADMIN)
    @ApiOperation({ summary: 'Soft delete an album' })
    @ApiResponse({ status: 200, description: 'Album deleted successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Album not found' })
    softDelete(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: User,
    ) {
        return this.albumsService.softDelete(id, user);
    }

    @Post(':id/restore')
    @ApiBearerAuth()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Restore a soft-deleted album (Admin only)' })
    @ApiResponse({ status: 200, description: 'Album restored successfully' })
    @ApiResponse({ status: 404, description: 'Album not found' })
    restore(@Param('id', ParseUUIDPipe) id: string) {
        return this.albumsService.restore(id);
    }

    @Delete(':id/permanent')
    @ApiBearerAuth()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Permanently delete an album (Admin only)' })
    @ApiResponse({ status: 200, description: 'Album permanently deleted' })
    @ApiResponse({ status: 404, description: 'Album not found' })
    hardDelete(@Param('id', ParseUUIDPipe) id: string) {
        return this.albumsService.hardDelete(id);
    }
}
