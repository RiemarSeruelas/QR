FROM node:20-alpine

WORKDIR /app

# Keep npm using the public registry, not any machine-specific registry from another PC/environment.
COPY package.json .npmrc ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5057
EXPOSE 5057

CMD ["npm", "start"]
