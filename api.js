const expressJwt = require('express-jwt'); // 把 JWT 的 payload 部分赋值于 req.user
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const fileRoutes = require('./routes/file');
const mylistRoutes = require('./routes/mylist');
const userRoutes = require('./routes/user');
const workRoutes = require('./routes/work');
const { config } = require('./config');

/**
 * Get token from header or query string.
 */
const getToken = req => {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    return req.query.token;
  } else {
    return null;
  }
};


module.exports = app => {
  if (config.auth) {
    // expressJwt 中间件 
    // 验证指定 http 请求的 JsonWebTokens 的有效性, 如果有效就将 JsonWebTokens 的值设置到 req.user 里面, 然后路由到相应的 router
    app.use('/api', expressJwt({ secret: config.jwtsecret, getToken }).unless({ path: ['/api/me'] }));
  }
  app.use('/api', authRoutes);
  app.use('/api', configRoutes);
  app.use('/api', fileRoutes);
  app.use('/api', mylistRoutes);
  app.use('/api', userRoutes);
  app.use('/api', workRoutes); 
};
