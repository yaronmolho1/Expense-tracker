FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Next.js dev server needs to bind to 0.0.0.0 to be accessible from outside container
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["npm", "run", "dev"]