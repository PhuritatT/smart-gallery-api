"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAlbumDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_album_dto_1 = require("./create-album.dto");
class UpdateAlbumDto extends (0, swagger_1.PartialType)(create_album_dto_1.CreateAlbumDto) {
}
exports.UpdateAlbumDto = UpdateAlbumDto;
//# sourceMappingURL=update-album.dto.js.map