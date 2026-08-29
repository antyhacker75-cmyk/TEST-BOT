FROM node:18-bullseye

# Install system dependencies for canvas and other native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the app
COPY . .

# Set environment variable for Node memory
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose the port your app listens on
EXPOSE 5000

# Start the bot
CMD ["npm", "start"]