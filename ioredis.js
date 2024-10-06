const Redis = require('ioredis');

const redis = new Redis({
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
});

redis.on('ready', () => {
    console.log('Redis Client connected to redis and ready to use...')
})

module.exports = redis