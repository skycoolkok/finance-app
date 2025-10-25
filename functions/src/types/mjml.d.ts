declare module 'mjml' {
  export type MJMLValidationLevel = 'skip' | 'soft' | 'strict'

  export interface MJMLOptions {
    minify?: boolean
    validationLevel?: MJMLValidationLevel
    fonts?: Record<string, string>
    keepComments?: boolean
  }

  export interface MJMLError {
    message: string
    line?: number
    tagName?: string
    formattedMessage: string
  }

  export interface MJMLResult {
    html: string
    errors: MJMLError[]
    mjml?: string
  }

  export default function mjml2html(input: string, options?: MJMLOptions): MJMLResult
}
