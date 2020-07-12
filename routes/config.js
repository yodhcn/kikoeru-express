const _ = require('lodash');
const express = require('express');
const { config, setConfig } = require('../config');

const router = express.Router();

// 更新配置文件
router.post('/config', (req, res, next) => {
  if (!config.auth || req.user.name === 'admin') {
    try {
      const configClone = _.cloneDeep(req.body.config);
      delete configClone.md5secret;
      delete configClone.jwtsecret;
      setConfig(configClone);
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
      const configClone = _.cloneDeep(config);
      delete configClone.md5secret;
      delete configClone.jwtsecret;
      res.send({ config: configClone });
    } catch(err) {
      next(err);
    }
  } else {
    res.status(401).send({ error: '只有 admin 账号能读取配置文件.' });
  }
});


module.exports = router;
