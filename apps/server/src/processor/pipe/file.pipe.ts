import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata) {
    // "value" is an object containing the file's attributes and metadata
    const fiveMB = 5 * 1024 * 1024;
    return value.size < fiveMB;
  }
}

/*

//  前端传递 multipart/form-data 时 其他信息放前面  文件一定要放到最后  . 不然boundary 会不匹配
@Post('file')
@UseInterceptors(FileInterceptor('file'))
uploadFileAndValidate(@UploadedFile( new FileSizeValidationPipe(),
  // other pipes can be added here ) file: Express.Multer.File, ) {
  return file;
}

// nestjs内置验证器

  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 1000 }),   // 检查给定文件的大小是否小于提供的值
      new FileTypeValidator({ fileType: 'image/jpeg' }),  // 检查给定文件的 MIME 类型是否与给定字符串或正则表达式匹配
    ],
  }),


*/
