const moment = require('moment');
const knex = require('./connect');

/**
 * 将音声的元数据插入到数据库
 * @param {Object} work Work object.
 */
const insertWorkMetadata = work => knex.transaction(async trx => {
  await trx.raw(
    trx('t_circle').insert(work.circle).toString().replace('insert', 'insert or ignore')
  );

  if (work.series) {
    await trx.raw(
      trx('t_series')
        .insert({
          id: work.series.id,
          name: work.series.name,
          circle_id: work.circle.id
        }).toString().replace('insert', 'insert or ignore')
    );
  }

  await trx('t_work')
    .insert({
      id: work.id,
      root_folder: work.rootFolderName,
      dir: work.dir,
      tracks: JSON.stringify(work.tracks),
      title: work.title,
      circle_id: work.circle.id,
      series_id: work.series ? work.series.id : null,
      age_ratings: work.age_ratings,
      release: work.release,

      dl_count: work.dl_count,
      price: work.price,
      review_count: work.review_count,
      rate_count: work.rate_count,
      rate_average: work.rate_average,
      rate_average_2dp: work.rate_average_2dp,
      rate_count_detail: JSON.stringify(work.rate_count_detail),
      rank: work.rank.length ? JSON.stringify(work.rank) : null
    });

  if (work.tags && work.tags.length) {
    await trx.raw(
      trx('t_dlsite_tag')
        .insert(work.tags).toString().replace('insert', 'insert or ignore')
    );

    await trx('t_dlsite_tag_t_work_relation')
      .insert(work.tags.map(tag => {
        return {
          tag_id: tag.id,
          work_id: work.id
        };
      }));
  }

  if (work.vas && work.vas.length) {
    await trx.raw(
      trx('t_va')
        .insert(work.vas).toString().replace('insert', 'insert or ignore')
    );

    await trx('t_va_t_work_relation')
      .insert(work.vas.map(va => {
        return {
          va_id: va.id,
          work_id: work.id
        };
      }));
  }
});

/**
 * 更新音声的动态元数据
 * @param {Object} work Work object.
 */
const updateWorkMetadata = work => knex.transaction(trx => trx('t_work')
  .where('id', '=', work.id)
  .update({
    dl_count: work.dl_count,
    price: work.price,
    review_count: work.review_count,
    rate_count: work.rate_count,
    rate_average_2dp: work.rate_average_2dp,
    rate_count_detail: JSON.stringify(work.rate_count_detail),
    rank: work.rank.length ? JSON.stringify(work.rank) : null
  }));

/**
 * 查询音声元数据
 * @param {String} username 用户名
 * @param {Number} workid 音声 id
 */
const getWorkMetadata = async (username, workid) => {
  const workRes = await knex('t_work')
    .select('*')
    .where('id', '=', workid)
    .first();

  if (!workRes) {
    throw new Error(`不存在 id 为 ${workid} 的音声.`);
  }

  const circleRes = await knex('t_circle')
    .select('id', 'name')
    .where('t_circle.id', '=', workRes.circle_id)
    .first();

  const seriesRes = await knex('t_series')
    .select('id', 'name')
    .where('t_series.id', '=', workRes.series_id)
    .first();

  const vasRes = await knex('t_va_t_work_relation')
    .select('va_id as id', 'name')
    .where('work_id', '=', workid)
    .join('t_va', 't_va.id', '=', 'va_id');

  const originalTagsRes = await knex('t_dlsite_tag_t_work_relation')
    .select('tag_id as id', 'name')
    .where('work_id', '=', workid)
    .join('t_dlsite_tag', 't_dlsite_tag.id', '=', 'tag_id');

  const customTagsRes = await getCustomWorkTags(username, workid);

  const work = {
    id: workRes.id,
    title: workRes.title,
    circle: circleRes,
    series: seriesRes || null,
    age_ratings: workRes.age_ratings,
    release: workRes.release,
    vas: vasRes,
    original_tags: originalTagsRes,
    custom_dlsite_tags: customTagsRes.dlsite_tags,
    custom_user_tags: customTagsRes.user_tags,

    dl_count: workRes.dl_count,
    price: workRes.price,
    review_count: workRes.review_count,
    rate_count: workRes.rate_count,
    rate_average_2dp: workRes.rate_average_2dp,
    rate_count_detail: JSON.parse(workRes.rate_count_detail),
    rank: workRes.rank ? JSON.parse(workRes.rank) : []
  };

  return work;
};

const getWorkSimpleMetadata = async id => {
  const workRes = await knex('t_work')
    .select('id', 'title', 'circle_id')
    .where('id', '=', id)
    .first();

  if (!workRes) {
    throw new Error(`不存在 id 为 ${id} 的音声.`);
  }

  const circleRes = await knex('t_circle')
    .select('id', 'name')
    .where('t_circle.id', '=', workRes.circle_id)
    .first();

  const work = {
    id: workRes.id,
    title: workRes.title,
    circle: circleRes
  };

  return work;
};

/**
 * 检查音声的"社团"、"系列、"标签"和"声优"是否仍在被其它音声引用；
 * 如果已经不再被引用，将其记录从数据库中移除
 * @param {Function} trx knex 事务函数
 * @param {Number} circleId 社团 id
 * @param {Number} seriesId 系列 id
 * @param {Array} dlsiteTags dlsite 标签对象数组
 * @param {Array} userTags 用户标签对象数组
 * @param {Array} vas 声优对象数组
 */
const cleanupOrphans = (trx, circleId, seriesId, vas, userTags, dlsiteTags) => {
  const getCount = (tableName, colName, colValue) => trx(tableName)
    .where(colName, '=', colValue)
    .count('* as count')
    .first()
    .then(res => res.count)
    .catch(err => {
      throw new Error(`在统计表 ${tableName} 中满足条件 (where ${colName} = ${colValue}) 的记录数时出现错误: ${err}`);
    });
  
  const promises = [];

  promises.push(
    getCount('t_work', 'circle_id', circleId)
      .then(count => {
        if (count === 0) {
          return trx('t_circle').del().where('id', '=', circleId);
        }
      })
  );

  if (seriesId) {
    promises.push(
      getCount('t_work', 'series_id', seriesId)
        .then(count => {
          return trx('t_series').del().where('id', '=', seriesId);
        })
    );
  }

  vas.forEach(va => {
    promises.push(
      getCount('t_va_t_work_relation', 'va_id', va.id)
        .then(count => {
          if(count === 0) {
            return trx('t_va').delete().where('id', '=', va.id)
          }
        })
    );
  });
  
  userTags.forEach(tag => {
    promises.push(
      getCount('t_user_t_user_tag_t_work_relation', 'tag_id', tag.id)
        .then(count => {
          if (count === 0) {
            return trx('t_user_tag').delete().where('id', '=', tag.id);
          }
        })
    );
  });

  dlsiteTags.forEach(tag => {
    promises.push(
      Promise.all([
        getCount('t_dlsite_tag_t_work_relation', 'tag_id', tag.id),
        getCount('t_user_t_dlsite_tag_t_work_relation', 'tag_id', tag.id)
      ])
        .then(res => {
          if (res[0] === 0 && res[1] === 0) {
            return trx('t_dlsite_tag').delete().where('id', '=', tag.id);
          }
        })
    );
  });

  return Promise.all(promises);
};

/**
 * 将音声从数据库中移除
 * @param {Number} id Work id.
 */
const removeWork = id => knex.transaction(async trx => {
  const workRes = await trx('t_work').select('circle_id', 'series_id').where('id', '=', id).first();
  if (!workRes) {
    return;
  }

  const circleId = workRes.circle_id;
  const seriesId = workRes.series_id;
  const vasRes = await trx('t_va_t_work_relation').select('va_id as id').where('work_id', '=', id);
  const userTagsRes = await trx('t_user_t_user_tag_t_work_relation').distinct('tag_id as id').where('work_id', '=', id);
  const dlsiteTagsRes = await trx('t_dlsite_tag_t_work_relation').select('tag_id as id').where('work_id', '=', id).union([
    trx('t_user_t_dlsite_tag_t_work_relation').select('tag_id as id').where('work_id', '=', id)
  ]);
  const mylistsRes = await trx('t_mylist_t_work_relation').select('mylist_id as id').where('work_id', '=', id);

  const promises = [];

  // 移除关系表中与音声关联的记录
  promises.push(
    trx('t_va_t_work_relation').del().where('work_id', '=', id),
    trx('t_dlsite_tag_t_work_relation').del().where('work_id', '=', id),
    trx('t_user_t_dlsite_tag_t_work_relation').del().where('work_id', '=', id),
    trx('t_user_t_user_tag_t_work_relation').del().where('work_id', '=', id),
    trx('t_mylist_t_work_relation').del().where('work_id', '=', id)
  );
  
  // 将音声从收藏列表中移除
  for (let i=0; i<mylistsRes.length; i++) {
    const mylistId = mylistsRes[i].id;

    promises.push(
      trx('t_mylist').select('works').where('id', '=', mylistId).first()
        .then(mylistRes => {
          const works = JSON.parse(mylistRes.works);
          const index = works.findIndex(workid => workid === id);
      
          if (index !== -1) {
            works.splice(index, 1);
            return trx('t_mylist')
              .where('id', '=', mylistId)
              .update({
                works: JSON.stringify(works)
              });
          }
        })
    );
  }

  await Promise.all(promises);
  await trx('t_work').del().where('id', '=', id);

  try {
    await cleanupOrphans(trx, circleId, seriesId, vasRes, userTagsRes, dlsiteTagsRes);
  } catch (err) {
    throw new Error(`在检查与清理不再被引用的记录时出错: ${err}`)
  }
});

/**
 * Returns list of works by circle, series or VA.
 * @param {Number} id Which id to filter by.
 * @param {String} field Which field to filter by.
 */
const getWorksBy = (id, field) => {
  switch (field) {
    case 'circle':
      return knex('t_work')
        .select('id')
        .where('circle_id', '=', id);
    
    case 'series':
      return knex('t_work')
        .select('id')
        .where('series_id', '=', id);

    case 'va':
      const workIdQuery = knex('t_va_t_work_relation')
        .select('work_id')
        .where('va_id', '=', id);

      return knex('t_work')
        .select('id')
        .where('id', 'in', workIdQuery);

    default:
      return knex('t_work')
        .select('id');
  }
};

/**
 * 查询用户为音声自定义的标签
 * @param {String} username 
 * @param {Number} workid 
 */
const getCustomWorkTags = async (username, workid) => {
  const dlsiteTags = await knex('t_user_t_dlsite_tag_t_work_relation')
    .select('tag_id as id', 'name')
    .where('work_id', '=', workid)
    .andWhere('user_name', '=', username)
    .join('t_dlsite_tag', 't_dlsite_tag.id', '=', 'tag_id');
  
  const userTags = await knex('t_user_t_user_tag_t_work_relation')
    .select('tag_id as id', 'name', 'created_by')
    .where('work_id', '=', workid)
    .andWhere('user_name', '=', username)
    .join('t_user_tag', 't_user_tag.id', '=', 'tag_id');
  
  return {
    dlsite_tags: dlsiteTags,
    user_tags: userTags
  };
};

/**
 * 根据用户标签查询音声
 * @param {String} username 用户名
 * @param {Number} tagId 用户标签 id
 */
const getWorksByUserTag = (username, tagId) => {
  const workIdQuery = knex('t_user_t_user_tag_t_work_relation')
    .select('work_id')
    .where('tag_id', '=', tagId)
    .andWhere('user_name', '=', username);
    
  return knex('t_work')
    .select('id')
    .where('id', 'in', workIdQuery);
};

/**
 * 根据 dliste 标签查询音声
 * @param {String} username 用户名
 * @param {Number} tagId 用户标签 id
 */
const getWorksByDlsiteTag = (username, tagId) => {
  // 查询标签被用户编辑过的音声
  const editedWorkIdQuery = knex('t_user_t_dlsite_tag_t_work_relation')
    .distinct('work_id')
    .where('user_name', '=', username);
  
  const workIdQuery = knex('t_user_t_dlsite_tag_t_work_relation')
    .select('work_id')
    .where('tag_id', '=', tagId)
    .andWhere('user_name', '=', username)
    .union([
      knex('t_dlsite_tag_t_work_relation')
        .select('work_id')
        .where('tag_id', '=', tagId)
        .andWhere('work_id', 'not in', editedWorkIdQuery) // 排除标签被用户编辑过的音声
    ]);
    
  return knex('t_work')
    .select('id')
    .where('id', 'in', workIdQuery);
};

/**
 * 根据关键字查询音声
 * @param {String} username 用户名
 * @param {String} keyword 关键字
 */
const getWorksByKeyWord = (username, keyword) => {
  if (!keyword) {
    return knex('t_work')
      .select('id');
  }

  const workid = keyword.match(/RJ(\d{6})/) ? keyword.match(/RJ(\d{6})/)[1] : null;
  if (workid) {
    return knex('t_work')
      .select('id')
      .where('id', '=', workid);
  }

  const circleIdQuery = knex('t_circle').select('id').where('name', 'like', `%${keyword}%`);
  const seriesIdQuery = knex('t_series').select('id').where('name', 'like', `%${keyword}%`);
  
  const editedWorkIdQuery = knex('t_user_t_dlsite_tag_t_work_relation').distinct('work_id').where('user_name', '=', username);
  const dlsiteTagIdQuery = knex('t_dlsite_tag').select('id').where('name', 'like', `%${keyword}%`);
  const userTagIdQuery = knex('t_user_tag').select('id').where('name', 'like', `%${keyword}%`);
  const vaIdQuery = knex('t_va').select('id').where('name', 'like', `%${keyword}%`);

  const workIdQuery = knex('t_va_t_work_relation').select('work_id').where('va_id', 'in', vaIdQuery).union([
    knex('t_user_t_user_tag_t_work_relation').select('work_id').where('tag_id', 'in', userTagIdQuery).andWhere('user_name', '=', username),
    knex('t_user_t_dlsite_tag_t_work_relation').select('work_id').where('tag_id', 'in', dlsiteTagIdQuery).andWhere('user_name', '=', username),
    knex('t_dlsite_tag_t_work_relation').select('work_id').where('tag_id', 'in', dlsiteTagIdQuery).andWhere('work_id', 'not in', editedWorkIdQuery)
  ]);

  return knex('t_work')
    .select('id')
    .where(builder =>
      builder.where('title', 'like', `%${keyword}%`)
        .orWhere('circle_id', 'in', circleIdQuery)
        .orWhere('series_id', 'in', seriesIdQuery)
        .orWhere('id', 'in', workIdQuery)
    );
};

/**
 * 获取所有社团/系列/标签/声优的列表
 * @param {String} username 用户名
 * @param {String} field ['circle', 'series', 'va', 'dlsiteTag', 'userTag'] 中的一个
 */
const getLabels = (username, field) => {
  switch (field) {
    case 'circle': case 'series':
      return knex('t_work')
        .join(`t_${field}`, `${field}_id`, '=', `t_${field}.id`)
        .select(`t_${field}.id`, 'name')
        .groupBy(`${field}_id`)
        .count('* as count')
        .orderBy('name', 'asc');
    case 'va':
      return knex('t_va_t_work_relation')
        .join('t_va', 'va_id', '=', 't_va.id')
        .select('t_va.id', 'name')
        .groupBy('va_id')
        .count('* as count')
        .orderBy('name', 'asc');
    case 'dlsite_tag':
      const editedWorkIdQuery = knex('t_user_t_dlsite_tag_t_work_relation')
        .distinct('work_id')
        .where('user_name', '=', username);

      const queryString = 
        knex.unionAll([
          knex('t_user_t_dlsite_tag_t_work_relation')
            .join('t_dlsite_tag', 'tag_id', '=', 't_dlsite_tag.id')
            .select('t_dlsite_tag.id', 'name', `category`)
            .where('user_name', '=', username),
            
          knex('t_dlsite_tag_t_work_relation')
            .join('t_dlsite_tag', 'tag_id', '=', 't_dlsite_tag.id')
            .select('t_dlsite_tag.id', 'name', `category`)
            .where('work_id', 'not in', editedWorkIdQuery)
        ]).toString();

      return knex.raw('select `id`, `name`, `category`, count(*) as count from (' + queryString + ')' + 'group by `id` order by `name` asc');
    case 'user_tag':
      return knex('t_user_t_user_tag_t_work_relation')
        .join('t_user_tag', 'tag_id', '=', 't_user_tag.id')
        .select('t_user_tag.id', 'name', 'created_by')
        .where('user_name', '=', username)
        .groupBy('tag_id')
        .count('* as count')
        .orderBy('name', 'asc');
  }
};

const worksFilter = (workQuery, releaseTerm, ageCategory) => {
  // 发售开始日期	
  if (releaseTerm) {
    let registDateStart, registDateEnd;
    switch (releaseTerm) {
      case 'week': // 一周以内
        registDateStart = moment(Date.now()).subtract(7, 'days').format('YYYY-MM-DD');
        workQuery.andWhere('release', '>=', registDateStart);
        break;
      case 'month': // 一个月以内
        registDateStart = moment(Date.now()).subtract(1, 'months').format('YYYY-MM-DD');
        workQuery.andWhere('release', '>=', registDateStart);
        break;
      case 'year': // 一年以内
        registDateStart = moment(Date.now()).subtract(1, 'years').format('YYYY-MM-DD');
        workQuery.andWhere('release', '>=', registDateStart);
        break;
      case 'old': // 更以前
        registDateEnd = moment(Date.now()).subtract(1, 'years').subtract(1, 'days').format('YYYY-MM-DD');
        workQuery.andWhere('release', '<=', 'registDateEnd');
        break;
    }
  }

  // 年龄指定
  if (ageCategory) {
    workQuery.andWhere('age_ratings', '=', ageCategory);
  }

  return workQuery;
};


module.exports = {
  insertWorkMetadata, updateWorkMetadata, removeWork, getWorkMetadata, getWorkSimpleMetadata,
  getWorksBy, getWorksByUserTag, getWorksByDlsiteTag, getWorksByKeyWord, worksFilter, getLabels
};
