# @utf8pro/app

API application library, based on Bun.

## Installation
```bash
bun add @utf8pro/app
```

## Example
```typescript
import app, {AppError, type TContext} from "@utf8pro/app"

app()
  .use(async ({request, params}: TContext) => {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      throw new AppError("Authorization header is missing", 401)
    }
  })
  .listen(3000)
```
