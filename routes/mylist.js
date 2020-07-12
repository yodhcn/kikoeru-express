const { check, validationResult } = require('express-validator'); // 后端校验
const express = require('express');
const db = require('../database');
const { config } = require('../config');

const router = express.Router();

router.post('/mylist/update_mylist', [
  check('type')
    .custom(value => {
      if (['create', 'delete', 'rename'].indexOf(value) === -1) {
        throw new Error("type 必须为 ['create', 'delete', 'rename'] 中的一个.");
      }
      return true
    })
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const username = config.auth ? req.user.name : 'admin';
  const type = req.body.type;

  try {
    switch (type) {
      case 'create':
        const mylistId = await db.mylist.createMylist(username, req.body.mylist_name);
        res.send({ result: true, mylist_id: mylistId });
        break;
      case 'delete':
        await db.mylist.deleteMylist(username, req.body.mylist_id);
        res.send({ result: true });
        break;
      case 'rename':
        await db.mylist.renameMylist(username, req.body.mylist_id, req.body.mylist_name);
        res.send({ result: true });
        break;
    }
  } catch (err) {
    if (err.message.indexOf('不存在') !== -1) {
      res.status(404).send({ error: err.message });
    } else if (err.message.indexOf('不允许') !== -1) {
      res.status(403).send({ error: err.message });
    } else {
      next(err);
    }
  }
});

router.post('/mylist/update_mylist_work', [
  check('type')
    .custom(value => {
      if (['add', 'delete', 'order'].indexOf(value) === -1) {
        throw new Error("type 必须为 ['add', 'delete', 'order'] 中的一个.");
      }
      return true
    })
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const username = config.auth ? req.user.name : 'admin';
  const type = req.body.type;

  try {
    switch (type) {
      case 'add':
        await db.mylist.addMylistWork(username, req.body.mylist_id, req.body.mylist_work_id);
        break;
      case 'delete':
        await db.mylist.deleteMylistWork(username, req.body.mylist_id, req.body.mylist_work_id);
        break;
      case 'order':
        await db.mylist.orderMylistWork(username, req.body.mylist_id, req.body.works);
        break;
    }

    res.send({ result: true });
  } catch (err) {
    if (err.message.indexOf('不存在') !== -1) {
      res.status(404).send({ error: err.message });
    } else if (err.message.indexOf('不允许') !== -1) {
      res.status(403).send({ error: err.message });
    } else {
      next(err);
    }
  }
});

router.get('/mylist/mylists', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  try {
    const mylists = await db.mylist.getMylists(username);
    for (let i=0; i<mylists.length; i++) {
      const mylist_works = JSON.parse(mylists[i].mylist_works);
  
      const promises = [];
      for (let j=0; j<mylist_works.length; j++) {
        promises.push(
          db.work.getWorkSimpleMetadata(mylist_works[j])
            .then(workRes => {
              mylist_works[j] = workRes;
            })
        );
      }
      await Promise.all(promises);
  
      mylists[i].mylist_works = mylist_works;
    }

    res.send({ mylists });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
