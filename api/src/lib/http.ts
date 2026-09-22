// Erro com status HTTP, tratado pelo error handler do app.
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}
