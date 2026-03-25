declare module "bun" {
  interface Env {
    SOLACE_EMAIL: string;
    SOLACE_PASSWORD: string;
    MAILSLURP_API_KEY: string;
  }
}
