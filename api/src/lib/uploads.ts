import { resolve } from 'node:path'

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? 'uploads')
