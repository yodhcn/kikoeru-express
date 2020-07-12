const express = require('express');
const db = require('../database');
const { config } = require('../config');

const addMetadataForWorks = (username, works) => {
  const promises = [];
  for (let i=0; i<works.length; i++) {
    promises.push(
      db.work.getWorkMetadata(username, works[i].id)
        .then(workRes => {
          works[i] = workRes;
        })
    );
  }

  return Promise.all(promises);
};

const router = express.Router();

// 获取音声元数据
router.get('/work/work/:id', (req, res, next) => {
  db.getWorkMetadata(req.params.id)
    .then(work => res.send(work))
    .catch(err => {
      if (err.message.indexOf('不存在') !== -1) {
        res.status(404).send({ error: err.message });
      } else {
        next(err);
      }
    });
});

// 获取音声列表
router.get('/work/works', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';

  const releaseTerm = req.query.release_term;
  const ageCategory = req.query.age_category;

  const currentPage = parseInt(req.query.page) || 1;
  const order_by = req.query.order_by || 'release';
  const sort = req.query.sort || 'desc';
  const offset = (currentPage - 1) * config.pageSize;
  
  try {
    const query = () => db.work.worksFilter(
      db.work.getWorksBy(),
      releaseTerm, ageCategory
    );
    const countRes = await query().count('* as count').first();
    const works = await query().offset(offset).limit(config.pageSize).orderBy(order_by, sort);
    await addMetadataForWorks(username, works);

    res.send({
      works,
      pagination: {
        currentPage,
        pageSize: config.pageSize,
        totalCount: countRes.count
      }
    });
  } catch (err) {
    next(err);
  }
});

// 获取包含指定关键字的音声列表
router.get('/work/works/search/:keyword?', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  const keyword = req.params.keyword && req.params.keyword.trim();
  
  const releaseTerm = req.query.release_term;
  const ageCategory = req.query.age_category;

  const currentPage = parseInt(req.query.page) || 1;
  const order_by = req.query.order_by || 'release';
  const sort = req.query.sort || 'desc';
  const offset = (currentPage - 1) * config.pageSize;
  
  try {
    const query = () => db.work.worksFilter(
      db.work.getWorksByKeyWord(username, keyword),
      releaseTerm, ageCategory
    );
    const countRes = await query().count('id as count').first();
    const works = await query().offset(offset).limit(config.pageSize).orderBy(order_by, sort);
    await addMetadataForWorks(username, works);

    res.send({
      works,
      pagination: {
        currentPage,
        pageSize: config.pageSize,
        totalCount: countRes.count
      }
    });
  } catch(err) {
    next(err);
  }
});

// 获取属于指定社团/系列/声优/标签的音声列表
router.get('/work/works/:field/:id', async (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';
  
  const releaseTerm = req.query.release_term;
  const ageCategory = req.query.age_category;

  const currentPage = parseInt(req.query.page) || 1;
  const order_by = req.query.order_by || 'release';
  const sort = req.query.sort || 'desc';
  const offset = (currentPage - 1) * config.pageSize;
  
  if (['circle', 'series', 'va', 'user_tag', 'dlsite_tag'].indexOf(req.params.field) === -1) {
    next();
  } else {
    try {
      let workQuery;
      switch(req.params.field) {
        case 'circle': case 'series': case 'va':
          workQuery = () => db.work.getWorksBy(req.params.id, req.params.field);
          break;
        case 'user_tag':
          workQuery = () => db.work.getWorksByUserTag(username, req.params.id);
          break;
        case 'dlsite_tag':
          workQuery = () => db.work.getWorksByDlsiteTag(username, req.params.id);
          break;
      }

      const query = () => db.work.worksFilter(
        workQuery(),
        releaseTerm, ageCategory
      );
      const countRes = await query().count('* as count').first();
      const works = await query().offset(offset).limit(config.pageSize).orderBy(order_by, sort);
      await addMetadataForWorks(username, works);

      res.send({
        works,
        pagination: {
          currentPage,
          pageSize: config.pageSize,
          totalCount: countRes.count
        }
      });
    } catch (err) {
      next(err);
    }
  }
});

// 获取社团/系列/声优/标签列表
router.get('/work/(:field)s/', (req, res, next) => {
  const username = config.auth ? req.user.name : 'admin';

  if (['circle', 'series' , 'va', 'dlsite_tag', 'user_tag'].indexOf(req.params.field) === -1) {
    next();
  } else {
    db.work.getLabels(username, req.params.field)
      .then(list => res.send(list))
      .catch(err => next(err));
  }
});


module.exports = router;
