const knex = require('./connect');

/**
 * 创建一个新用户
 * @param {Object} user User object.
 */
const createUser = user => knex.transaction(async trx => {
  const userRes = await trx('t_user')
    .where('name', '=', user.name)
    .first();

  if (userRes) {
    throw new Error(`用户 ${user.name} 已存在.`);
  }

  return trx('t_user')
    .insert({
      name: user.name,
      password: user.password,
      group: user.group
    });
});

/**
 * 更新用户密码
 * @param {String} username 用户名
 * @param {String} newPassword 新密码
 */
const updateUserPassword = (username, newPassword) => knex.transaction(async trx => {
  const updatedNum = await trx('t_user')
    .where('name', '=', username)
    .update({
      password: newPassword
    });

  if (updatedNum === 0) {
    throw new Error(`不存在用户名为 ${username} 的用户.`);
  }

  return updatedNum;
});

/**
 * 重置用户密码为 "password"
 * @param {String} username 用户名
 */
const resetUserPassword = username => knex.transaction(async trx => {
  const updatedNum = await trx('t_user')
    .where('name', '=', username)
    .update({
      password: 'password'
    });

  if (updatedNum === 0) {
    throw new Error(`不存在用户名为 ${username} 的用户.`);
  }

  return updatedNum;
});

/**
 * 删除用户
 * @param {String} username 用户名
 */
const deleteUsers = usernames => knex.transaction(trx => trx('t_user')
  .where('name', 'in', usernames)
  .del());

const getUsers = () => knex('t_user')
  .select('name', 'group')
  .whereNot('name', '=', 'admin')

module.exports = {
  createUser, updateUserPassword, resetUserPassword, deleteUsers, getUsers
};