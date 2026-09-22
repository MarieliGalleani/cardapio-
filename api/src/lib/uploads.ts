import type { FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { HttpError } from './http.js'

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? 'uploads')

// Salva a imagem enviada no formulário e devolve a URL pública
export async function saveImage(req: FastifyRequest): Promise<string> {
  const file = await req.file()
  if (!file) throw new HttpError(400, 'Envie uma imagem')
  const ext = extname(file.filename).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    throw new HttpError(400, 'Use uma imagem JPG, PNG ou WEBP')
  }
  const name = `${randomUUID()}${ext}`
  const path = join(UPLOAD_DIR, name)
  await pipeline(file.file, createWriteStream(path))
  if (file.file.truncated) {
    await unlink(path).catch(() => {})
    throw new HttpError(413, 'A imagem pode ter no máximo 5 MB')
  }
  return `${process.env.PUBLIC_API_URL ?? ''}/uploads/${name}`
}
