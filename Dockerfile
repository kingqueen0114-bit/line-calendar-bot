FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN if [ -f tsconfig.json ]; then npm run build --if-present; fi
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
