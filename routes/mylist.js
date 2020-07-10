const express = require('express');
const db = require('../database');
const { getConfig } = require('../config');

const config = getConfig();
const router = express.Router();

router.post('/mylist/update_mylist', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  const type = req.body.type;

  try {
    if (type === 'create') {
      const mylistId = await db.mylist.createMylist(username, req.body.mylist_name);
      res.send({ result: true, mylist_id: mylistId });
    } else if (type === 'delete') {
      await db.mylist.deleteMylist(username, req.body.mylist_id);
      res.send({ result: true });
    } else if (type === 'rename') {
      await db.mylist.renameMylist(username, req.body.mylist_id, req.body.mylist_name);
      res.send({ result: true });
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

router.post('/mylist/update_mylist_work', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  const type = req.body.type;

  try {
    if (type === 'add') {
      await db.mylist.addMylistWork(username, req.body.mylist_id, req.body.mylist_work_id);
    } else if (type === 'delete') {
      await db.mylist.deleteMylistWork(username, req.body.mylist_id, req.body.mylist_work_id);
    } else if (type === 'order') {
      await db.mylist.orderMylistWork(username, req.body.mylist_id, req.body.works);
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
