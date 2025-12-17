declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http'

  export type VercelRequest = IncomingMessage & {
    query: Record<string, string | string[]>
    body?: any
    cookies?: Record<string, string>
  }

  export type VercelResponse = ServerResponse & {
    status: (code: number) => VercelResponse
    json: (obj: any) => void
    send: (data: any) => void
    redirect: (url: string, code?: number) => void
    setHeader: (name: string, value: string | readonly string[]) => void
  }
}

declare module 'nodemailer' {
  export type Transporter = any
  export function createTransport(options: any): Transporter
}


