FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci --include=dev && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Stdio MCP server. Requires CLIPY_API_KEY at runtime for tool calls;
# starts and answers introspection without it.
ENTRYPOINT ["node", "dist/index.js"]
