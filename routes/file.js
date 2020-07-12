const path = require('path');
const jschardet = require("jschardet"); // 检测文本编码
const iconv = require('iconv-lite'); // 文本解码
const express = require('express');
const knex = require('../database/connect');
const { coverFolderDir, config } = require('../config');

const router = express.Router();

router.get('/file/cover/:id', (req, res, next) => {
  const rjcode = (`000000${req.params.id}`).slice(-6);
  const type = req.query.type || 'main'; // 'main' or 'sam'
  res.sendFile(path.join(coverFolderDir, `RJ${rjcode}_img_${type}.jpg`), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, '..', 'static', 'no-image.jpg'), (err2) => {
        if (err2) {
          next(err2);
        }
      });
    }
  });
});

router.get('/file/stream/:id/:index', (req, res, next) => {
  knex('t_work')
    .select('root_folder', 'dir', 'tracks')
    .where('id', '=', req.params.id)
    .first()
    .then((work) => {
      if (!work) {
        res.status(404).send({ error: `不存在 id 为 ${workid} 的音声.` });
      } else {
        const rootFolder = config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
          const tracks = JSON.parse(work.tracks);
          const track = tracks[req.params.index];
          res.sendFile(path.join(rootFolder.path, work.dir, track.subtitle || '', track.title));
        } else {
          res.status(500).send({ error: `找不到文件夹: '${work.root_folder}'，请尝试重启服务器或重新扫描.` });
        }
      }
    });
});

router.get('/file/lyric/:id/:index', (req, res, next) => {
  knex('t_work')
    .select('root_folder', 'dir', 'tracks')
    .where('id', '=', req.params.id)
    .first()
    .then((work) => {
      if (!work) {
        res.status(404).send({ error: `不存在 id 为 ${workid} 的音声.` });
      } else {
        const rootFolder = config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
          const tracks = JSON.parse(work.tracks);
          const track = tracks[req.params.index];
          const lrcFile = track.title.split('.')[0] + '.lrc';
          fs.readFile(path.join(rootFolder.path, work.dir, track.subtitle || '', lrcFile), (err, data) => {
            if (err) {
              next(err);
            } else {
              const lyric = iconv.decode(data, jschardet.detect(data).encoding);
              res.send({ lyric });
            }
          }); 
        } else {
          res.status(500).send({error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.`});
        }
      }
    });
});


module.exports = router;
