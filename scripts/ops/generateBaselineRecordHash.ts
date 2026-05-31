import crypto from 'node:crypto'

export const sha256Text = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}
