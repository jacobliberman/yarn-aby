import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Clerk user id (`user_…`) after Bearer JWT verification */
    userId?: string;
  }
}
