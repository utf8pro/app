import {FileSystemRouter} from "bun"

export default function app(params: TAppParams = {}): TApp {
  const mws: TMiddleware[] = []
  const {routesDir, cacheRoutes, notFoundHandler}: TAppParams = {
    ...defaultParams,
    ...params,
  }
  const cachedRoutes = new Map<string, THandler>()

  const router = new FileSystemRouter({
    dir: routesDir!,
    style: "nextjs",
  })

  const getRouteHandler = (req: Request): {
    ctx: TContext,
    handler: THandler,
  } => {
    const route = router.match(req)
    if (route) {
      const ctx = createContext(req, route.query, route.params)
      let handler
      if (cacheRoutes) {
        handler = cachedRoutes.get(route.filePath)
      }
      if (!handler) {
        handler = require(route.filePath).default
        if (typeof handler !== "function") {
          return {ctx, handler: notFoundHandler!}
        }
        if (cacheRoutes) {
          cachedRoutes.set(route.filePath, handler!)
        }
      }
      return {ctx, handler: handler!}
    }
    return {ctx: createContext(req, {}, {}), handler: notFoundHandler!}
  }

  return {
    use(mw: TMiddleware) {
      mws.push(mw)
      return this
    },

    listen(port: number): Bun.Server {
      return Bun.serve({
        port,
        async fetch(req: Request): Promise<Response> {
          const route = router.match(req)
          if (route) {
            try {
              const {ctx, handler} = getRouteHandler(req)
              for (const mw of mws) {
                await mw(ctx)
              }
              return await handler(ctx)
            } catch (err) {
              if (err instanceof AppError) {
                return Response.json({
                  error: err.message,
                }, {status: err.status || 500})
              }
              return Response.json({
                error: (err as Error).message,
              })
            }
          }
          return Response.json({
            error: "NotFound",
          }, {status: 404})
        },
      })
    },
  }
}

const defaultParams: TAppParams = {
  routesDir: "./routes",
  cacheRoutes: true,
  notFoundHandler: async () => Response.json({error: "NotFound"}, {status: 404}),
}

function createContext(request: Request, query: Record<string, string>, params: Record<string, string>): TContext {
  return {request, query, params}
}

export type TApp = {
  use(mw: TMiddleware): TApp
  listen(port: number): Bun.Server
}

export type TAppParams = {
  routesDir?: string
  cacheRoutes?: boolean
  notFoundHandler?: THandler
}

export type TContext = {
  request: Request
  query: Record<string, string>
  params: Record<string, string>
}

export type TMiddleware = (ctx: TContext) => Promise<void>

export type THandler = (ctx: TContext) => Promise<Response>

export class AppError extends Error {
  readonly status: number

  constructor(message: string, status: number = 500) {
    super(message)
    this.status = status
  }
}
