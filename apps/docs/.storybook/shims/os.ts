export function platform(): string {
  return 'browser'
}

export function homedir(): string {
  return '/'
}

export function tmpdir(): string {
  return '/tmp'
}

export function release(): string {
  return 'browser'
}

export function type(): string {
  return 'Browser'
}

export default { platform, homedir, tmpdir, release, type }
