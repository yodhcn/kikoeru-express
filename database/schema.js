const knex = require('./connect');

// 数据库结构
const createSchema = () => knex.schema
  .createTable('t_circle', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [社团id]
    table.string('name').notNullable(); // VARCHAR 类型 [社团名称]
  })
  .createTable('t_series', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [系列id]
    table.string('name').notNullable(); // VARCHAR 类型 [系列名称]
    table.integer('circle_id').notNullable(); // INTEGER 类型 [社团id]
    table.foreign('circle_id').references('id').inTable('t_circle'); // FOREIGN KEY 外键
  })
  .createTable('t_work', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [音声id]
    table.string('root_folder').notNullable(); // VARCHAR 类型 [根文件夹别名]
    table.string('dir').notNullable(); // VARCHAR 类型 [相对存储路径]
    table.text('tracks').notNullable(); // TEXT 类型 [音频文件存储路径]
    table.string('title').notNullable(); // VARCHAR 类型 [音声名称]
    table.integer('circle_id').notNullable(); // INTEGER 类型 [社团id]
    table.integer('series_id'); // INTEGER 类型 [系列id]
    table.string('age_ratings').notNullable(); // VARCHAR 类型 [年龄指定]
    table.string('release').notNullable();  // VARCHAR 类型 [贩卖日 (YYYY-MM-DD)]

    table.integer('dl_count').notNullable(); // INTEGER 类型 [售出数]
    table.integer('price').notNullable(); // INTEGER 类型 [价格]
    table.integer('review_count').notNullable(); // INTEGER 类型 [评论数量]
    table.integer('rate_count').notNullable(); // INTEGER 类型 [评价数量]
    table.integer('rate_average').notNullable(); // INTEGER 类型 [平均评价]
    table.float('rate_average_2dp').notNullable(); // FLOAT 类型 [平均评价]
    table.text('rate_count_detail').notNullable(); // TEXT 类型 [评价分布明细]
    table.text('rank'); // TEXT 类型 [历史销售成绩]
    
    table.foreign('circle_id').references('id').inTable('t_circle'); // FOREIGN KEY 外键
    table.foreign('series_id').references('id').inTable('t_series'); // FOREIGN KEY 外键
    table.index(['circle_id', 'series_id', 'release', 'dl_count', 'review_count', 'price', 'rate_average_2dp']); // INDEX 索引
  })
  .createTable('t_va', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [声优id]
    table.string('name').notNullable(); // VARCHAR 类型 [声优名称]
  })
  .createTable('t_va_t_work_relation', (table) => {
    table.integer('va_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('va_id').references('id').inTable('t_va'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['va_id', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_dlsite_tag', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [标签id]
    table.string('name').notNullable(); // VARCHAR 类型 [标签名称]
    table.string('category').notNullable(); // VARCHAR 类型 [标签类别]
  })
  .createTable('t_dlsite_tag_t_work_relation', (table) => {
    table.integer('tag_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('tag_id').references('id').inTable('t_dlsite_tag'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['tag_id', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_user', (table) => {
    table.string('name').notNullable(); // VARCHAR 类型 [用户名]
    table.string('password').notNullable(); // VARCHAR 类型 [密码(经MD5加密)]
    table.string('group').notNullable(); // VARCHAR 类型 [用户组]
    table.primary(['name']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_user_tag', (table) => { // 存储用户标签
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [标签id]
    table.string('name').notNullable(); // VARCHAR 类型 [标签名称]
    table.string('created_by').notNullable(); // VARCHAR 类型 [创建标签的用户]
    table.foreign('created_by').references('name').inTable('t_user'); // FOREIGN KEY 外键
  })
  .createTable('t_user_t_dlsite_tag_t_work_relation', (table) => {
    table.string('user_name').notNullable();
    table.integer('tag_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('tag_id').references('id').inTable('t_dlsite_tag'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['user_name', 'tag_id', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_user_t_user_tag_t_work_relation', (table) => {
    table.string('user_name').notNullable();
    table.integer('tag_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('tag_id').references('id').inTable('t_user_tag'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['user_name', 'tag_id', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_mylist', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [收藏列表id]
    table.string('user_name').notNullable();
    table.string('name').notNullable(); // VARCHAR 类型 [收藏列表名称]
    table.text('works').notNullable(); // TEXT 类型 [收藏列表]
    table.foreign('user_name').references('name').inTable('t_user'); // FOREIGN KEY 外键
  })
  .createTable('t_mylist_t_work_relation', (table) => {
    table.integer('mylist_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('mylist_id').references('id').inTable('t_mylist'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['mylist_id', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .createTable('t_playlist', (table) => {
    table.increments(); // id自增列(INTEGER 类型)，会被用作主键 [播放列表id]
    table.string('user_name').notNullable();
    table.string('name').notNullable(); // VARCHAR 类型 [播放列表名称]
    table.text('tracks').notNullable(); // TEXT 类型 [播放列表]
    table.foreign('user_name').references('name').inTable('t_user'); // FOREIGN KEY 外键
  })
  .createTable('t_playlist_t_work_relation', (table) => {
    table.integer('playlist_id').notNullable();
    table.integer('work_id').notNullable();
    table.foreign('playlist_id').references('id').inTable('t_playlist'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['playlist_id', 'work_id']); // PRIMARY KEYprimary 主键
  })  
  .createTable('t_user_t_work_relation', (table) => {
    table.string('user_name').notNullable();
    table.integer('work_id').notNullable();
    table.string('collect_type').notNullable(); // wish(想听) collect(听过) do(在听) dropped(抛弃)
    table.foreign('user_name').references('name').inTable('t_user'); // FOREIGN KEY 外键
    table.foreign('work_id').references('id').inTable('t_work'); // FOREIGN KEY 外键
    table.primary(['user_name', 'work_id']); // PRIMARY KEYprimary 主键
  })
  .then(() => {
    console.log(' * 成功构建数据库结构.');
  })
  .catch((err) => {
    if (err.toString().indexOf('table `t_circle` already exists') !== -1) {
      console.log(' * 数据库结构已经存在.');
    } else {
      throw err;
    }
  });

module.exports = { createSchema };
