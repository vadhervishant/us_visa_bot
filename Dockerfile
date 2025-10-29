# Use official Node.js LTS image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Ensure node uses the unflagged ESM loader
ENV NODE_OPTIONS=--unhandled-rejections=strict

# Expose default Fly port
EXPOSE 8080

# Start the bot: expand runtime env vars (CURRENT_DATE must be provided as an env var)
# Use a shell to expand environment variables at runtime rather than at build time.
CMD ["sh", "-lc", "node src/index.js -c \"$CURRENT_DATE\""]
