const express = require('express');
const { getConfig } = require('../config');

const config = getConfig();
const router = express.Router();

// 更新配置文件
router.post('/config', (req, res, next) => {
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
      const config = getConfig();
      delete config.md5secret;
      delete config.jwtsecret;
      res.send({ config });
    } catch(err) {
      next(err);
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能读取配置文件.' });
  }
});


module.exports = router;