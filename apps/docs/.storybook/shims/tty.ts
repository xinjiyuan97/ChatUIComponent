export function isatty(_fd: number): boolean {
  return false
}

export class ReadStream {}
export class WriteStream {}

export default { isatty, ReadStream, WriteStream }
