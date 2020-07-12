const md5 = require('md5');
const { check, validationResult } = require('express-validator'); // 后端校验
const express = require('express');
const db = require('../database');
const { config } = require('../config');

const cmd5 = str => md5(str + config.md5secret);

const router = express.Router();

// 创建一个新用户 (仅 admin 账号拥有权限)
router.post('/user/user', [
  check('username')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为 8'),
  check('group')
    .custom(value => {
      if (['user', 'gaust'].indexOf(value) === -1) {
        throw new Error("用户组名称必须为 ['user', 'gaust'] 中的一个.")
      }
      return true
    })
], (req, res, next) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).send({ errors: errors.array() });
  }

  const user = {
    name: req.body.username,
    password: req.body.password,
    group: req.body.group
  };

  if (!config.auth || req.user.name === 'admin') {
    db.user.createUser({
      name: user.name,
      password: cmd5(user.password),
      group: user.group
    })
      .then(() => res.send({ message: `成功创建新用户: ${user.name}` }))
      .catch((err) => {
        if (err.message.indexOf('已存在') !== -1) {
          res.status(403).send({ error: err.message });
        } else {
          next(err);
        }
      });
  } else {
    res.status(401).send({ error: '只有 admin 账号能创建新用户.' });
  }
});

// 更新用户密码
router.put('/user/user', [
  check('username')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('newPassword')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为 8')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const username = req.body.username; 
  const newPassword = req.body.newPassword;

  if (!config.auth || username === 'admin' || req.user.name === username) {
    db.user.updateUserPassword(username, cmd5(newPassword))
      .then(() => res.send({ message: '密码修改成功.' }))
      .catch((err) => {
        if (err.message.indexOf('不存在') !== -1) {
          res.status(404).send({ error: err.message });
        } else {
          next(err);
        }
      });
  } else {
    res.status(403).send({ error: '不允许修改其他用户的密码.' });
  }
});

// 删除用户 (仅 admin 账号拥有权限)
router.delete('/user/users', [
  check('usernames')
    .custom(value => {
      if (!value.isArray()) {
        throw new Error(`usernames 必须是一个数组.`);
      }
      if (!value.length) {
        throw new Error(`数组 usernames 的长度至少为 1`);
      }
      
      return true
    })
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const usernames = req.body.usernames;

  if (!config.auth || req.user.name === 'admin') {
    if (usernames.indexOf('admin') !== -1) {
      db.deleteUser(usernames)
        .then(() => {
          res.send({ message: '删除成功.' });  
        })
        .catch((err) => {
          next(err);
        });
    } else {
      res.status(403).send({ error: '不允许删除内置的管理员账号.' });
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能删除用户.' });
  }
});

// 获取所有用户
router.get('/user/users', (req, res, next) => {
  db.user.getUsers()
    .then(users => {
      res.send({ users });
    })
    .catch((err) => {
      next(err);
    });
});

module.exports = router;
