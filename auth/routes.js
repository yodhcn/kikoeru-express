const express = require('express');
const { check, validationResult } = require('express-validator'); // 后端校验
const expressJwt = require('express-jwt'); // 把 JWT 的 payload 部分赋值于 req.user

const { signtoken, md5 } = require('./utils');
const db = require('../database/db');

const { getConfig, setConfig } = require('../config');
const config = getConfig();

const router = express.Router();

// 用户登录
router.post('/me', [
  check('name')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('password')
    .isLength({ min: 5 })
    .withMessage('密码长度至少为 5')
], (req, res, next) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).send({ errors: errors.array() });
  }

  const name = req.body.name;
  const password = req.body.password;

  db.knex('t_user')
    .where('name', '=', name)
    .andWhere('password', '=', md5(password))
    .first()
    .then((user) => {
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
  router.get('/me', expressJwt({ secret: config.jwtsecret }));
}

// 获取用户信息
router.get('/me', (req, res, next) => {
  // 同时告诉客户端，服务器是否启用用户验证
  const auth = config.auth;
  const user = config.auth
    ? { name: req.user.name, group: req.user.group }
    : { name: 'admin', group: 'administrator' }
  res.send({ user, auth });
});

// 创建一个新用户 (只有 admin 账号拥有权限)
router.post('/user', [
  check('name')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('password')
    .isLength({ min: 5 })
    .withMessage('密码长度至少为 5'),
  check('group')
    .custom(value => {
      if (value !== 'user' && value !== 'gaust') {
        throw new Error(`用户组名称必须为 ['user', 'gaust'] 的一个.`)
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
    name: req.body.name,
    password: req.body.password,
    group: req.body.group
  };

  if (!config.auth || req.user.name === 'admin') {
    db.createUser({
      name: user.name,
      password: md5(user.password),
      group: user.group
    })
      .then(() => res.send({ message: `用户 ${user.name} 创建成功.` }))
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
router.put('/user', [
  check('name')
    .isLength({ min: 5 })
    .withMessage('用户名长度至少为 5'),
  check('newPassword')
    .isLength({ min: 5 })
    .withMessage('密码长度至少为 5')
], (req, res, next) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({errors: errors.array()});
  }

  const user = {
    name: req.body.name
  };
  const newPassword = md5(req.body.newPassword);

  if (!config.auth || req.user.name === 'admin' || req.user.name === user.name) {
    db.updateUserPassword(user, newPassword)
      .then(() => res.send({ message: '密码修改成功.' }))
      .catch((err) => {
        if (err.message.indexOf('用户名错误.') !== -1) {
          res.status(401).send({ error: '用户名错误.' });
        } else {
          next(err);
        }
      });
  } else {
    res.status(403).send({ error: '只能修改自己账号的密码.' });
  }
});

// 删除用户 (仅 admin 账号拥有权限)
router.delete('/user', (req, res, next) => {
  const users = req.body.users

  if (!config.auth || req.user.name === 'admin') {
    if (!users.find(user => user.name === 'admin')) {
      db.deleteUser(users)
        .then(() => {
          res.send({ message: '删除成功.' });  
        })
        .catch((err) => {
          next(err);
        });
    } else {
      res.status(403).send({ error: '不能删除内置的管理员账号.' });
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能删除用户.' });
  }
});

// 获取所有用户
router.get('/users', (req, res, next) => {
  db.knex('t_user')
    .select('name', 'group')
    .then((users) => {
      res.send({ users });
    })
    .catch((err) => {
      next(err);
    });
});

// 修改配置文件
router.put('/config', (req, res, next) => {
  if (!config.auth || req.user.name === 'admin') {
    try {
      setConfig(req.body.config);
      res.send({ message: '保存成功.' })
    } catch(err) {
      next(err);
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能修改配置文件.' });
  }
});

// 获取配置文件
router.get('/config', (req, res, next) => {
  if (!config.auth || req.user.name === 'admin') {
    try {
      res.send({ config: getConfig() });
    } catch(err) {
      next(err);
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能读取配置文件.' });
  }
});

// 创建一个新用户播放列表
router.post('/playlist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.createUserPlaylist(username, {
    username,
    name: req.body.playlistName,
    tracks: req.body.tracks
  })
    .then(() => res.send({ message: '播放列表创建成功.' }))
    .catch((err) => {
      if (err.message.indexOf('已存在') !== -1) {
        res.status(403).send({ error: err.message });
      } else {
        next(err);
      }
    });
});

// 更新用户播放列表
router.put('/playlist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.updateUserPlaylist(username, req.body.oldPlaylistName, {
    username,
    name: req.body.newPlaylistName,
    tracks: req.body.tracks
  })
    .then(() => res.send({ message: '播放列表更新成功.' }))
    .catch((err) => {
      if (err.message.indexOf('不存在') !== -1) {
        res.status(403).send({ error: err.message });
      } else {
        next(err);
      }
    });
});

// 删除用户播放列表
router.delete('/playlist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.deleteUserPlaylists(username, req.body.playlistNames)
    .then(() => res.send({ message: '播放列表删除成功.' }))
    .catch((err) => next(err));
});

// 查询用户所有的播放列表
router.get('/playlist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.getUserPlaylists(username)
    .then((playlists) => res.send({ playlists }))
    .catch((err) => next(err));
});

// 创建一个新用户收藏列表
router.post('/mylist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.createUserMylist(username, {
    username,
    name: req.body.mylistName,
    works: req.body.works
  })
    .then(() => res.send({ message: '收藏列表创建成功.' }))
    .catch((err) => {
      if (err.message.indexOf('已存在') !== -1) {
        res.status(403).send({ error: err.message });
      } else {
        next(err);
      }
    });
});

// 更新用户收藏列表
router.put('/mylist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.updateUserMylist(username, {
    id: req.body.id,
    name: req.body.name,
    works: req.body.works
  })
    .then(() => res.send({ message: '收藏列表更新成功.' }))
    .catch((err) => {
      if (err.message.indexOf('不存在') !== -1) {
        res.status(403).send({ error: err.message });
      } else {
        next(err);
      }
    });
});

// 删除用户收藏列表
router.delete('/mylist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.deleteUserMylists(username, req.body.mylistIds)
    .then(() => res.send({ message: '收藏列表删除成功.' }))
    .catch((err) => next(err));
});

// 查询用户所有的收藏列表
router.get('/mylist', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  db.getUserMylists(username)
    .then((mylists) => {
      res.send({ mylists })
    })
    .catch((err) => next(err));
});

module.exports = router;
