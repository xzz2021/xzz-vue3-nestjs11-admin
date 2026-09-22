import { StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';

export function sendCsvStream(
  request: Request,
  response: Response,
  stream: Readable,
  filename: string,
): StreamableFile {
  const destroyStream = () => {
    if (!stream.destroyed) stream.destroy();
  };
  const closeBeforeFinish = () => {
    if (!response.writableEnded) destroyStream();
  };
  const cleanup = () => {
    request.off('aborted', destroyStream);
    response.off('close', closeBeforeFinish);
    response.off('finish', cleanup);
    stream.off('end', cleanup);
    stream.off('close', cleanup);
  };
  request.once('aborted', destroyStream);
  response.once('close', closeBeforeFinish);
  response.once('finish', cleanup);
  stream.once('end', cleanup);
  stream.once('close', cleanup);
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );
  return new StreamableFile(stream);
}
