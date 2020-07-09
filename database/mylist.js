const _ = require('lodash');
const knex = require('./connect');

/**
 * 创建收藏列表
 * @param {String} username 用户名
 * @param {String} mylistName 收藏列表名称
 */
const createMylist = (username, mylistName) => knex.transaction(async trx => {
  const indexRes = await trx('t_mylist')
    .insert({
      user_name: username,
      name: mylistName,
      works: JSON.stringify(works)
    });
  const mylistId = indexRes[0];

  return mylistId;
});

/**
 * 删除收藏列表
 * @param {String} username 用户名
 * @param {Number} mylistId 收藏列表 id
 */
const deleteMylist = (username, mylistId) => knex.transaction(async trx => {
  const deletedNum = await trx('t_mylist')
    .where('user_name', '=', username)
    .andWhere('id', '=', mylistId)
    .del();

  if (deletedNum === 0) {
    throw new Error(`不存在 id 为 ${mylistId} 且属于用户 ${username} 的收藏列表.`);
  }

  return deletedNum;
});

/**
 * 重命名收藏列表
 * @param {String} username 用户名
 * @param {Number} mylistId 收藏列表 id
 * @param {String} username 收藏列表名称
 */
const renameMylist = (username, mylistId, mylistName) => knex.transaction(async trx => {
  const updatedNum = await trx('t_mylist')
    .where('id', '=', mylistId)
    .andWhere('user_name', '=', username)
    .update({
      name: mylistName
    });

  if (updatedNum === 0) {
    throw new Error(`不存在 id 为 ${mylistId} 且属于用户 ${username} 的收藏列表.`);
  }

  return updatedNum;
});

/**
 * 获取用户的全部收藏列表
 * @param {String} username 用户名
 */
const getMylists = async username => knex('t_mylist')
  .select('id', 'name as mylist_name', 'works as mylist_works')
  .where('user_name', '=', username);

/**
 * 添加收藏列表音声
 * @param {String} username 用户名
 * @param {Number} mylistId 收藏列表 id
 * @param {Number} workid 音声 id
 */
const addMylistWork = (username, mylistId, workid) => knex.transaction(async trx => {
  const mylistRes = await trx('t_mylist')
    .select('works')
    .where('id', '=', mylistId)
    .andWhere('user_name', '=', username)
    .first();
  
  if (!mylistRes) {
    throw new Error(`不存在 id 为 ${mylistId} 且属于用户 ${username} 的收藏列表.`);
  }

  const works = JSON.parse(mylistRes.works);
  const index = works.findIndex(work => work === workid);

  if (index !== -1) {
    throw new Error('不允许在收藏列表中添加重复的音声.');
  }

  try {
    await trx('t_mylist_t_work_relation')
      .insert({
        mylist_id: mylistId,
        work_id: workid
      });
  } catch (err) {
    if (err.message.indexOf('FOREIGN KEY constraint failed') !== -1) {
      throw new Error(`不存在 id 为 ${workid} 的音声.`);
    } else {
      throw err;
    }
  }

  works.push(workid);
  await trx('t_mylist')
    .where('id', '=', mylistId)
    .update({
      works: JSON.stringify(works)
    });
});

/**
 * 删除收藏列表音声
 * @param {String} username 用户名
 * @param {Number} mylistId 收藏列表 id
 * @param {Number} workid 音声 id
 */
const deleteMylistWork = (username, mylistId, workid) => knex.transaction(async trx => {
  const mylistRes = await trx('t_mylist')
    .select('works')
    .where('id', '=', mylistId)
    .andWhere('user_name', '=', username)
    .first();
  
  if (!mylistRes) {
    throw new Error(`不存在 id 为 ${mylistId} 且属于用户 ${username} 的收藏列表.`);
  }

  const works = JSON.parse(mylistRes.works);
  const index = works.findIndex(work => work === workid);

  if (index === -1) {
    throw new Error(`在 id 为 ${mylistId} 的收藏列表中, 不存在 id 为 ${workid} 的音声.`);
  }

  await trx('t_mylist_t_work_relation')
    .where('mylist_id', '=', mylistId)
    .andWhere('work_id', '=', workid)
    .del();

  works.splice(index, 1);
  await trx('t_mylist')
    .where('id', '=', mylistId)
    .update({
      works: JSON.stringify(works)
    });
});

/**
 * 排序收藏列表音声
 * @param {String} username 用户名
 * @param {Number} mylistId 收藏列表 id
 * @param {Array} works 音声 id 数组
 */
const orderMylistWork = (username, mylistId, works) => knex.transaction(async trx => {
  const mylistRes = await trx('t_mylist')
    .select('works')
    .where('id', '=', mylistId)
    .andWhere('user_name', '=', username)
    .first();
  
  if (!mylistRes) {
    throw new Error(`不存在 id 为 ${mylistId} 且属于用户 ${username} 的收藏列表.`);
  }

  const oldWorks = JSON.parse(mylistRes.works);
  const oldWorksClone = _.cloneDeep(oldWorks);
  const worksClone = _.cloneDeep(works);

  if (!_.isEqual(oldWorksClone.sort(), worksClone.sort())) {
    throw new Error('不允许在排序音声的同时添加或删除音声.');
  }

  await trx('t_mylist')
    .where('id', '=', mylistId)
    .update({
      works: JSON.stringify(works)
    });
});


module.exports = {
  createMylist, deleteMylist, renameMylist, getMylists,
  addMylistWork, deleteMylistWork, orderMylistWork
};
