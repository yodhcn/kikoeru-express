const md5 = require('md5');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator'); // 后端校验
const express = require('express');
const db = require('../database');
const { config } = require('../config');

const signtoken = (obj) => jwt.sign(obj, config.jwtsecret, { expiresIn: config.expiresIn });

const cmd5 = str => md5(str + config.md5secret);

const router = express.Router();

// 用户登录
router.post('/auth/me', [
  check('username')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为 8')
], (req, res, next) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).send({ errors: errors.array() });
  }

  const username = req.body.username;
  const password = req.body.password;

  db.knex('t_user')
    .select('name', 'group')
    .where('name', '=', username)
    .andWhere('password', '=', cmd5(password))
    .first()
    .then(user => {
      if (!user) {
        res.status(401).send({error: '用户名或密码错误.'});
      } else {
        const token = signtoken(user);
        res.send({ token });
      }
    })
    .catch((err) => {
      next(err);
    });
});

if (config.auth) {
  router.get('/auth/me', expressJwt({ secret: config.jwtsecret }));
}

// 获取用户信息
router.get('/auth/me', (req, res, next) => {
  // 同时告诉客户端，服务器是否在启用用户验证
  const user = config.auth
    ? { name: req.user.name, group: req.user.group }
    : { name: 'admin', group: 'administrator' }
    
  res.send({ isUsingAuth: config.auth, user });
});


module.exports = router;
