FROM node:20-alpine

# Install pnpm (pinned version for deterministic builds)
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# Next.js dev server needs to bind to 0.0.0.0 to be accessible from outside container
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["pnpm", "run", "dev"]