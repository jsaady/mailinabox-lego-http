FROM node:18 as builder
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm ci
COPY . /app
RUN npm run build

FROM node:18-alpine
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm ci --production
CMD ["node", "dist/index.js"]
