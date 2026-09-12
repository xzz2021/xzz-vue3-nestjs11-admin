import {
  ArgumentMetadata,
  Inject,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

@Injectable()
export class CreatorPipe implements PipeTransform {
  constructor(@Inject(REQUEST) private readonly request: any) {}
  transform(value: any, metadata: ArgumentMetadata) {
    const user = this.request.user;

    value.createdById = user.id;

    return value;
  }
}

@Injectable()
export class UpdaterPipe implements PipeTransform {
  constructor(@Inject(REQUEST) private readonly request: any) {}
  transform(value: any, metadata: ArgumentMetadata) {
    const user = this.request.user;

    value.updatedBy = user.id;

    return value;
  }
}
